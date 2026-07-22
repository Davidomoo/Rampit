"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useUsdNgnRate } from "@/hooks/useApi";
import { api } from "@/lib/api";
import type { RampNetwork } from "@/lib/api/types";

// ── Types ────────────────────────────────────────────────────────────────────
type Token      = "USDT" | "USDC" | "CELO" | "SOL" | "XLM";
type FiatCode   = "NGN" | "GHS" | "KES";
type Step       = 1 | 2 | 3;
type ModalState = "bank" | "confirming" | "success" | "failed" | null;

// ── Constants ────────────────────────────────────────────────────────────────
const NETWORK_FEE_FIAT: Record<FiatCode, number> = { NGN: 500,   GHS: 5,    KES: 65  };
const MIN_ORDER_FIAT:   Record<FiatCode, number> = { NGN: 1_000, GHS: 10,   KES: 130 };
const USD_RATES:        Record<FiatCode, number> = { NGN: 1_620, GHS: 15.4, KES: 130 };
const TOKEN_USD_PRICE:  Record<Token,    number> = { USDT: 1, USDC: 1, CELO: 0.72, SOL: 148, XLM: 0.11 };
const COUNTDOWN_SECONDS = 1800;
const MIN_WALLET_LENGTH = 10;
const BANK_LOADING_MS   = 1800;
const CONFIRM_DURATION  = 3000;

function validateWalletAddress(address: string, network: string): string {
  if (!address) return "";
  const pattern = WALLET_PATTERNS[network];
  if (!pattern) return "";
  if (!pattern.test(address.trim())) {
    const hints: Record<string, string> = {
      "TRC-20": "Must start with T and be 34 characters (TRON address)",
      "ERC-20": "Must start with 0x and be 42 characters (Ethereum address)",
      "BEP-20": "Must start with 0x and be 42 characters (BSC address)",
      "Celo Network": "Must start with 0x and be 42 characters (Celo address)",
      "Solana": "Must be a valid base58 Solana address (32–44 characters)",
      "Stellar": "Must start with G and be 56 characters (Stellar address)",
    };
    return hints[network] ?? "Invalid wallet address for selected network";
  }
  return "";
}

const FIAT_CURRENCIES: { code: FiatCode; name: string; symbol: string; icon: string }[] = [
  { code: "NGN", name: "Nigerian Naira",  symbol: "₦",   icon: "/icons/country/nigeria-ngn.png" },
  { code: "GHS", name: "Ghanaian Cedi",   symbol: "₵",   icon: "/icons/country/ghana-ghs.png"   },
  { code: "KES", name: "Kenyan Shilling", symbol: "KSh", icon: "/icons/country/kenya-kes.png"   },
];

const TOKENS: { id: Token; name: string; icon: string }[] = [
  { id: "USDT", name: "Tether",   icon: "/icons/crypto/tether-usdt.svg"  },
  { id: "USDC", name: "USD Coin", icon: "/icons/crypto/usdcoin-usdc.svg" },
  { id: "CELO", name: "Celo",     icon: "/icons/crypto/celo-celo.svg"    },
  { id: "SOL",  name: "Solana",   icon: "/icons/crypto/solana-sol.svg"   },
  { id: "XLM",  name: "Stellar",  icon: "/icons/crypto/stellar-xlm.svg"  },
];

const NETWORKS: Record<Token, string[]> = {
  USDT: ["TRC-20", "ERC-20", "BEP-20"],
  USDC: ["ERC-20", "BEP-20"],
  CELO: ["Celo Network"],
  SOL:  ["Solana"],
  XLM:  ["Stellar"],
};

const MEMO_REQUIRED: Record<string, boolean> = {
  "Stellar": true,
};

const WALLET_PATTERNS: Record<string, RegExp> = {
  "TRC-20": /^T[A-Za-z1-9]{33}$/,
  "ERC-20": /^0x[a-fA-F0-9]{40}$/,
  "BEP-20": /^0x[a-fA-F0-9]{40}$/,
  "Celo Network": /^0x[a-fA-F0-9]{40}$/,
  "Solana": /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  "Stellar": /^G[A-Z2-7]{55}$/,
};

/** Fallback shown for corridors AutoRamp doesn't serve yet (GHS / KES). */
const BANK_DETAILS: Record<FiatCode, { bank: string; account: string; name: string }> = {
  NGN: { bank: "Providus Bank",  account: "1234567890", name: "RAMPIT ESCROW LTD" },
  GHS: { bank: "Ecobank Ghana",  account: "0012345678", name: "RAMPIT ESCROW LTD" },
  KES: { bank: "Equity Bank KE", account: "0098765432", name: "RAMPIT ESCROW LTD" },
};

/**
 * UI network → AutoRamp settlement network. Only NGN on these chains can be
 * fulfilled by POST /autoramp/ramp/onramp; anything else falls back to the
 * legacy escrow flow.
 */
const RAMP_NETWORKS: Record<string, RampNetwork> = {
  "ERC-20": "base",
  "BEP-20": "bsc",
};

