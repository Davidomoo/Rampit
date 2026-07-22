"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth, KycStatus } from "@/lib/AuthContext";
import { api } from "@/lib/api";

export default function ProfilePage() {
  const { user, profile, orders, kycStatus, setKycOpen, bankAccount, refreshProfile, refreshBankAccount } = useAuth();
  const [editing, setEditing]   = useState(false);
  const [draft, setDraft]       = useState({ name: "", phone: "", country: "" });
  const [saving, setSaving]     = useState(false);
  const [saveError, setSaveError] = useState("");
  const [provisioning, setProvisioning] = useState(false);

  // Everything below comes from GET /users/me.
  const name = [profile?.firstname, profile?.lastname].filter(Boolean).join(" ") || "—";
  const phone = profile?.phone ?? "—";
  const country = profile?.country ?? "—";

  const completed = orders.filter((o) => o.status === "completed").length;
  const totalVol  = orders.filter((o) => o.status === "completed").reduce((s, o) => s + o.fiatAmount, 0);
  const initials  = user ? user.slice(0, 2).toUpperCase() : "?";
  const joined    = profile
    ? new Date(profile.created_at).toLocaleDateString("en-GB", { month: "long", year: "numeric" })
    : "—";

  useEffect(() => {
    if (!editing && profile) {
      setDraft({
        name: [profile.firstname, profile.lastname].filter(Boolean).join(" "),
        phone: profile.phone ?? "",
        country: profile.country ?? "",
      });
    }
  }, [editing, profile]);

  /** PATCH /users/me */
  async function save() {
    setSaving(true); setSaveError("");
    const [firstname, ...rest] = draft.name.trim().split(/\s+/);
    try {
      await api.users.updateMe({
        ...(firstname ? { firstname } : {}),
        ...(rest.length ? { lastname: rest.join(" ") } : {}),
        ...(draft.phone.trim() ? { phone: draft.phone.trim() } : {}),
        ...(draft.country.trim() ? { country: draft.country.trim() } : {}),
      });
      await refreshProfile();
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save your profile");
    } finally {
      setSaving(false);
    }
  }

  /** POST /users/me/bank-account — needs a phone number and, on SafeHaven, a verified ID. */
  async function provisionAccount() {
    setProvisioning(true);
    try {
      await api.users.provisionBankAccount({});
      await refreshBankAccount();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not create your bank account");
    } finally {
      setProvisioning(false);
    }
  }

  const KYC_BADGE: Record<KycStatus, React.ReactNode> = {
    unverified: (
      <button onClick={() => setKycOpen(true)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-colors duration-150"
        style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "var(--error)", fontFamily: "var(--font-body)", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>
        ✕ Unverified — <span style={{ textDecoration: "underline" }}>Verify now</span>
      </button>
    ),
    pending: (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
        style={{ background: "rgba(234,179,8,0.1)", color: "#ca8a04", fontFamily: "var(--font-body)", fontSize: "11px", fontWeight: 700 }}>
        ⏳ Pending Review
      </span>
    ),
    verified: (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
        style={{ background: "rgba(34,197,94,0.1)", color: "var(--success)", fontFamily: "var(--font-body)", fontSize: "11px", fontWeight: 700 }}>
        ✓ Verified
      </span>
    ),
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)", paddingTop: "80px", paddingBottom: "60px" }}>
      <div className="mx-auto max-w-2xl px-4">
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center gap-2 mb-4 transition-colors duration-200"
            style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--text-tertiary)", textDecoration: "none" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-tertiary)")}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Back
          </Link>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "28px", fontWeight: 800, color: "var(--text-primary)" }}>Profile</h1>
        </div>

        {/* KYC banner — only when unverified */}
        {kycStatus === "unverified" && (
          <div className="rounded-2xl px-5 py-4 mb-4 flex items-center justify-between gap-4"
            style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)", animation: "var(--animate-fade-in)" }}>
            <div className="flex items-start gap-3">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ color: "var(--error)", flexShrink: 0, marginTop: "1px" }}>
                <path d="M9 2L1.5 15.5h15L9 2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                <path d="M9 7v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="9" cy="13" r="0.8" fill="currentColor"/>
              </svg>
              <div>
                <p style={{ fontFamily: "var(--font-body)", fontSize: "13px", fontWeight: 700, color: "var(--error)", marginBottom: "2px" }}>Identity not verified</p>
                <p style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--text-secondary)" }}>Complete KYC to unlock higher transaction limits.</p>
              </div>
            </div>
            <button onClick={() => setKycOpen(true)}
              className="btn-gold px-4 py-2 rounded-xl text-sm flex-shrink-0"
              style={{ fontFamily: "var(--font-body)", fontWeight: 700 }}>
              Verify
            </button>
          </div>
        )}

        {/* Avatar card */}
        <div className="rounded-2xl p-6 mb-4 flex items-center gap-5"
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--accent)", color: "var(--bg-primary)", fontFamily: "var(--font-mono)", fontSize: "28px", fontWeight: 800 }}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p style={{ fontFamily: "var(--font-display)", fontSize: "22px", fontWeight: 800, color: "var(--text-primary)", marginBottom: "2px" }}>{name}</p>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--text-secondary)", marginBottom: "6px" }}>{user ?? "—"}</p>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--success)" }} />
              <span style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--text-tertiary)" }}>Joined {joined}</span>
            </div>
          </div>
          <button onClick={() => setEditing(true)}
            className="px-3 py-2 rounded-xl transition-colors duration-150 flex-shrink-0"
            style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-secondary)", fontFamily: "var(--font-body)", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
            Edit
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: "Total Orders", value: orders.length },
            { label: "Completed",    value: completed },
            { label: "Volume (NGN)", value: `₦${(totalVol / 1000).toFixed(0)}k` },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-2xl p-4 text-center" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "22px", fontWeight: 800, color: "var(--accent)", marginBottom: "4px" }}>{value}</p>
              <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--text-tertiary)" }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Info table */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
            <h2 style={{ fontFamily: "var(--font-body)", fontSize: "12px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>
              Account Details
            </h2>
          </div>
          {([
            ["Full Name",    name],
            ["Email",        user ?? "—"],
            ["Phone",        phone],
            ["Country",      country],
            ["Member Since", joined],
            ["Bank Account", bankAccount ? (
              <span key="acct" style={{ fontFamily: "var(--font-mono)" }}>
                {bankAccount.account_number}
                {typeof bankAccount.accountBalance === "number" && (
                  <span style={{ color: "var(--text-tertiary)", fontWeight: 400 }}>
                    {" "}· ₦{bankAccount.accountBalance.toLocaleString()}
                  </span>
                )}
              </span>
            ) : (
              <button key="provision" onClick={provisionAccount} disabled={provisioning}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontFamily: "var(--font-body)", fontSize: "13px", fontWeight: 600, textDecoration: "underline", padding: 0 }}>
                {provisioning ? "Creating…" : "Create account"}
              </button>
            )],
            ["KYC Status",   KYC_BADGE[kycStatus]],
          ] as [string, React.ReactNode][]).map(([label, value], i, arr) => (
            <div key={label} className="flex items-center justify-between px-5 py-3.5"
              style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none" }}>
              <span style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--text-tertiary)" }}>{label}</span>
              <span style={{ fontFamily: "var(--font-body)", fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }} onClick={() => setEditing(false)}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontFamily: "var(--font-body)", fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>Edit Profile</h3>
            {[
              { label: "Full Name", key: "name" as const, type: "text" },
              { label: "Phone",     key: "phone" as const, type: "tel" },
              { label: "Country",   key: "country" as const, type: "text" },
            ].map(({ label, key, type }) => (
              <div key={key}>
                <label style={{ fontFamily: "var(--font-body)", fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "6px" }}>{label}</label>
                <input type={type} value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                  className="input-dark w-full rounded-xl px-4 py-3" style={{ fontSize: "13px" }} />
              </div>
            ))}
            {saveError && (
              <p role="alert" style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--error)" }}>{saveError}</p>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setEditing(false)} disabled={saving}
                className="flex-1 py-3 rounded-xl"
                style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-secondary)", fontFamily: "var(--font-body)", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={save} disabled={saving} className="btn-gold flex-1 rounded-xl py-3 text-sm">
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
