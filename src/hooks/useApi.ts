"use client";

import useSWR, { type SWRConfiguration } from "swr";
import { api, isAuthenticated } from "@/lib/api";
import type {
  Bank,
  BankAccount,
  KycRecord,
  Paginated,
  RampTransactionsResponse,
  UsdNgnRate,
  User,
  VasCategory,
  VasProduct,
  VasService,
  VasTransaction,
} from "@/lib/api/types";

/** Reference data barely moves — don't refetch it on every focus. */
const STATIC: SWRConfiguration = { revalidateOnFocus: false, dedupingInterval: 60_000 };

/** GET /users/me — null key while signed out so SWR stays idle. */
export function useProfile() {
  return useSWR<User>(isAuthenticated() ? "users/me" : null, () => api.users.me(), {
    revalidateOnFocus: false,
  });
}

/** GET /users/me/bank-account — 404 simply means "not provisioned yet". */
export function useBankAccount() {
  return useSWR<BankAccount | null>(
    isAuthenticated() ? "users/me/bank-account" : null,
    async () => {
      try {
        return await api.users.bankAccount();
      } catch {
        return null;
      }
    },
    { revalidateOnFocus: false },
  );
}

/** GET /users/me/kyc */
export function useKycHistory() {
  return useSWR<KycRecord[]>(isAuthenticated() ? "users/me/kyc" : null, () => api.users.kycHistory());
}

/** GET /autoramp/rates/usd-ngn — refreshed every minute, matching the backend cache. */
export function useUsdNgnRate() {
  return useSWR<UsdNgnRate>(
    isAuthenticated() ? "autoramp/rates/usd-ngn" : null,
    () => api.autoramp.usdNgnRate(),
    { refreshInterval: 60_000, revalidateOnFocus: true, shouldRetryOnError: false },
  );
}

/** GET /autoramp/misc/banks */
export function useBanks() {
  return useSWR<Bank[]>(isAuthenticated() ? "autoramp/misc/banks" : null, () => api.autoramp.banks(), STATIC);
}

/** GET /autoramp/ramp/transactions */
export function useRampTransactions(page = 1, limit = 20) {
  return useSWR<RampTransactionsResponse>(
    isAuthenticated() ? ["autoramp/ramp/transactions", page, limit] : null,
    () => api.autoramp.transactions({ page, limit }),
    { revalidateOnFocus: true },
  );
}

/**
 * Poll a single ramp transaction until it settles — used while the user waits
 * for a bank transfer to be picked up.
 */
export function useRampTransaction(reference: string | null) {
  return useSWR<RampTransactionsResponse>(
    reference && isAuthenticated() ? ["autoramp/ramp/transaction", reference] : null,
    () => api.autoramp.transactions({ reference: reference ?? undefined, limit: 1 }),
    {
      refreshInterval: (data) => {
        const tx = [...(data?.onramp ?? []), ...(data?.offramp ?? [])][0];
        return !tx || tx.status === "COMPLETED" || tx.status === "FAILED" ? 0 : 5_000;
      },
    },
  );
}

/** GET /autoramp/vas/services */
export function useVasServices() {
  return useSWR<VasService[]>(
    isAuthenticated() ? "autoramp/vas/services" : null,
    () => api.autoramp.vas.services(),
    STATIC,
  );
}

/** GET /autoramp/vas/services/{serviceId}/categories */
export function useVasCategories(serviceId: string | null) {
  return useSWR<VasCategory[]>(
    serviceId && isAuthenticated() ? ["autoramp/vas/categories", serviceId] : null,
    () => api.autoramp.vas.categories(serviceId as string),
    STATIC,
  );
}

/** GET /autoramp/vas/categories/{categoryId}/products */
export function useVasProducts(categoryId: string | null) {
  return useSWR<VasProduct[]>(
    categoryId && isAuthenticated() ? ["autoramp/vas/products", categoryId] : null,
    () => api.autoramp.vas.products(categoryId as string),
    STATIC,
  );
}

/** GET /autoramp/vas/transactions */
export function useVasTransactions(page = 1, limit = 10) {
  return useSWR<Paginated<VasTransaction>>(
    isAuthenticated() ? ["autoramp/vas/transactions", page, limit] : null,
    () => api.autoramp.vas.transactions(page, limit),
  );
}