/** The live deposit account returned by an on-ramp we just created. */
type DepositAccount = { bank: string; account: string; name: string };

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatFiat(val: string): string {
  const digits = val.replace(/[^0-9]/g, "");
  return digits ? Number(digits).toLocaleString("en") : "";
}
function formatTime(s: number): string {
  return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}
function calcCrypto(rawFiat: number, fiat: FiatCode, token: Token, fee: number, usdRate: number): string {
  if (rawFiat < MIN_ORDER_FIAT[fiat]) return "—";
  const usd = (rawFiat - fee) / usdRate;
  return (usd / TOKEN_USD_PRICE[token]).toFixed(["SOL", "CELO"].includes(token) ? 4 : 2);
}

// ── Primitives ───────────────────────────────────────────────────────────────
function FiatIcon({ code, size = 28 }: { code: FiatCode; size?: number }) {
  const f = FIAT_CURRENCIES.find((x) => x.code === code)!;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={f.icon} alt={f.name} width={size} height={size} className="rounded-full flex-shrink-0 object-cover" />;
}
function TokenIcon({ token, size = 26 }: { token: Token; size?: number }) {
  const t = TOKENS.find((x) => x.id === token)!;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={t.icon} alt={t.name} width={size} height={size} className="rounded-full flex-shrink-0" />;
}
function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} style={{ fontFamily: "var(--font-body)", fontSize: "14px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "8px" }}>
      {children}
    </label>
  );
}
function FieldError({ id, message, show }: { id: string; message: string; show: boolean }) {
  return (
    <p id={id} role="alert" className={`field-error${show ? " visible" : ""}`} style={{ fontSize: "13px" }}>
      {message || "\u00A0"}
    </p>
  );
}
function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"
      style={{ color: "var(--text-tertiary)", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s ease", flexShrink: 0 }}>
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function Skeleton({ w, h = 14 }: { w: string; h?: number }) {
  return <span className="inline-block rounded-lg animate-pulse" style={{ width: w, height: h, background: "var(--bg-tertiary)", display: "block" }} />;
}
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  }
  return (
    <button type="button" onClick={copy} aria-label="Copy to clipboard"
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all duration-200"
      style={{
        background: copied ? "var(--accent-muted)" : "var(--bg-secondary)",
        border: `1px solid ${copied ? "var(--border-accent)" : "var(--border)"}`,
        color: copied ? "var(--accent)" : "var(--text-tertiary)",
        cursor: "pointer", fontSize: "11px", fontFamily: "var(--font-body)", fontWeight: 600,
      }}>
      {copied ? (
        <><svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true"><path d="M1.5 5.5l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>Copied</>
      ) : (
        <><svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true"><rect x="3.5" y="1" width="6" height="7" rx="1" stroke="currentColor" strokeWidth="1.2" /><path d="M1.5 3.5H1a1 1 0 0 0-1 1V10a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1V9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>Copy</>
      )}
    </button>
  );
}

