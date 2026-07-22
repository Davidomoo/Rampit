"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

type AuthStep = "email" | "otp";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 30;

/** POST /auth/login — the backend creates the account on first request. */
async function sendOtp(email: string): Promise<void> {
  await api.auth.sendOtp(email);
}

/** POST /auth/login/verify — the client stores the returned tokens. */
async function verifyOtp(email: string, code: string): Promise<void> {
  await api.auth.verifyOtp(email, code);
}

export default function AuthModal({
  open,
  onSuccess,
  onClose,
}: {
  open: boolean;
  onSuccess: (email: string) => void;
  onClose: () => void;
}) {
  const [step, setStep]         = useState<AuthStep>("email");
  const [email, setEmail]       = useState("");
  const [otp, setOtp]           = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [cooldown, setCooldown] = useState(0);
  const inputRefs               = useRef<(HTMLInputElement | null)[]>([]);
  const timerRef                = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset on open
  useEffect(() => {
    if (open) { setStep("email"); setEmail(""); setOtp(Array(OTP_LENGTH).fill("")); setError(""); setCooldown(0); }
  }, [open]);

  // Cooldown ticker
  useEffect(() => {
    if (cooldown <= 0) return;
    timerRef.current = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [cooldown]);

  // Focus first OTP box when step changes
  useEffect(() => {
    if (step === "otp") setTimeout(() => inputRefs.current[0]?.focus(), 80);
  }, [step]);

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  async function handleSendOtp() {
    if (!isValidEmail) { setError("Enter a valid email address"); return; }
    setLoading(true); setError("");
    try {
      await sendOtp(email.trim());
      setStep("otp");
      setCooldown(RESEND_COOLDOWN);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to send code. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    const code = otp.join("");
    if (code.length < OTP_LENGTH) { setError("Enter the 6-digit code"); return; }
    setLoading(true); setError("");
    try {
      await verifyOtp(email.trim(), code);
      onSuccess(email.trim());
    } catch (error) {
      setError(error instanceof Error ? error.message : "Verification failed. Try again.");
      setOtp(Array(OTP_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  const handleOtpKey = useCallback((i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (otp[i]) {
        const next = [...otp]; next[i] = ""; setOtp(next);
      } else if (i > 0) {
        inputRefs.current[i - 1]?.focus();
      }
    }
  }, [otp]);

  const handleOtpChange = useCallback((i: number, val: string) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...otp]; next[i] = digit; setOtp(next);
    if (digit && i < OTP_LENGTH - 1) inputRefs.current[i + 1]?.focus();
  }, [otp]);

  const handleOtpPaste = useCallback((e: React.ClipboardEvent) => {
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!digits) return;
    e.preventDefault();
    const next = Array(OTP_LENGTH).fill("").map((_, i) => digits[i] ?? "");
    setOtp(next);
    inputRefs.current[Math.min(digits.length, OTP_LENGTH - 1)]?.focus();
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(10px)", animation: "var(--animate-fade-in)" }}
      role="dialog" aria-modal="true" aria-label="Sign in"
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", animation: "var(--animate-fade-in-up)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-5">
          <div>
            {step === "otp" && (
              <button type="button" onClick={() => { setStep("email"); setError(""); setOtp(Array(OTP_LENGTH).fill("")); }}
                className="flex items-center gap-1.5 mb-2 transition-colors duration-150"
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", fontFamily: "var(--font-body)", fontSize: "12px", padding: 0 }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Back
              </button>
            )}
            <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: "4px" }}>
              {step === "email" ? "Sign in / Sign up" : "Verify Email"}
            </p>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "20px", fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.2 }}>
              {step === "email" ? "Continue with email" : "Enter your code"}
            </p>
            {step === "otp" && (
              <p style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
                Sent to <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{email}</span>
              </p>
            )}
          </div>
          <button onClick={onClose} aria-label="Close"
            className="w-8 h-8 flex items-center justify-center rounded-full transition-colors duration-200"
            style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-secondary)", cursor: "pointer", flexShrink: 0, alignSelf: "flex-start" }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {step === "email" ? (
            <>
              <input
                type="email" placeholder="you@example.com" value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
                className="input-dark w-full rounded-xl px-4 py-3"
                style={{ fontSize: "14px" }} autoFocus autoComplete="email"
                aria-label="Email address"
              />
              {error && <p role="alert" style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--error)" }}>{error}</p>}
              <button type="button" onClick={handleSendOtp} disabled={loading || !isValidEmail}
                className="btn-gold w-full rounded-xl py-3.5 text-base flex items-center justify-center gap-2">
                {loading ? <Spinner /> : "Send Code →"}
              </button>
            </>
          ) : (
            <>
              {/* OTP boxes */}
              <div className="flex gap-2 justify-between" onPaste={handleOtpPaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    type="text" inputMode="numeric" maxLength={1} value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKey(i, e)}
                    className="input-dark rounded-xl text-center"
                    style={{ width: "100%", aspectRatio: "1", fontSize: "22px", fontWeight: 700, padding: 0 }}
                    aria-label={`OTP digit ${i + 1}`}
                  />
                ))}
              </div>
              {error && <p role="alert" style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--error)" }}>{error}</p>}
              <button type="button" onClick={handleVerify} disabled={loading || otp.join("").length < OTP_LENGTH}
                className="btn-gold w-full rounded-xl py-3.5 text-base flex items-center justify-center gap-2">
                {loading ? <Spinner /> : "Verify & Continue →"}
              </button>
              <p className="text-center" style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--text-tertiary)" }}>
                Didn&apos;t receive it?{" "}
                {cooldown > 0 ? (
                  <span>Resend in {cooldown}s</span>
                ) : (
                  <button type="button" onClick={() => { setOtp(Array(OTP_LENGTH).fill("")); handleSendOtp(); }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontFamily: "var(--font-body)", fontSize: "12px", fontWeight: 600, padding: 0 }}>
                    Resend code
                  </button>
                )}
              </p>
            </>
          )}

          <p className="text-center" style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--text-tertiary)" }}>
            By continuing you agree to our{" "}
            <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: "var(--text-secondary)", textDecoration: "underline" }}>Terms</a>
            {" & "}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "var(--text-secondary)", textDecoration: "underline" }}>Privacy Policy</a>
            {" · "}Powered by RAMPIT
          </p>
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin" width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="7" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2" />
      <path d="M9 2a7 7 0 0 1 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
