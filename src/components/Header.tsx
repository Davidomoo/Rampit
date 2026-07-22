"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/AuthContext";

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M13.5 10A6 6 0 0 1 6 2.5a6 6 0 1 0 7.5 7.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const NAV_LINKS = [
  { href: "#how-it-works", label: "How It Works" },
  { href: "mailto:support@rampit.xyz", label: "Support" },
] as const;

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"
      style={{ color: "var(--text-tertiary)", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s ease" }}>
      <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function HistoryIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3"/><path d="M7 4v3.2l2 1.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>;
}
function ProfileIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><circle cx="7" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.3"/><path d="M1.5 12.5c0-2.485 2.462-4.5 5.5-4.5s5.5 2.015 5.5 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>;
}
function SettingsIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.3"/><path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.93 2.93l1.06 1.06M10.01 10.01l1.06 1.06M2.93 11.07l1.06-1.06M10.01 3.99l1.06-1.06" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>;
}
function DashboardIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/><rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/><rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/><rect x="8" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/></svg>;
}
function BillsIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><rect x="2" y="1" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M4.5 4.5h5M4.5 7h5M4.5 9.5h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>;
}
function LogoutIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M5 2H2.5A1.5 1.5 0 0 0 1 3.5v7A1.5 1.5 0 0 0 2.5 12H5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M9 4l3 3-3 3M12 7H5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const { user, setAuthOpen, logout } = useAuth();

  useEffect(() => {
    const stored = localStorage.getItem("theme") as "dark" | "light" | null;
    if (stored) setTheme(stored);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  // Close profile dropdown on outside click
  useEffect(() => {
    if (!profileOpen) return;
    function handler(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [profileOpen]);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  }

  /** POST /auth/logout — revokes the refresh token, then clears local state. */
  function handleLogout() {
    void logout();
    setProfileOpen(false);
    setDrawerOpen(false);
  }

  const initials = user ? user.slice(0, 2).toUpperCase() : "";

  const PROFILE_LINKS = [
    { icon: <DashboardIcon />, label: "Dashboard",    href: "/dashboard" },
    { icon: <HistoryIcon />,   label: "History", href: "/history" },
    { icon: <BillsIcon />,     label: "Pay Bills",     href: "/bills" },
    { icon: <ProfileIcon />,   label: "Profile",       href: "/profile" },
    { icon: <SettingsIcon />,  label: "Settings",      href: "/settings" },
  ];

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          background: scrolled ? "var(--header-bg-scrolled)" : "var(--header-bg)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          {/* Wordmark */}
          <Link href="/" className="flex items-center gap-2 group">
            <span className="inline-block transition-transform duration-200 group-hover:scale-110"
              style={{ color: "var(--accent)", fontSize: "14px", lineHeight: 1 }}>▲</span>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "22px", color: "var(--text-primary)", letterSpacing: "0.08em" }}>
              RAMPIT
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map(({ href, label }) => (
              <a key={href} href={href} className="transition-colors duration-200"
                style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--text-secondary)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}>
                {label}
              </a>
            ))}

          </nav>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <button onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              className="flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200"
              style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-secondary)", cursor: "pointer" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border-accent)"; e.currentTarget.style.color = "var(--accent)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-secondary)"; }}>
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>

            {/* Auth: login button OR profile dropdown */}
            {!user ? (
              <button onClick={() => setAuthOpen(true)}
                className="hidden md:flex btn-gold items-center gap-2 px-4 py-2 rounded-xl text-sm"
                style={{ fontFamily: "var(--font-body)", fontWeight: 700 }}>
                Get Started →
              </button>
            ) : (
              <div className="hidden md:block relative" ref={profileRef}>
                <button onClick={() => setProfileOpen((o) => !o)} aria-label="Account menu" aria-expanded={profileOpen}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-xl transition-all duration-200"
                  style={{ background: profileOpen ? "var(--accent-muted)" : "var(--bg-tertiary)", border: `1px solid ${profileOpen ? "var(--border-accent)" : "var(--border)"}`, cursor: "pointer" }}>
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                    style={{ background: "var(--accent)", color: "var(--bg-primary)", fontFamily: "var(--font-mono)" }}>
                    {initials}
                  </span>
                  <Chevron open={profileOpen} />
                </button>

                {profileOpen && (
                  <div className="absolute top-full right-0 mt-2 w-52 rounded-2xl overflow-hidden"
                    style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", boxShadow: "0 12px 40px rgba(0,0,0,0.6)", animation: "var(--animate-fade-in)" }}>
                    {/* User info */}
                    <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                      <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--text-tertiary)", marginBottom: "2px" }}>Signed in as</p>
                      <p style={{ fontFamily: "var(--font-mono)", fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user}</p>
                    </div>
                    {/* Links */}
                    <div className="py-1">
                      {PROFILE_LINKS.map(({ icon, label, href }) => (
                        <a key={label} href={href} onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 transition-colors duration-150"
                          style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--text-secondary)", textDecoration: "none" }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-tertiary)"; e.currentTarget.style.color = "var(--text-primary)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; }}>
                          <span style={{ color: "var(--text-tertiary)" }}>{icon}</span>
                          {label}
                        </a>
                      ))}
                    </div>
                    {/* Logout */}
                    <div style={{ borderTop: "1px solid var(--border)" }}>
                      <button onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors duration-150"
                        style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--error)", textAlign: "left" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.08)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                        <LogoutIcon />
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Mobile hamburger */}
            <button className="md:hidden flex items-center justify-center w-9 h-9 rounded-xl"
              style={{ color: "var(--text-secondary)", background: "var(--bg-tertiary)", border: "1px solid var(--border)", cursor: "pointer" }}
              aria-label="Open menu" onClick={() => setDrawerOpen(true)}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Drawer backdrop */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50" style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
          onClick={() => setDrawerOpen(false)} aria-hidden="true" />
      )}

      {/* Drawer panel */}
      <div className="fixed top-0 right-0 h-full z-50 flex flex-col transition-transform duration-300 ease-out"
        style={{ width: "280px", background: "var(--bg-secondary)", borderLeft: "1px solid var(--border)", transform: drawerOpen ? "translateX(0)" : "translateX(100%)" }}
        role="dialog" aria-modal="true" aria-label="Navigation menu">

        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "18px", color: "var(--text-primary)", letterSpacing: "0.08em" }}>
            ▲ RAMPIT
          </span>
          <button onClick={() => setDrawerOpen(false)} aria-label="Close menu"
            className="flex items-center justify-center w-8 h-8 rounded-lg"
            style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-secondary)", cursor: "pointer" }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Drawer user info or login */}
        <div className="px-4 pt-4">
          {user ? (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)" }}>
              <span className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: "var(--accent)", color: "var(--bg-primary)", fontFamily: "var(--font-mono)" }}>
                {initials}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user}</span>
            </div>
          ) : (
            <button onClick={() => { setDrawerOpen(false); setAuthOpen(true); }}
              className="btn-gold w-full rounded-xl py-3 text-sm"
              style={{ fontFamily: "var(--font-body)", fontWeight: 700 }}>
              Get Started →
            </button>
          )}
        </div>

        {/* Drawer nav links */}
        <nav className="flex flex-col p-4 gap-1">
          {user && PROFILE_LINKS.map(({ icon, label, href }) => (
            <a key={label} href={href} onClick={() => setDrawerOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors duration-200"
              style={{ fontFamily: "var(--font-body)", fontSize: "15px", fontWeight: 500, color: "var(--text-secondary)", textDecoration: "none" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-tertiary)"; e.currentTarget.style.color = "var(--text-primary)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; }}>
              <span style={{ color: "var(--text-tertiary)" }}>{icon}</span>
              {label}
            </a>
          ))}
          {user && <div style={{ height: "1px", background: "var(--border)", margin: "4px 0" }} />}
          {NAV_LINKS.map(({ href, label }) => (
            <a key={href} href={href} onClick={() => setDrawerOpen(false)}
              className="px-4 py-3 rounded-xl transition-colors duration-200"
              style={{ fontFamily: "var(--font-body)", fontSize: "15px", fontWeight: 500, color: "var(--text-secondary)", textDecoration: "none" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-tertiary)"; e.currentTarget.style.color = "var(--text-primary)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; }}>
              {label}
            </a>
          ))}
        </nav>

        {/* Bottom: theme + logout */}
        <div className="mt-auto p-4 space-y-2" style={{ borderTop: "1px solid var(--border)" }}>
          {user && (
            <button onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl transition-colors duration-200"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "var(--error)", fontFamily: "var(--font-body)", fontSize: "14px", cursor: "pointer" }}>
              <LogoutIcon /> Sign out
            </button>
          )}
          <button onClick={toggleTheme}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl transition-all duration-200"
            style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-secondary)", fontFamily: "var(--font-body)", fontSize: "14px", cursor: "pointer" }}>
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            {theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          </button>
        </div>
      </div>
    </>
  );
}
