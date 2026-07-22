"use client";

import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api";

type IdType = "bvn" | "nin";
type Stage = "details" | "otp";

export default function KycModal() {
  const { kycOpen, setKycOpen, setKycStatus, refreshProfile } = useAuth();
  const [stage, setStage]       = useState<Stage>("details");
  const [idType, setIdType]     = useState<IdType>("bvn");
  const [idNumber, setIdNumber] = useState("");
  const [dob, setDob]           = useState("");
  const [otp, setOtp]           = useState("");
  const [identityId, setIdentityId] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  /** Step 1 — POST /users/me/kyc/start; an OTP goes to the identity holder. */
  async function startVerification() {
    if (!idNumber.trim() || !dob) { setError("All fields are required"); return; }
    if (!/^\d{11}$/.test(idNumber)) { setError(`${idType.toUpperCase()} must be exactly 11 digits`); return; }
    setError(""); setLoading(true);
    try {
      // Keep the profile's date of birth in sync while we have it.
      await api.users.updateMe({ dob }).catch(() => {});
      const result = await api.users.startKyc({
        type: idType.toUpperCase() as "BVN" | "NIN",
        number: idNumber,
      });
      setIdentityId(result.identityId);
      setStage("otp");
      setKycStatus("pending");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start verification");
    } finally {
      setLoading(false);
    }
  }

  /** Step 2 — POST /users/me/kyc/complete; on success the profile is stamped. */
  async function completeVerification() {
    if (otp.trim().length < 4) { setError("Enter the code sent to your phone"); return; }
    setError(""); setLoading(true);
    try {
      const result = await api.users.completeKyc({
        identityId,
        type: idType.toUpperCase() as "BVN" | "NIN",
        otp: otp.trim(),
      });
      if (result.status !== "VERIFIED") {
        setError("Verification is still pending. Try again shortly.");
        return;
      }
      await refreshProfile();
      setKycStatus("verified");
      reset();
      setKycOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStage("details"); setIdNumber(""); setDob(""); setOtp(""); setIdentityId(""); setError("");
  }

  function close() { setKycOpen(false); setError(""); }

  if (!kycOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4"
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(10px)", animation: "var(--animate-fade-in)" }}
      onClick={close}>
      <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl overflow-hidden"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", animation: "var(--animate-fade-in-up)" }}
        onClick={(e) => e.stopPropagation()}>

        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full" style={{ background: "var(--border)" }} />
        </div>

        <div className="px-6 pt-4 pb-2 flex items-start justify-between">
          <div>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: "4px" }}>
              Identity Verification
            </p>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "22px", fontWeight: 800, color: "var(--text-primary)" }}>KYC Required</p>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
              Orders above $50 require identity verification. Your data is encrypted and secure.
            </p>
          </div>
          <button onClick={close} aria-label="Close"
            className="w-8 h-8 flex items-center justify-center rounded-full mt-1 flex-shrink-0"
            style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-secondary)", cursor: "pointer" }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </button>
        </div>

        <div className="px-6 pb-6 pt-4 space-y-4">
          {stage === "otp" ? (
            <>
              <div className="px-3 py-3 rounded-xl" style={{ background: "var(--accent-muted)", border: "1px solid var(--border-accent)" }}>
                <p style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  We sent a one-time code to the phone number registered to this{" "}
                  <span style={{ fontWeight: 700, color: "var(--accent)" }}>{idType.toUpperCase()}</span>. Enter it below to finish verification.
                </p>
              </div>

              <div>
                <label style={{ fontFamily: "var(--font-body)", fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "6px" }}>
                  Verification Code
                </label>
                <input type="text" inputMode="numeric" maxLength={8} placeholder="Enter the code"
                  value={otp} onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "")); setError(""); }}
                  className="input-dark w-full rounded-xl px-4 py-3"
                  style={{ fontSize: "18px", fontFamily: "var(--font-mono)", letterSpacing: "0.3em", textAlign: "center" }} />
              </div>

              {error && <p role="alert" style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--error)" }}>{error}</p>}

              <button type="button" onClick={completeVerification} disabled={loading || otp.length < 4}
                className="btn-gold w-full rounded-2xl py-4 text-base font-bold flex items-center justify-center gap-2">
                {loading
                  ? <><svg className="animate-spin" width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2"/><path d="M9 2a7 7 0 0 1 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>Verifying…</>
                  : "Complete Verification →"}
              </button>

              <button type="button" onClick={reset}
                className="w-full text-center" style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--text-tertiary)" }}>
                Use a different ID
              </button>
            </>
          ) : (
          <>
          {/* ID type toggle */}
          <div>
            <label style={{ fontFamily: "var(--font-body)", fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "8px" }}>ID Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(["bvn", "nin"] as IdType[]).map((t) => (
                <button key={t} type="button" onClick={() => { setIdType(t); setIdNumber(""); setError(""); }}
                  className="py-3 rounded-xl transition-all duration-150"
                  style={{
                    fontFamily: "var(--font-mono)", fontSize: "14px", fontWeight: 700, cursor: "pointer",
                    background: idType === t ? "var(--accent-muted)" : "var(--bg-tertiary)",
                    border: `1px solid ${idType === t ? "var(--border-accent)" : "var(--border)"}`,
                    color: idType === t ? "var(--accent)" : "var(--text-secondary)",
                  }}>
                  {t.toUpperCase()}
                  <span style={{ display: "block", fontFamily: "var(--font-body)", fontSize: "10px", fontWeight: 400, color: idType === t ? "var(--accent)" : "var(--text-tertiary)", marginTop: "2px" }}>
                    {t === "bvn" ? "Bank Verification No." : "National ID No."}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ID number */}
          <div>
            <label style={{ fontFamily: "var(--font-body)", fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "6px" }}>
              {idType.toUpperCase()} Number
            </label>
            <input type="text" inputMode="numeric" maxLength={11}
              placeholder={`Enter 11-digit ${idType.toUpperCase()}`}
              value={idNumber} onChange={(e) => { setIdNumber(e.target.value.replace(/\D/g, "")); setError(""); }}
              className="input-dark w-full rounded-xl px-4 py-3"
              style={{ fontSize: "15px", fontFamily: "var(--font-mono)", letterSpacing: "0.1em" }} />
          </div>

          {/* DOB */}
          <div>
            <label style={{ fontFamily: "var(--font-body)", fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "6px" }}>
              Date of Birth
            </label>
            <input type="date" value={dob}
              onChange={(e) => { setDob(e.target.value); setError(""); }}
              max={new Date(Date.now() - 18 * 365.25 * 86400000).toISOString().slice(0, 10)}
              className="input-dark w-full rounded-xl px-4 py-3"
              style={{ fontSize: "13px", colorScheme: "dark" }} />
          </div>

          {error && <p role="alert" style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--error)" }}>{error}</p>}

          {/* Privacy note */}
          <div className="flex gap-2.5 px-3 py-3 rounded-xl" style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)" }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: "var(--text-tertiary)", flexShrink: 0, marginTop: "1px" }}>
              <path d="M7 1L2 3.5v4c0 2.8 2.1 5.4 5 6 2.9-.6 5-3.2 5-6v-4L7 1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
              <path d="M5 7l1.5 1.5L9 5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--text-tertiary)", lineHeight: 1.5 }}>
              Your {idType.toUpperCase()} and date of birth are transmitted over TLS and never stored in plain text.
            </p>
          </div>

          <button type="button" onClick={startVerification} disabled={loading || !idNumber || !dob}
            className="btn-gold w-full rounded-2xl py-4 text-base font-bold flex items-center justify-center gap-2">
            {loading
              ? <><svg className="animate-spin" width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2"/><path d="M9 2a7 7 0 0 1 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>Sending code…</>
              : "Send Verification Code →"}
          </button>
          </>
          )}
        </div>
      </div>
    </div>
  );
}
