"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api";
import { useVasCategories, useVasProducts, useVasServices, useVasTransactions } from "@/hooks/useApi";
import type { VasPowerVerification, VasService, VasTransaction } from "@/lib/api/types";

type Kind = "AIRTIME" | "DATA" | "CABLETV" | "UTILITY";

const KIND_LABEL: Record<Kind, string> = {
  AIRTIME: "Airtime",
  DATA: "Data",
  CABLETV: "Cable TV",
  UTILITY: "Electricity",
};

/** SafeHaven labels services by `identifier`; fall back to the display name. */
function kindOf(service: VasService): Kind | null {
  const key = (service.identifier ?? service.name ?? "").toUpperCase();
  if (key.includes("AIRTIME") || key.includes("RECHARGE")) return "AIRTIME";
  if (key.includes("DATA")) return "DATA";
  if (key.includes("CABLE") || key.includes("TV")) return "CABLETV";
  if (key.includes("UTILITY") || key.includes("POWER") || key.includes("ELECTRIC")) return "UTILITY";
  return null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontFamily: "var(--font-body)", fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "6px" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const done = status === "COMPLETED";
  const failed = status === "FAILED" || status === "CANCELLED";
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
      style={{
        background: done ? "rgba(34,197,94,0.1)" : failed ? "rgba(239,68,68,0.1)" : "rgba(234,179,8,0.1)",
        color: done ? "var(--success)" : failed ? "var(--error)" : "#ca8a04",
        fontFamily: "var(--font-body)", fontSize: "11px", fontWeight: 700,
      }}>
      {status}
    </span>
  );
}