// ── Bank Details Modal ───────────────────────────────────────────────────────
function BankModal({
  open, bankReady, fiat, raw, cryptoAmt, token, wallet, network, memo, timeLeft, expired,
  bankDetails, reference, error, onSent, onClose,
}: {
  open: boolean; bankReady: boolean; fiat: FiatCode; raw: number; cryptoAmt: string;
  token: Token; wallet: string; network: string; memo: string; timeLeft: number; expired: boolean;
  bankDetails: DepositAccount; reference: string | null; error: string;
  onSent: () => void; onClose: () => void;
}) {
  if (!open) return null;
  const fiatMeta = FIAT_CURRENCIES.find((f) => f.code === fiat)!;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)", animation: "var(--animate-fade-in)" }}
      role="dialog" aria-modal="true" aria-label="Bank transfer details">

      {/* Sheet */}
      <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl overflow-hidden"
        style={{ background: "var(--bg-secondary)", animation: "var(--animate-fade-in-up)" }}>

        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full" style={{ background: "var(--border)" }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-4 pb-5">
          <div>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: "4px" }}>
              Send Payment
            </p>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "26px", fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>
              {fiatMeta.symbol}{raw.toLocaleString("en")}
              <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-tertiary)", marginLeft: "6px" }}>{fiat}</span>
            </p>
          </div>
          <button onClick={onClose} aria-label="Close"
            className="w-8 h-8 flex items-center justify-center rounded-full transition-colors duration-200"
            style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-secondary)", cursor: "pointer" }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Receiving summary pill */}
        <div className="mx-6 mb-5 flex items-center gap-3 px-4 py-3 rounded-2xl"
          style={{ background: "var(--accent-muted)", border: "1px solid var(--border-accent)" }}>
          <TokenIcon token={token} size={28} />
          <div>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--text-tertiary)", marginBottom: "1px" }}>You will receive</p>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "16px", fontWeight: 700, color: "var(--accent)" }}>
              {cryptoAmt} {token}
            </p>
          </div>
          <div className="ml-auto text-right">
            <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--text-tertiary)", marginBottom: "1px" }}>Network</p>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>{network}</p>
          </div>
        </div>

        {/* Bank details card */}
        <div className="mx-6 mb-5 rounded-2xl overflow-hidden" style={{ border: `1px solid ${error ? "rgba(239,68,68,0.35)" : "var(--border)"}` }}>
          {error ? (
            /* Never fall back to a placeholder account — the user would pay the wrong one. */
            <div className="p-5" style={{ background: "rgba(239,68,68,0.06)" }} role="alert">
              <p style={{ fontFamily: "var(--font-body)", fontSize: "13px", fontWeight: 700, color: "var(--error)", marginBottom: "4px" }}>
                Couldn&apos;t create this order
              </p>
              <p style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                {error} — close this and try again. No payment details were issued, so please don&apos;t transfer anything yet.
              </p>
            </div>
          ) : !bankReady ? (
            <div className="p-5 space-y-4" style={{ background: "var(--bg-tertiary)" }}>
              <Skeleton w="40%" h={12} />
              {[0,1,2].map(i => (
                <div key={i} className="flex justify-between items-center">
                  <Skeleton w="55px" h={11} />
                  <Skeleton w={i===1?"45%":"55%"} h={11} />
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Bank name header */}
              <div className="px-5 py-3 flex items-center gap-2" style={{ background: "var(--bg-tertiary)", borderBottom: "1px solid var(--border)" }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "var(--accent-muted)" }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" style={{ color: "var(--accent)" }}>
                    <path d="M1 5.5L7 2l6 3.5V6H1v-.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                    <path d="M2.5 6v4.5M5.5 6v4.5M8.5 6v4.5M11.5 6v4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    <path d="M1 10.5h12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                </div>
                <span style={{ fontFamily: "var(--font-body)", fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>{bankDetails.bank}</span>
              </div>

              {/* Account number — hero row */}
              <div className="px-5 py-4" style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
                <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--text-tertiary)", marginBottom: "6px", letterSpacing: "0.08em", textTransform: "uppercase" }}>Account Number</p>
                <div className="flex items-center justify-between gap-3">
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "22px", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "0.06em" }}>
                    {bankDetails.account}
                  </span>
                  <CopyButton text={bankDetails.account} />
                </div>
              </div>

              {/* Account name */}
              <div className="px-5 py-3 flex items-center justify-between" style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--text-tertiary)" }}>Account Name</span>
                <span style={{ fontFamily: "var(--font-body)", fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>{bankDetails.name}</span>
              </div>

              {/* Reference — present once a real on-ramp has been created */}
              {reference && (
                <div className="px-5 py-3 flex items-center justify-between gap-3" style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--text-tertiary)" }}>Reference</span>
                  <span className="flex items-center gap-2">
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>{reference}</span>
                    <CopyButton text={reference} />
                  </span>
                </div>
              )}

              {/* Countdown */}
              <div className="px-5 py-3 flex items-center justify-between" style={{ background: "var(--bg-secondary)" }}>
                <div className="flex items-center gap-1.5">
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true" style={{ color: "var(--text-tertiary)" }}>
                    <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M6.5 3.5v3.2l2 1.3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--text-tertiary)" }}>Expires in</span>
                </div>
                {expired ? (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "13px", fontWeight: 700, color: "var(--error)" }}>Order expired</span>
                ) : (
                  <span aria-live="polite" style={{ fontFamily: "var(--font-mono)", fontSize: "16px", fontWeight: 800, color: timeLeft < 300 ? "var(--error)" : "var(--accent)" }}>
                    {formatTime(timeLeft)}
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Wallet summary */}
        <div className="mx-6 mb-5 px-4 py-3 rounded-xl" style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-3">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" style={{ color: "var(--text-tertiary)", flexShrink: 0 }}>
              <rect x="1" y="4" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M9 8a1 1 0 1 0 2 0 1 1 0 0 0-2 0z" stroke="currentColor" strokeWidth="1.2" />
              <path d="M4 4V3a2 2 0 0 1 4 0v1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-secondary)", wordBreak: "break-all", flex: 1 }}>
              {wallet.slice(0, 14)}…{wallet.slice(-8)}
            </span>
          </div>
          {memo && (
            <div className="flex items-center gap-3 mt-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" style={{ color: "var(--text-tertiary)", flexShrink: 0 }}>
                <path d="M2 3h10M2 7h7M2 11h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              <span style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--text-tertiary)" }}>Memo:</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-secondary)", fontWeight: 600 }}>{memo}</span>
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="px-6 pb-6 space-y-3">
          <button type="button" onClick={onSent} disabled={!bankReady || expired || !!error}
            className="btn-gold w-full rounded-2xl py-4 text-base font-bold flex items-center justify-center gap-2">
            I&apos;ve Sent the Payment →
          </button>
          <p className="text-center" style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--text-tertiary)" }}>
            By proceeding you agree to our{" "}
            <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: "var(--text-secondary)", textDecoration: "underline" }}>Terms</a>
            {" & "}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "var(--text-secondary)", textDecoration: "underline" }}>Privacy</a>
            {" · "}Powered by RAMPIT
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Confirm / Result Modal ───────────────────────────────────────────────────
function ConfirmModal({
  state, fiat, raw, cryptoAmt, token, wallet, network, memo, onClose,
}: {
  state: Exclude<ModalState, "bank" | null>; fiat: FiatCode; raw: number;
  cryptoAmt: string; token: Token; wallet: string; network: string; memo: string; onClose: () => void;
}) {
  const fiatMeta = FIAT_CURRENCIES.find((f) => f.code === fiat)!;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", animation: "var(--animate-fade-in)" }}
      role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-2xl p-6 flex flex-col items-center text-center gap-4"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", animation: "var(--animate-fade-in-up)" }}>

        {state === "confirming" && (
          <>
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ border: "2px solid var(--border)" }}>
              <svg className="animate-spin" width="28" height="28" viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="14" r="11" stroke="var(--border)" strokeWidth="2.5" />
                <path d="M14 3a11 11 0 0 1 11 11" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <p style={{ fontFamily: "var(--font-body)", fontWeight: 700, fontSize: "17px", color: "var(--text-primary)" }}>Confirming Payment</p>
              <p style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--text-secondary)", marginTop: "6px" }}>
                Verifying your transfer of{" "}
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)", fontWeight: 600 }}>
                  {fiatMeta.symbol}{raw.toLocaleString("en")} {fiat}
                </span>
              </p>
            </div>
            <div className="w-full rounded-xl px-4 py-3 space-y-2" style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)" }}>
              {([["Receiving", `${cryptoAmt} ${token}`], ["Network", network], ["Wallet", `${wallet.slice(0,10)}…${wallet.slice(-6)}`], ...(memo ? [["Memo", memo]] : [])] as [string,string][]).map(([l, v]) => (
                <div key={l} className="flex justify-between">
                  <span style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--text-tertiary)" }}>{l}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-primary)", fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--text-tertiary)" }}>This usually takes a few seconds…</p>
          </>
        )}

        {state === "success" && (
          <>
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)" }}>
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M6 14l6 6 10-10" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <p style={{ fontFamily: "var(--font-body)", fontWeight: 700, fontSize: "18px", color: "var(--text-primary)" }}>Payment Successful!</p>
              <p style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--text-secondary)", marginTop: "6px" }}>
                Your wallet has been funded with{" "}
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--success)", fontWeight: 700 }}>{cryptoAmt} {token}</span>
              </p>
            </div>
            <div className="w-full rounded-xl px-4 py-3" style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)" }}>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-secondary)", wordBreak: "break-all" }}>{wallet}</p>
            </div>
            <button onClick={onClose} className="btn-gold w-full rounded-xl py-3 text-sm">Done</button>
          </>
        )}

        {state === "failed" && (
          <>
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)" }}>
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M8 8l12 12M20 8L8 20" stroke="var(--error)" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <p style={{ fontFamily: "var(--font-body)", fontWeight: 700, fontSize: "18px", color: "var(--text-primary)" }}>Payment Not Found</p>
              <p style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--text-secondary)", marginTop: "6px" }}>
                We couldn&apos;t verify your transfer. Please check your bank and try again.
              </p>
            </div>
            <button onClick={onClose} className="w-full rounded-xl py-3 text-sm font-semibold"
              style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-primary)", cursor: "pointer", fontFamily: "var(--font-body)" }}>
              Try Again
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function BuyForm() {
  const { user, setAuthOpen, savedWallets, kycStatus, setKycOpen, refreshOrders } = useAuth();
  const { data: liveRate } = useUsdNgnRate();
  const [step, setStep]           = useState<Step>(1);
  const [fiat, setFiat]           = useState<FiatCode>("NGN");
  const [fiatOpen, setFiatOpen]   = useState(false);
  const [amount, setAmount]       = useState("");
  const [token, setToken]         = useState<Token>("USDT");
  const [tokenOpen, setTokenOpen] = useState(false);
  const [wallet, setWallet]       = useState("");
  const [memo, setMemo]           = useState("");
  const [network, setNetwork]     = useState(NETWORKS["USDT"][0]);
  const [networkOpen, setNetworkOpen] = useState(false);
  const [savedOpen, setSavedOpen]     = useState(false);
  const [timeLeft, setTimeLeft]   = useState(COUNTDOWN_SECONDS);
  const [bankReady, setBankReady] = useState(false);
  const [modal, setModal]         = useState<ModalState>(null);
  const [deposit, setDeposit]     = useState<DepositAccount | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [rampError, setRampError] = useState("");
  const timerRef                  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fiatMeta  = FIAT_CURRENCIES.find((f) => f.code === fiat)!;
  const fee       = NETWORK_FEE_FIAT[fiat];
  const minOrder  = MIN_ORDER_FIAT[fiat];
  const raw       = parseFloat(amount.replace(/,/g, "")) || 0;
  // Live USD/NGN from GET /autoramp/rates/usd-ngn; static table for other corridors.
  const usdRate   = fiat === "NGN" && liveRate?.rate ? liveRate.rate : USD_RATES[fiat];
  const cryptoAmt = calcCrypto(raw, fiat, token, fee, usdRate);
  const rampNetwork = fiat === "NGN" ? RAMP_NETWORKS[network] : undefined;

  // Countdown — only when bank modal is open
  useEffect(() => {
    if (modal !== "bank") return;
    const id = setInterval(() => setTimeLeft((t) => (t > 0 ? t - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [modal]);

  /**
   * Create the on-ramp as soon as the bank modal opens for a supported
   * corridor — the deposit account we show comes back from the API. Anything
   * else falls back to the static escrow account after a short skeleton.
   */
  useEffect(() => {
    if (modal !== "bank") { setBankReady(false); return; }

    if (!rampNetwork) {
      setDeposit(null);
      setReference(null);
      const id = setTimeout(() => setBankReady(true), BANK_LOADING_MS);
      return () => clearTimeout(id);
    }

    let cancelled = false;
    setRampError("");
    api.autoramp
      .onramp({ network: rampNetwork, amount: raw, destination: { address: wallet.trim() } })
      .then((tx) => {
        if (cancelled) return;
        setReference(tx.reference);
        if (tx.depositAccount) {
          setDeposit({
            bank: tx.depositAccount.bankName,
            account: tx.depositAccount.accountNumber,
            name: tx.depositAccount.accountName,
          });
        }
        setBankReady(true);
        void refreshOrders();
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setRampError(err instanceof Error ? err.message : "Could not start this order");
        setBankReady(true);
      });

    return () => { cancelled = true; };
  }, [modal, rampNetwork, raw, wallet, refreshOrders]);

  useEffect(() => { setNetwork(NETWORKS[token][0]); setWallet(""); setMemo(""); }, [token]);
  useEffect(() => { setAmount(""); setStep(1); }, [fiat]);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const pendingBank = useRef(false);

  const handlePaste = useCallback(async () => {
    try { setWallet((await navigator.clipboard.readText()).trim()); } catch {}
  }, []);

  // After login completes, open bank modal (or KYC if needed) if it was pending
  useEffect(() => {
    if (user && pendingBank.current) {
      pendingBank.current = false;
      const usdAmount = raw / usdRate;
      if (kycStatus === "unverified" && usdAmount > 50) { setKycOpen(true); return; }
      setTimeLeft(COUNTDOWN_SECONDS);
      setModal("bank");
    }
  }, [user]);

  function openBankModal() {
    if (!user) { pendingBank.current = true; setAuthOpen(true); return; }
    const usdAmount = raw / usdRate;
    if (kycStatus === "unverified" && usdAmount > 50) { setKycOpen(true); return; }
    setTimeLeft(COUNTDOWN_SECONDS);
    setModal("bank");
  }

  /** Poll GET /autoramp/ramp/transactions until the on-ramp settles. */
  async function waitForOnramp(ref: string) {
    const deadline = Date.now() + 3 * 60_000;
    while (Date.now() < deadline) {
      const result = await api.autoramp.transactions({ reference: ref, limit: 1 });
      const tx = [...(result.onramp ?? []), ...(result.offramp ?? [])][0];
      if (tx?.status === "COMPLETED") return true;
      if (tx?.status === "FAILED" || tx?.status === "CANCELLED") return false;
      await new Promise((r) => setTimeout(r, 5000));
    }
    return false;
  }

  async function handleSentPayment() {
    setModal("confirming");

    // Real on-ramp: the backend tells us when the transfer lands.
    if (reference) {
      try {
        const settled = await waitForOnramp(reference);
        setModal(settled ? "success" : "failed");
      } catch {
        setModal("failed");
      } finally {
        void refreshOrders();
      }
      return;
    }

    try {
      const chainMap: Record<string, string> = {
        "Stellar":      "stellar",
        "Celo Network": "celo",
        "BEP-20":       "bnb",
        "ERC-20":       "base",
        "TRC-20":       "stellar",
        "Solana":       "stellar", // placeholder until Solana contract is live
      };
      const chain = chainMap[network] ?? "stellar";
      const orderId = `RMP-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

      const res = await fetch("/api/escrow/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, chain }),
      });

      const data = await res.json().catch(() => null);
      setModal(res.ok && data?.success ? "success" : "failed");
    } catch {
      setModal("failed");
    }
  }

  function handleModalClose() {
    setModal(null);
    setStep(1);
    setAmount("");
    setWallet("");
    setMemo("");
    setTimeLeft(COUNTDOWN_SECONDS);
    setBankReady(false);
    setDeposit(null);
    setReference(null);
    setRampError("");
  }

  const amountError = raw > 0 && raw < minOrder
    ? `Minimum order is ${fiatMeta.symbol}${minOrder.toLocaleString("en")}` : "";
  const walletError = wallet.length > 0 ? validateWalletAddress(wallet, network) : "";
  const memoRequired = MEMO_REQUIRED[network] ?? false;
  const memoError = memoRequired && memo.trim().length === 0 && wallet.length > 0 ? "Memo is required for Stellar transactions" : "";

  const dropdownStyle = {
    background: "var(--bg-tertiary)" as const,
    border: "1px solid var(--border-accent)",
    boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
  };

  return (
    <>
      {/* Bank details modal */}
      <BankModal
        open={modal === "bank"}
        bankReady={bankReady}
        fiat={fiat} raw={raw} cryptoAmt={cryptoAmt} token={token}
        wallet={wallet} network={network} memo={memo} timeLeft={timeLeft} expired={timeLeft === 0}
        bankDetails={deposit ?? BANK_DETAILS[fiat]}
        reference={reference}
        error={rampError}
        onSent={handleSentPayment}
        onClose={handleModalClose}
      />

      {/* Confirm / result modal */}
      {modal && modal !== "bank" && (
        <ConfirmModal
          state={modal}
          fiat={fiat} raw={raw} cryptoAmt={cryptoAmt} token={token}
          wallet={wallet} network={network} memo={memo}
          onClose={handleModalClose}
        />
      )}

      <section className="px-4 pb-20">
        <div className="mx-auto w-full max-w-lg rounded-2xl"
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", animation: "var(--animate-fade-in)" }}>

          {/* Card header */}
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontFamily: "var(--font-body)", fontSize: "12px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>
              Buy Crypto
            </span>
            <span className="flex items-center gap-2" style={{ fontFamily: "var(--font-body)", fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)" }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--success)" }} />
              Rates updating live
            </span>
          </div>

          <div className="p-6 space-y-5">

            {/* ── Amount + fiat ── */}
            <div>
              <FieldLabel htmlFor="fiat-amount">You Pay</FieldLabel>
              <div className="flex gap-2">
                <div className="relative flex items-center flex-1">
                  <span aria-hidden="true" className="absolute left-3 select-none"
                    style={{ fontFamily: "var(--font-mono)", fontSize: "15px", color: "var(--text-tertiary)" }}>
                    {fiatMeta.symbol}
                  </span>
                  <input id="fiat-amount" type="text" inputMode="numeric" placeholder="10,000"
                    value={amount} disabled={step === 3}
                    onChange={(e) => { const f = formatFiat(e.target.value); setAmount(f); if (!f) setStep(1); }}
                    className="input-dark w-full rounded-xl py-3.5 text-xl"
                    style={{ paddingLeft: fiatMeta.symbol.length > 1 ? "44px" : "32px", paddingRight: "12px" }}
                    aria-label={`Amount in ${fiatMeta.name}`} aria-describedby="amount-error" />
                </div>
                <div className="relative">
                  <button id="fiat-btn" type="button" onClick={() => setFiatOpen((o) => !o)}
                    className="h-full flex items-center gap-2 px-3 rounded-xl transition-colors duration-200"
                    style={{ background: "var(--bg-tertiary)", border: `1px solid ${fiatOpen ? "var(--border-accent)" : "var(--border)"}`, color: "var(--text-primary)", cursor: "pointer", minWidth: "90px" }}
                    aria-haspopup="listbox" aria-expanded={fiatOpen} aria-label="Select currency">
                    <FiatIcon code={fiat} size={26} />
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "15px", fontWeight: 700 }}>{fiat}</span>
                    <Chevron open={fiatOpen} />
                  </button>
                  {fiatOpen && (
                    <div className="absolute top-full right-0 mt-1 rounded-xl overflow-hidden z-20 w-52" style={dropdownStyle} role="listbox">
                      {FIAT_CURRENCIES.map((f) => (
                        <button key={f.code} type="button" role="option" aria-selected={fiat === f.code}
                          onClick={() => { setFiat(f.code); setFiatOpen(false); }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors duration-150"
                          style={{ background: fiat === f.code ? "var(--accent-muted)" : "transparent", color: "var(--text-primary)", fontFamily: "var(--font-body)", fontSize: "14px", cursor: "pointer", borderBottom: "1px solid var(--border)" }}>
                          <FiatIcon code={f.code} size={24} />
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "14px", fontWeight: 600 }}>{f.code}</span>
                          <span style={{ color: "var(--text-tertiary)", fontSize: "12px" }}>{f.name}</span>
                          {fiat === f.code && <span className="ml-auto" style={{ color: "var(--accent)" }}>✓</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <FieldError id="amount-error" message={amountError} show={!!amountError} />
            </div>

            {/* ── Token selector ── */}
            <div>
              <FieldLabel htmlFor="token-btn">You Receive</FieldLabel>
              <div className="relative">
                <button id="token-btn" type="button" onClick={() => setTokenOpen((o) => !o)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors duration-200"
                  style={{ background: "var(--bg-tertiary)", border: `1px solid ${tokenOpen ? "var(--border-accent)" : "var(--border)"}`, color: "var(--text-primary)", fontFamily: "var(--font-body)", fontSize: "15px", cursor: "pointer" }}
                  aria-haspopup="listbox" aria-expanded={tokenOpen} aria-label="Select token">
                  <span className="flex items-center gap-3">
                    <TokenIcon token={token} />
                    <span style={{ fontWeight: 600 }}>{token}</span>
                    <span style={{ color: "var(--text-tertiary)", fontSize: "13px" }}>{TOKENS.find((t) => t.id === token)?.name}</span>
                  </span>
                  <div className="flex items-center gap-3">
                    {raw >= minOrder && <span style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--accent)", fontWeight: 600 }}>{cryptoAmt}</span>}
                    <Chevron open={tokenOpen} />
                  </div>
                </button>
                {tokenOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-20" style={dropdownStyle} role="listbox">
                    {TOKENS.map((t) => (
                      <button key={t.id} type="button" role="option" aria-selected={token === t.id}
                        onClick={() => { setToken(t.id); setTokenOpen(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors duration-150"
                        style={{ background: token === t.id ? "var(--accent-muted)" : "transparent", color: "var(--text-primary)", fontFamily: "var(--font-body)", fontSize: "14px", cursor: "pointer", borderBottom: "1px solid var(--border)" }}>
                        <TokenIcon token={t.id} />
                        <span style={{ fontWeight: 600 }}>{t.id}</span>
                        <span style={{ color: "var(--text-tertiary)", fontSize: "12px" }}>{t.name}</span>
                        {token === t.id && <span className="ml-auto" style={{ color: "var(--accent)" }}>✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Rate info ── */}
            {raw >= minOrder && step === 1 && (
              <div className="rounded-xl px-4 py-3" style={{ background: "var(--accent-muted)", border: "1px solid var(--border-accent)", animation: "var(--animate-fade-in)" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-secondary)" }}>
                  Rate: <span style={{ color: "var(--text-primary)" }}>{fiatMeta.symbol}{usdRate.toLocaleString("en", { maximumFractionDigits: 2 })} / USD</span>
                  <span style={{ margin: "0 8px", opacity: 0.3 }}>·</span>
                  Fee: <span style={{ color: "var(--text-primary)" }}>~{fiatMeta.symbol}{fee.toLocaleString("en")}</span>
                  <span style={{ margin: "0 8px", opacity: 0.3 }}>·</span>
                  Est. <span style={{ color: "var(--text-primary)" }}>3–8 mins</span>
                </div>
              </div>
            )}

            {/* ── Step 1 CTA ── */}
            {step === 1 && (
              <button type="button" onClick={() => raw >= minOrder && !amountError && setStep(2)}
                disabled={raw < minOrder || !!amountError} className="btn-gold w-full rounded-xl py-3.5 text-base">
                Continue →
              </button>
            )}

            {/* ── Step 2: wallet + network ── */}
            {step === 2 && (
              <>
                <div className="h-px" style={{ background: "var(--border)" }} />

                {/* Network selector — only shown when token has multiple networks */}
                {NETWORKS[token].length > 1 && (
                  <div>
                    <FieldLabel htmlFor="network-btn">Network</FieldLabel>
                    <div className="relative">
                      <button id="network-btn" type="button" onClick={() => setNetworkOpen((o) => !o)}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors duration-200"
                        style={{ background: "var(--bg-tertiary)", border: `1px solid ${networkOpen ? "var(--border-accent)" : "var(--border)"}`, color: "var(--text-primary)", fontFamily: "var(--font-body)", fontSize: "14px", cursor: "pointer" }}
                        aria-haspopup="listbox" aria-expanded={networkOpen} aria-label="Select network">
                        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>{network}</span>
                        <Chevron open={networkOpen} />
                      </button>
                      {networkOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-20" style={dropdownStyle} role="listbox">
                          {NETWORKS[token].map((net) => (
                            <button key={net} type="button" role="option" aria-selected={network === net}
                              onClick={() => { setNetwork(net); setNetworkOpen(false); setWallet(""); setMemo(""); }}
                              className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors duration-150"
                              style={{ background: network === net ? "var(--accent-muted)" : "transparent", color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: "13px", fontWeight: 600, cursor: "pointer", borderBottom: "1px solid var(--border)" }}>
                              {net}
                              {network === net && <span style={{ color: "var(--accent)" }}>✓</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Wallet address */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="wallet-address" style={{ fontFamily: "var(--font-body)", fontSize: "14px", fontWeight: 600, color: "var(--text-secondary)" }}>
                      Receiving Wallet Address
                    </label>
                    {user && savedWallets.filter((w) => w.network === network).length > 0 && (
                      <button type="button" onClick={() => setSavedOpen(true)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all duration-200"
                        style={{ background: "var(--accent-muted)", border: "1px solid var(--border-accent)", color: "var(--accent)", fontFamily: "var(--font-body)", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}>
                        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
                          <rect x="1" y="3" width="9" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
                          <path d="M7 5.5a1 1 0 1 0 2 0 1 1 0 0 0-2 0z" stroke="currentColor" strokeWidth="1.2" />
                          <path d="M3 3V2.5A1.5 1.5 0 0 1 4.5 1h2A1.5 1.5 0 0 1 8 2.5V3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                        </svg>
                        Saved
                      </button>
                    )}
                  </div>
                  <div className="relative flex items-center">
                    <input id="wallet-address" type="text"
                      placeholder={
                        network === "TRC-20" ? "T... (TRON address)" :
                        network === "Solana" ? "Solana base58 address" :
                        network === "Stellar" ? "G... (Stellar address)" :
                        "0x... address"
                      }
                      value={wallet} onChange={(e) => setWallet(e.target.value.trim())}
                      className="input-dark w-full rounded-xl px-4 py-3 pr-12" style={{ fontSize: "13px" }}
                      spellCheck={false} autoComplete="off" aria-describedby="wallet-error" />
                    <button type="button" aria-label="Paste wallet address from clipboard" onClick={handlePaste}
                      className="absolute right-3 p-1 transition-colors duration-200"
                      style={{ color: "var(--text-tertiary)", background: "none", border: "none", cursor: "pointer" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-tertiary)")}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <rect x="5" y="2" width="8" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
                        <path d="M3 5H2.5A1.5 1.5 0 0 0 1 6.5v7A1.5 1.5 0 0 0 2.5 15h7A1.5 1.5 0 0 0 11 13.5V13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                  <FieldError id="wallet-error" message={walletError} show={!!walletError} />
                </div>

                {/* Saved wallets picker modal */}
                {savedOpen && (
                  <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4"
                    style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)" }}
                    onClick={() => setSavedOpen(false)}>
                    <div className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl overflow-hidden"
                      style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", animation: "var(--animate-fade-in-up)" }}
                      onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-center pt-3 pb-1 sm:hidden">
                        <div className="w-10 h-1 rounded-full" style={{ background: "var(--border)" }} />
                      </div>
                      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
                        <p style={{ fontFamily: "var(--font-body)", fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
                          Saved Wallets — <span style={{ color: "var(--accent)" }}>{network}</span>
                        </p>
                        <button onClick={() => setSavedOpen(false)} aria-label="Close"
                          className="w-7 h-7 flex items-center justify-center rounded-full"
                          style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-secondary)", cursor: "pointer" }}>
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                            <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                      <div className="p-3 space-y-2 max-h-72 overflow-y-auto">
                        {savedWallets.filter((w) => w.network === network).map((w, i) => (
                          <button key={i} type="button"
                            onClick={() => { setWallet(w.address); if (w.memo) setMemo(w.memo); setSavedOpen(false); }}
                            className="w-full text-left px-4 py-3 rounded-xl transition-colors duration-150"
                            style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", cursor: "pointer" }}
                            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--border-accent)")}
                            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}>
                            {w.label && <p style={{ fontFamily: "var(--font-body)", fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>{w.label}</p>}
                            <p style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-secondary)", wordBreak: "break-all" }}>{w.address}</p>
                            {w.memo && <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--text-tertiary)", marginTop: "3px" }}>Memo: {w.memo}</p>}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Memo — only for networks that require it */}
                {memoRequired && (
                  <div>
                    <FieldLabel htmlFor="memo-input">
                      Memo <span style={{ color: "var(--error)", fontSize: "11px" }}>Required</span>
                    </FieldLabel>
                    <input id="memo-input" type="text" placeholder="Enter destination memo / tag"
                      value={memo} onChange={(e) => setMemo(e.target.value)}
                      className="input-dark w-full rounded-xl px-4 py-3" style={{ fontSize: "13px" }}
                      spellCheck={false} autoComplete="off" aria-describedby="memo-error" />
                    <FieldError id="memo-error" message={memoError} show={!!memoError} />
                  </div>
                )}

                {/* ⚠️ Irreversibility warning */}
                {wallet.length > 0 && !walletError && (
                  <div className="flex gap-3 px-4 py-3 rounded-xl" role="alert"
                    style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.3)", animation: "var(--animate-fade-in)" }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ color: "#eab308", flexShrink: 0, marginTop: "1px" }}>
                      <path d="M8 1.5L1 14h14L8 1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                      <path d="M8 6v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      <circle cx="8" cy="11.5" r="0.75" fill="currentColor" />
                    </svg>
                    <p style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "#ca8a04", lineHeight: 1.5 }}>
                      <strong>Double-check your address.</strong> Tokens sent to a wrong or incompatible wallet address cannot be recovered. Transactions on the blockchain are irreversible.
                    </p>
                  </div>
                )}

                <button type="button"
                  onClick={() => !walletError && !memoError && wallet.trim().length > 0 && (!memoRequired || memo.trim().length > 0) && openBankModal()}
                  disabled={!wallet.trim() || !!walletError || !!memoError || (memoRequired && !memo.trim())}
                  className="btn-gold w-full rounded-xl py-3.5 text-base">
                  View Payment Details →
                </button>
              </>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
