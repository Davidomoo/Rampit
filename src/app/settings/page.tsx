"use client";

import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import Link from "next/link";

export default function SettingsPage() {
  const { user, savedWallets, setSavedWallets, deleteAccount } = useAuth();
  const [emailNotifs, setEmailNotifs] = useState(true);
  const wallets = savedWallets;
  const [addOpen, setAddOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [newWallet, setNewWallet] = useState({ network: "TRC-20", address: "", memo: "", label: "" });

  function addWallet() {
    if (!newWallet.address.trim()) return;
    setSavedWallets([...wallets, { ...newWallet, address: newWallet.address.trim(), memo: newWallet.memo.trim() || undefined, label: newWallet.label.trim() || undefined }]);
    setNewWallet({ network: "TRC-20", address: "", memo: "", label: "" });
    setAddOpen(false);
  }

  function removeWallet(idx: number) {
    setSavedWallets(wallets.filter((_, i) => i !== idx));
  }

  /** DELETE /users/me — soft-deletes the account and drops the session. */
  async function confirmDelete() {
    setDeleting(true); setDeleteError("");
    try {
      await deleteAccount();
      setDeleteOpen(false);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Could not delete your account");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)", paddingTop: "80px", paddingBottom: "60px" }}>
      <div className="mx-auto max-w-3xl px-4">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4 transition-colors duration-200"
            style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--text-tertiary)", textDecoration: "none" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-tertiary)")}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to Home
          </Link>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "32px", fontWeight: 800, color: "var(--text-primary)", marginBottom: "6px" }}>
            Settings
          </h1>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "14px", color: "var(--text-secondary)" }}>
            Manage your account preferences and saved wallets
          </p>
        </div>

        <div className="space-y-4">
          {/* Account section */}
          <section className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
            <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
              <h2 style={{ fontFamily: "var(--font-body)", fontSize: "12px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>
                Account
              </h2>
            </div>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
              <div>
                <p style={{ fontFamily: "var(--font-body)", fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "2px" }}>Email</p>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--text-secondary)" }}>{user}</p>
              </div>
            </div>
            <div className="px-6 py-4 flex items-center justify-between">
              <div>
                <p style={{ fontFamily: "var(--font-body)", fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "2px" }}>Email Notifications</p>
                <p style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--text-tertiary)" }}>Receive order updates and alerts</p>
              </div>
              <button onClick={() => setEmailNotifs(!emailNotifs)} role="switch" aria-checked={emailNotifs}
                className="relative w-12 h-6 rounded-full transition-colors duration-200"
                style={{ background: emailNotifs ? "var(--accent)" : "var(--bg-tertiary)", border: "1px solid var(--border)", cursor: "pointer" }}>
                <span className="absolute top-0.5 w-5 h-5 rounded-full transition-transform duration-200"
                  style={{ background: "var(--bg-primary)", left: emailNotifs ? "calc(100% - 22px)" : "2px" }} />
              </button>
            </div>
          </section>

          {/* Saved Wallets */}
          <section className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
              <div>
                <h2 style={{ fontFamily: "var(--font-body)", fontSize: "12px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: "2px" }}>
                  Saved Wallets
                </h2>
                <p style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--text-tertiary)" }}>Quick access when buying crypto</p>
              </div>
              <button onClick={() => setAddOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all duration-200"
                style={{ background: "var(--accent-muted)", border: "1px solid var(--border-accent)", color: "var(--accent)", fontFamily: "var(--font-body)", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Add
              </button>
            </div>
            {wallets.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <p style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--text-tertiary)" }}>No saved wallets yet</p>
              </div>
            ) : (
              <div>
                {wallets.map((w, i) => (
                  <div key={i} className="px-6 py-4 flex items-start justify-between gap-4" style={{ borderBottom: i < wallets.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded text-xs" style={{ background: "var(--accent-muted)", color: "var(--accent)", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                          {w.network}
                        </span>
                        {w.label && <span style={{ fontFamily: "var(--font-body)", fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>{w.label}</span>}
                      </div>
                      <p style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-secondary)", wordBreak: "break-all" }}>
                        {w.address}
                      </p>
                      {w.memo && <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--text-tertiary)", marginTop: "4px" }}>Memo: {w.memo}</p>}
                    </div>
                    <button onClick={() => removeWallet(i)} aria-label="Remove wallet"
                      className="p-1.5 rounded-lg transition-colors duration-200"
                      style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-tertiary)", cursor: "pointer", flexShrink: 0 }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; e.currentTarget.style.color = "var(--error)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg-tertiary)"; e.currentTarget.style.color = "var(--text-tertiary)"; }}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                        <path d="M2 4h10M5 4V2.5A1.5 1.5 0 0 1 6.5 1h1A1.5 1.5 0 0 1 9 2.5V4M4 6v5.5A1.5 1.5 0 0 0 5.5 13h3a1.5 1.5 0 0 0 1.5-1.5V6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Danger zone */}
          <section className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-secondary)", border: "1px solid rgba(239,68,68,0.3)" }}>
            <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
              <h2 style={{ fontFamily: "var(--font-body)", fontSize: "12px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--error)" }}>
                Danger Zone
              </h2>
            </div>
            <div className="px-6 py-4 flex items-center justify-between">
              <div>
                <p style={{ fontFamily: "var(--font-body)", fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "2px" }}>Delete Account</p>
                <p style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--text-tertiary)" }}>Permanently remove your account and data</p>
              </div>
              <button onClick={() => setDeleteOpen(true)}
                className="px-4 py-2 rounded-lg transition-colors duration-200"
                style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "var(--error)", fontFamily: "var(--font-body)", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                Delete
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* Add Wallet Modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }} onClick={() => setAddOpen(false)}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontFamily: "var(--font-body)", fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>Add Wallet</h3>
            <div>
              <label style={{ fontFamily: "var(--font-body)", fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "6px" }}>Network</label>
              <select value={newWallet.network} onChange={(e) => setNewWallet({ ...newWallet, network: e.target.value })}
                className="input-dark w-full rounded-xl px-4 py-3" style={{ fontSize: "13px" }}>
                {["TRC-20", "ERC-20", "BEP-20", "Solana", "Stellar", "Celo Network"].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontFamily: "var(--font-body)", fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "6px" }}>Address</label>
              <input type="text" placeholder="Wallet address" value={newWallet.address}
                onChange={(e) => setNewWallet({ ...newWallet, address: e.target.value })}
                className="input-dark w-full rounded-xl px-4 py-3" style={{ fontSize: "13px" }} />
            </div>
            {newWallet.network === "Stellar" && (
              <div>
                <label style={{ fontFamily: "var(--font-body)", fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "6px" }}>Memo (optional)</label>
                <input type="text" placeholder="Memo" value={newWallet.memo}
                  onChange={(e) => setNewWallet({ ...newWallet, memo: e.target.value })}
                  className="input-dark w-full rounded-xl px-4 py-3" style={{ fontSize: "13px" }} />
              </div>
            )}
            <div>
              <label style={{ fontFamily: "var(--font-body)", fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "6px" }}>Label (optional)</label>
              <input type="text" placeholder="e.g. My Main Wallet" value={newWallet.label}
                onChange={(e) => setNewWallet({ ...newWallet, label: e.target.value })}
                className="input-dark w-full rounded-xl px-4 py-3" style={{ fontSize: "13px" }} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setAddOpen(false)}
                className="flex-1 px-4 py-3 rounded-xl transition-colors duration-200"
                style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-secondary)", fontFamily: "var(--font-body)", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={addWallet} disabled={!newWallet.address.trim()}
                className="btn-gold flex-1 rounded-xl py-3 text-sm">
                Add Wallet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }} onClick={() => setDeleteOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl p-6 text-center space-y-4"
            style={{ background: "var(--bg-secondary)", border: "1px solid rgba(239,68,68,0.3)" }} onClick={(e) => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ color: "var(--error)" }}>
                <path d="M12 8v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <h3 style={{ fontFamily: "var(--font-body)", fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "6px" }}>Delete Account?</h3>
              <p style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--text-secondary)" }}>
                This action cannot be undone. All your data will be permanently removed.
              </p>
            </div>
            {deleteError && (
              <p role="alert" style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--error)" }}>{deleteError}</p>
            )}
            <div className="flex gap-2">
              <button onClick={() => setDeleteOpen(false)} disabled={deleting}
                className="flex-1 px-4 py-3 rounded-xl transition-colors duration-200"
                style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-secondary)", fontFamily: "var(--font-body)", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={confirmDelete} disabled={deleting}
                className="flex-1 px-4 py-3 rounded-xl transition-colors duration-200"
                style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "var(--error)", fontFamily: "var(--font-body)", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