export default function BillsPage() {
  const { user, bankAccount, setAuthOpen } = useAuth();

  const { data: services, isLoading: loadingServices } = useVasServices();
  const [kind, setKind] = useState<Kind>("AIRTIME");

  const service = useMemo(
    () => (services ?? []).find((s) => kindOf(s) === kind) ?? null,
    [services, kind],
  );
  const { data: categories } = useVasCategories(service?._id ?? null);

  const [categoryId, setCategoryId] = useState("");
  const { data: products } = useVasProducts(kind === "DATA" || kind === "CABLETV" ? categoryId || null : null);

  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [bundleCode, setBundleCode] = useState("");
  const [entityNumber, setEntityNumber] = useState("");
  const [verified, setVerified] = useState<{ name: string; vendType?: string } | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<VasTransaction | null>(null);

  const { data: history, mutate: reloadHistory } = useVasTransactions(1, 5);

  function resetForm() {
    setCategoryId(""); setAmount(""); setPhone(""); setBundleCode("");
    setEntityNumber(""); setVerified(null); setError("");
  }

  /** POST /autoramp/vas/verify — confirm the meter/smartcard holder first. */
  async function verifyEntity() {
    if (!categoryId || !entityNumber.trim()) { setError("Choose a provider and enter the number"); return; }
    setBusy(true); setError("");
    try {
      const result = await api.autoramp.vas.verify({ serviceCategoryId: categoryId, entityNumber: entityNumber.trim() });
      const power = result as VasPowerVerification;
      setVerified({ name: result.customerName, vendType: power.vendType });
    } catch (err) {
      setVerified(null);
      setError(err instanceof Error ? err.message : "Could not verify that number");
    } finally {
      setBusy(false);
    }
  }

  /** POST /autoramp/vas/pay/* then poll the sync endpoint for the final status. */
  async function pay() {
    if (!categoryId) { setError("Choose a provider"); return; }
    const value = Number(amount.replace(/[^0-9.]/g, ""));
    setBusy(true); setError(""); setReceipt(null);

    try {
      const base = { serviceCategoryId: categoryId, amount: value, channel: "WEB" as const };
      let created;

      if (kind === "AIRTIME") {
        if (!phone.trim() || !value) throw new Error("Enter a phone number and amount");
        created = await api.autoramp.vas.payAirtime({ ...base, phoneNumber: phone.trim() });
      } else if (kind === "DATA") {
        if (!phone.trim() || !bundleCode) throw new Error("Pick a bundle and enter a phone number");
        created = await api.autoramp.vas.payData({ ...base, bundleCode, phoneNumber: phone.trim() });
      } else if (kind === "CABLETV") {
        if (!verified || !bundleCode) throw new Error("Verify the smartcard and pick a bouquet");
        created = await api.autoramp.vas.payCableTv({ ...base, bundleCode, cardNumber: entityNumber.trim() });
      } else {
        if (!verified?.vendType || !value) throw new Error("Verify the meter and enter an amount");
        created = await api.autoramp.vas.payUtility({
          ...base,
          meterNumber: entityNumber.trim(),
          vendType: verified.vendType,
        });
      }

      // Poll until the provider settles — prepaid tokens land in providerResponse.
      let tx = await api.autoramp.vas.transaction(created.transactionId);
      for (let i = 0; i < 10 && tx.status !== "COMPLETED" && tx.status !== "FAILED"; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        tx = await api.autoramp.vas.syncTransaction(created.transactionId);
      }

      setReceipt(tx);
      resetForm();
      void reloadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  }

  const needsVerification = kind === "CABLETV" || kind === "UTILITY";
  const amountFromBundle = (products ?? []).find((p) => p.bundleCode === bundleCode)?.amount;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)", paddingTop: "80px", paddingBottom: "60px" }}>
      <div className="mx-auto max-w-lg px-4">
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center gap-2 mb-4"
            style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--text-tertiary)", textDecoration: "none" }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Back
          </Link>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "28px", fontWeight: 800, color: "var(--text-primary)" }}>Pay Bills</h1>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
            {bankAccount
              ? `Debited from your account ${bankAccount.account_number}`
              : "Airtime, data, TV and electricity — paid from your Rampit account"}
          </p>
        </div>

        {!user ? (
          <div className="rounded-2xl p-6 text-center" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "14px", color: "var(--text-secondary)", marginBottom: "16px" }}>
              Sign in to pay bills from your Rampit account.
            </p>
            <button onClick={() => setAuthOpen(true)} className="btn-gold rounded-xl px-5 py-3 text-sm">Sign in</button>
          </div>
        ) : (
          <>
            {/* Service picker */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
                <button key={k} type="button"
                  onClick={() => { setKind(k); resetForm(); setReceipt(null); }}
                  className="py-3 rounded-xl transition-all duration-150"
                  style={{
                    fontFamily: "var(--font-body)", fontSize: "12px", fontWeight: 700, cursor: "pointer",
                    background: kind === k ? "var(--accent-muted)" : "var(--bg-secondary)",
                    border: `1px solid ${kind === k ? "var(--border-accent)" : "var(--border)"}`,
                    color: kind === k ? "var(--accent)" : "var(--text-secondary)",
                  }}>
                  {KIND_LABEL[k]}
                </button>
              ))}
            </div>

            <div className="rounded-2xl p-6 space-y-4" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
              {loadingServices && (
                <p style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--text-tertiary)" }}>Loading services…</p>
              )}

              {/* Provider — GET /autoramp/vas/services/{id}/categories */}
              <Field label="Provider">
                <select value={categoryId}
                  onChange={(e) => { setCategoryId(e.target.value); setBundleCode(""); setVerified(null); }}
                  className="input-dark w-full rounded-xl px-4 py-3" style={{ fontSize: "14px" }}>
                  <option value="">Select a provider</option>
                  {(categories ?? []).map((c) => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              </Field>

              {/* Meter / smartcard verification */}
              {needsVerification && (
                <>
                  <Field label={kind === "UTILITY" ? "Meter Number" : "Smartcard / IUC Number"}>
                    <div className="flex gap-2">
                      <input type="text" inputMode="numeric" value={entityNumber}
                        onChange={(e) => { setEntityNumber(e.target.value.replace(/\s/g, "")); setVerified(null); }}
                        placeholder={kind === "UTILITY" ? "12345678901" : "12345678901234"}
                        className="input-dark flex-1 rounded-xl px-4 py-3" style={{ fontSize: "14px", fontFamily: "var(--font-mono)" }} />
                      <button type="button" onClick={verifyEntity} disabled={busy || !categoryId || !entityNumber}
                        className="px-4 rounded-xl"
                        style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-primary)", fontFamily: "var(--font-body)", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                        Verify
                      </button>
                    </div>
                  </Field>

                  {verified && (
                    <div className="px-4 py-3 rounded-xl" style={{ background: "var(--accent-muted)", border: "1px solid var(--border-accent)" }}>
                      <p style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--text-tertiary)" }}>Account name</p>
                      <p style={{ fontFamily: "var(--font-body)", fontSize: "14px", fontWeight: 700, color: "var(--accent)" }}>{verified.name}</p>
                      {verified.vendType && (
                        <p style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-tertiary)", marginTop: "2px" }}>
                          {verified.vendType}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Bundle — GET /autoramp/vas/categories/{id}/products */}
              {(kind === "DATA" || kind === "CABLETV") && (
                <Field label={kind === "DATA" ? "Bundle" : "Bouquet"}>
                  <select value={bundleCode}
                    onChange={(e) => {
                      setBundleCode(e.target.value);
                      const product = (products ?? []).find((p) => p.bundleCode === e.target.value);
                      if (product) setAmount(String(product.amount));
                    }}
                    disabled={!categoryId}
                    className="input-dark w-full rounded-xl px-4 py-3" style={{ fontSize: "14px" }}>
                    <option value="">{categoryId ? "Select a plan" : "Choose a provider first"}</option>
                    {(products ?? []).map((p) => (
                      <option key={p._id} value={p.bundleCode}>
                        {p.name} — ₦{p.amount.toLocaleString()}
                      </option>
                    ))}
                  </select>
                </Field>
              )}

              {(kind === "AIRTIME" || kind === "DATA") && (
                <Field label="Phone Number">
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                    placeholder="08012345678"
                    className="input-dark w-full rounded-xl px-4 py-3" style={{ fontSize: "14px", fontFamily: "var(--font-mono)" }} />
                </Field>
              )}

              {(kind === "AIRTIME" || kind === "UTILITY") && (
                <Field label="Amount (NGN)">
                  <input type="text" inputMode="numeric" value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="1000"
                    className="input-dark w-full rounded-xl px-4 py-3" style={{ fontSize: "16px", fontFamily: "var(--font-mono)" }} />
                </Field>
              )}

              {amountFromBundle !== undefined && (
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--text-secondary)" }}>
                  You pay <span style={{ color: "var(--accent)", fontWeight: 700 }}>₦{amountFromBundle.toLocaleString()}</span>
                </p>
              )}

              {error && <p role="alert" style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--error)" }}>{error}</p>}

              <button type="button" onClick={pay}
                disabled={busy || !categoryId || (needsVerification && !verified)}
                className="btn-gold w-full rounded-2xl py-4 text-base font-bold">
                {busy ? "Processing…" : `Pay ${KIND_LABEL[kind]} →`}
              </button>

              {!bankAccount && (
                <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--text-tertiary)", textAlign: "center" }}>
                  You need a Rampit bank account to pay bills —{" "}
                  <Link href="/profile" style={{ color: "var(--accent)" }}>create one</Link>.
                </p>
              )}
            </div>

            {/* Receipt */}
            {receipt && (
              <div className="rounded-2xl p-5 mt-4 space-y-2" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-accent)" }}>
                <div className="flex items-center justify-between">
                  <p style={{ fontFamily: "var(--font-body)", fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>Receipt</p>
                  <StatusPill status={receipt.status} />
                </div>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-secondary)" }}>{receipt.reference}</p>
                {typeof receipt.providerResponse?.token === "string" && (
                  <div className="px-4 py-3 rounded-xl" style={{ background: "var(--accent-muted)", border: "1px solid var(--border-accent)" }}>
                    <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--text-tertiary)" }}>Meter token</p>
                    <p style={{ fontFamily: "var(--font-mono)", fontSize: "18px", fontWeight: 800, color: "var(--accent)", letterSpacing: "0.08em" }}>
                      {receipt.providerResponse.token as string}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Recent VAS transactions */}
            {(history?.data?.length ?? 0) > 0 && (
              <div className="rounded-2xl overflow-hidden mt-4" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                  <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>
                    Recent Payments
                  </p>
                </div>
                {(history?.data ?? []).map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                    <div>
                      <p style={{ fontFamily: "var(--font-body)", fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", textTransform: "capitalize" }}>
                        {tx.serviceType.replace("_", " ")}
                      </p>
                      <p style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-tertiary)" }}>
                        {new Date(tx.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p style={{ fontFamily: "var(--font-mono)", fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>
                        ₦{tx.amount.toLocaleString()}
                      </p>
                      <StatusPill status={tx.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
