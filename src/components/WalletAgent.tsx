"use client";

import { useEffect, useState, useRef } from "react";
import type { WalletAgentResult } from "@/app/api/agent/validate-wallet/route";

type AgentState = "idle" | "checking" | "done";

const DEBOUNCE_MS = 800;

function AgentIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className={spinning ? "animate-spin" : ""} aria-hidden="true">
      {spinning ? (
        <>
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1.5" />
          <path d="M7 1.5a5.5 5.5 0 0 1 5.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </>
      ) : (
        <>
          <rect x="2" y="4" width="10" height="7" rx="2" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="5" cy="7.5" r="1" fill="currentColor" />
          <circle cx="9" cy="7.5" r="1" fill="currentColor" />
          <path d="M7 1.5v2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="7" cy="1.5" r="0.75" fill="currentColor" />
        </>
      )}
    </svg>
  );
}

function StatusIcon({ status }: { status: WalletAgentResult["status"] }) {
  if (status === "active_eoa") return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <circle cx="6.5" cy="6.5" r="5.5" stroke="var(--success)" strokeWidth="1.3" />
      <path d="M4 6.5l2 2 3-3" stroke="var(--success)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  if (status === "format_only") return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <circle cx="6.5" cy="6.5" r="5.5" stroke="var(--success)" strokeWidth="1.3" />
      <path d="M4 6.5l2 2 3-3" stroke="var(--success)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  if (status === "contract" || status === "empty_account") return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <circle cx="6.5" cy="6.5" r="5.5" stroke="#eab308" strokeWidth="1.3" />
      <path d="M6.5 4v3" stroke="#eab308" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="6.5" cy="9" r="0.7" fill="#eab308" />
    </svg>
  );
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <circle cx="6.5" cy="6.5" r="5.5" stroke="var(--error)" strokeWidth="1.3" />
      <path d="M4.5 4.5l4 4M8.5 4.5l-4 4" stroke="var(--error)" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function statusColor(status: WalletAgentResult["status"]): string {
  if (status === "active_eoa" || status === "format_only") return "var(--success)";
  if (status === "contract" || status === "empty_account") return "#ca8a04";
  return "var(--error)";
}
function statusBg(status: WalletAgentResult["status"]): string {
  if (status === "active_eoa" || status === "format_only") return "rgba(34,197,94,0.06)";
  if (status === "contract" || status === "empty_account") return "rgba(234,179,8,0.06)";
  return "rgba(239,68,68,0.06)";
}
function statusBorder(status: WalletAgentResult["status"]): string {
  if (status === "active_eoa" || status === "format_only") return "rgba(34,197,94,0.2)";
  if (status === "contract" || status === "empty_account") return "rgba(234,179,8,0.25)";
  return "rgba(239,68,68,0.2)";
}

export default function WalletAgent({ address, network }: { address: string; network: string }) {
  const [state, setState]   = useState<AgentState>("idle");
  const [result, setResult] = useState<WalletAgentResult | null>(null);
  const debounceRef         = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastChecked         = useRef("");

  useEffect(() => {
    const trimmed = address.trim();

    if (!trimmed || trimmed.length < 10) { setState("idle"); setResult(null); return; }
    if (trimmed === lastChecked.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setState("checking");
      try {
        const res = await fetch("/api/agent/validate-wallet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: trimmed, network }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: WalletAgentResult = await res.json();
        lastChecked.current = trimmed;
        setResult(data);
        setState("done");
      } catch {
        setResult({ valid: false, status: "error", message: "Agent unavailable. Please verify your address manually.", details: {} });
        setState("done");
      }
    }, DEBOUNCE_MS);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [address, network]);

  // Reset when network changes
  useEffect(() => { setState("idle"); setResult(null); lastChecked.current = ""; }, [network]);

  if (state === "idle") return null;

  const color  = state === "done" && result ? statusColor(result.status) : "var(--text-tertiary)";
  const bg     = state === "done" && result ? statusBg(result.status) : "var(--bg-tertiary)";
  const border = state === "done" && result ? statusBorder(result.status) : "var(--border)";

  return (
    <div className="rounded-xl px-3 py-2.5 mt-2"
      style={{ background: bg, border: `1px solid ${border}`, animation: "var(--animate-fade-in)", transition: "background 0.2s ease, border-color 0.2s ease" }}>

      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <span style={{ color }}><AgentIcon spinning={state === "checking"} /></span>
        <span style={{ fontFamily: "var(--font-body)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color }}>
          {state === "checking" ? "AI Agent — Checking…" : "AI Agent"}
        </span>

      </div>

      {/* Skeleton */}
      {state === "checking" && (
        <span className="inline-block rounded-md animate-pulse" style={{ width: "65%", height: 10, background: "var(--border)", display: "block", marginTop: 4 }} />
      )}

      {/* Result */}
      {state === "done" && result && (
        <>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 flex-shrink-0"><StatusIcon status={result.status} /></span>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "12px", color, lineHeight: 1.5 }}>
              {result.message}
            </p>
          </div>

          {result.details.txCount !== undefined && (
            <div className="flex items-center gap-3 mt-2 pt-2" style={{ borderTop: `1px solid ${statusBorder(result.status)}` }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-tertiary)" }}>
                Txns: <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>{result.details.txCount}</span>
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
