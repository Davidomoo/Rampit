"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { api, isAuthenticated } from "@/lib/api";
import type { BankAccount, RampTransaction, User } from "@/lib/api/types";

export type SavedWallet = { network: string; address: string; memo?: string; label?: string };

export type OrderStatus = "completed" | "pending" | "failed";
export type Order = {
  id: string;
  ref: string;
  txHash: string;
  date: string; // ISO
  fiatAmount: number;
  fiatCurrency: string;
  fiatSymbol: string;
  cryptoAmount: string;
  token: string;
  network: string;
  rate: number;
  wallet: string;
  memo?: string;
  status: OrderStatus;
};

export type KycStatus = "unverified" | "pending" | "verified";

const SAVED_WALLETS_KEY = "rampit_saved_wallets";

function toOrderStatus(status: string): OrderStatus {
  if (status === "COMPLETED") return "completed";
  if (status === "FAILED" || status === "CANCELLED") return "failed";
  return "pending";
}

/** Map a backend ramp transaction onto the shape the history/dashboard UI reads. */
function toOrder(tx: RampTransaction, kind: "onramp" | "offramp"): Order {
  const cryptoAmount = tx.tokenAmount ?? "—";
  const rate =
    tx.tokenAmount && Number(tx.tokenAmount) > 0 ? tx.amount / Number(tx.tokenAmount) : 0;

  return {
    id: tx.id,
    ref: tx.reference,
    txHash: tx.transactionHash ?? "",
    date: tx.createdAt,
    fiatAmount: tx.amount,
    fiatCurrency: "NGN",
    fiatSymbol: "₦",
    cryptoAmount,
    token: tx.tokenType ?? "USDC",
    network: tx.network ?? (kind === "onramp" ? "Base" : "—"),
    rate,
    wallet: tx.destinationAddress ?? "",
    status: toOrderStatus(tx.status),
  };
}

/** KYC is verified once AutoRamp has stamped a BVN or NIN on the profile. */
function deriveKycStatus(profile: User | null, pending: boolean): KycStatus {
  if (!profile) return "unverified";
  if (profile.bvn_verified_at || profile.nin_verified_at) return "verified";
  return pending ? "pending" : "unverified";
}

type AuthCtx = {
  /** Signed-in user's email, or null. */
  user: string | null;
  setUser: (u: string | null) => void;
  /** Full profile from GET /users/me. */
  profile: User | null;
  loadingProfile: boolean;
  refreshProfile: () => Promise<void>;
  /** The user's AutoRamp NGN account, when provisioned. */
  bankAccount: BankAccount | null;
  refreshBankAccount: () => Promise<void>;
  authOpen: boolean;
  setAuthOpen: (o: boolean) => void;
  savedWallets: SavedWallet[];
  setSavedWallets: (w: SavedWallet[]) => void;
  /** Ramp history from GET /autoramp/ramp/transactions. */
  orders: Order[];
  loadingOrders: boolean;
  refreshOrders: () => Promise<void>;
  kycStatus: KycStatus;
  setKycStatus: (s: KycStatus) => void;
  kycOpen: boolean;
  setKycOpen: (o: boolean) => void;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx>({
  user: null, setUser: () => {}, profile: null, loadingProfile: false,
  refreshProfile: async () => {}, bankAccount: null, refreshBankAccount: async () => {},
  authOpen: false, setAuthOpen: () => {}, savedWallets: [], setSavedWallets: () => {},
  orders: [], loadingOrders: false, refreshOrders: async () => {},
  kycStatus: "unverified", setKycStatus: () => {}, kycOpen: false, setKycOpen: () => {},
  logout: async () => {}, deleteAccount: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]                 = useState<string | null>(null);
  const [profile, setProfile]           = useState<User | null>(null);
  const [loadingProfile, setLoading]    = useState(false);
  const [bankAccount, setBankAccount]   = useState<BankAccount | null>(null);
  const [orders, setOrders]             = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [authOpen, setAuthOpen]         = useState(false);
  const [kycOverride, setKycOverride]   = useState<KycStatus | null>(null);
  const [kycPending, setKycPending]     = useState(false);
  const [kycOpen, setKycOpen]           = useState(false);
  const [savedWallets, setSavedWalletsState] = useState<SavedWallet[]>([]);

  // Saved wallets stay client-side — the backend has no endpoint for them yet.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SAVED_WALLETS_KEY);
      if (stored) setSavedWalletsState(JSON.parse(stored));
    } catch {}
  }, []);

  const setSavedWallets = useCallback((wallets: SavedWallet[]) => {
    setSavedWalletsState(wallets);
    try {
      localStorage.setItem(SAVED_WALLETS_KEY, JSON.stringify(wallets));
    } catch {}
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!isAuthenticated()) {
      setProfile(null);
      setUser(null);
      return;
    }
    setLoading(true);
    try {
      const me = await api.users.me();
      setProfile(me);
      setUser(me.email);
    } catch {
      // Token expired or revoked — fall back to signed-out.
      setProfile(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshBankAccount = useCallback(async () => {
    if (!isAuthenticated()) { setBankAccount(null); return; }
    try {
      setBankAccount(await api.users.bankAccount());
    } catch {
      setBankAccount(null); // 404 → not provisioned yet
    }
  }, []);

  const refreshOrders = useCallback(async () => {
    if (!isAuthenticated()) { setOrders([]); return; }
    setLoadingOrders(true);
    try {
      const tx = await api.autoramp.transactions({ limit: 50 });
      const mapped = [
        ...(tx.onramp ?? []).map((t) => toOrder(t, "onramp")),
        ...(tx.offramp ?? []).map((t) => toOrder(t, "offramp")),
      ].sort((a, b) => b.date.localeCompare(a.date));
      setOrders(mapped);
    } catch {
      setOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  const refreshKycPending = useCallback(async () => {
    if (!isAuthenticated()) { setKycPending(false); return; }
    try {
      const history = await api.users.kycHistory();
      setKycPending(history.some((record) => record.status === "PENDING"));
    } catch {
      setKycPending(false);
    }
  }, []);

  // Restore the session on mount and whenever the signed-in email changes.
  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  useEffect(() => {
    if (!user) {
      setOrders([]);
      setBankAccount(null);
      setKycPending(false);
      return;
    }
    void refreshOrders();
    void refreshBankAccount();
    void refreshKycPending();
  }, [user, refreshOrders, refreshBankAccount, refreshKycPending]);

  const logout = useCallback(async () => {
    await api.auth.logout().catch(() => {});
    setUser(null);
    setProfile(null);
    setBankAccount(null);
    setOrders([]);
    setKycOverride(null);
  }, []);

  const deleteAccount = useCallback(async () => {
    await api.users.deleteMe();
    setUser(null);
    setProfile(null);
    setBankAccount(null);
    setOrders([]);
  }, []);

  const kycStatus = useMemo(
    () => kycOverride ?? deriveKycStatus(profile, kycPending),
    [kycOverride, profile, kycPending],
  );

  // A component that just submitted KYC can optimistically flip the badge;
  // the next profile refresh takes over.
  const setKycStatus = useCallback((status: KycStatus) => {
    setKycOverride(status);
    void refreshProfile();
  }, [refreshProfile]);

  return (
    <AuthContext.Provider value={{
      user, setUser, profile, loadingProfile, refreshProfile,
      bankAccount, refreshBankAccount,
      authOpen, setAuthOpen, savedWallets, setSavedWallets,
      orders, loadingOrders, refreshOrders,
      kycStatus, setKycStatus, kycOpen, setKycOpen,
      logout, deleteAccount,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
