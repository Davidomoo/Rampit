import { http, clearTokens, setTokens } from "./client";
import type {
  Bank,
  BankAccount,
  CompleteKycPayload,
  CompleteKycResponse,
  CompleteSwapPayload,
  CreateSwapPayload,
  InitializeSwapPayload,
  KycRecord,
  LoginResponse,
  OfframpPayload,
  OfframpResponse,
  OnrampPayload,
  OnrampResponse,
  Paginated,
  PayAirtimePayload,
  PayCableTvPayload,
  PayDataPayload,
  PayUtilityPayload,
  ProvisionAccountPayload,
  RampTransactionsQuery,
  RampTransactionsResponse,
  ResolvedAccount,
  Session,
  StartKycPayload,
  StartKycResponse,
  UpdateProfilePayload,
  UsdNgnRate,
  User,
  VasCategory,
  VasPaymentResponse,
  VasProduct,
  VasService,
  VasTransaction,
  VasVerification,
  VasVerifyPayload,
} from "./types";

/**
 * Typed map of the Rampit backend API.
 *
 * Paths mirror `backend/src/app.ts`: /auth/*, /users/*, /autoramp/*.
 */
export const api = {
  auth: {
    /** POST /auth/login — emails a 6-digit OTP, creating the account if new. */
    sendOtp: (email: string) => http.post<LoginResponse>("/auth/login", { email }, { anonymous: true }),

    /** POST /auth/login/verify — exchanges the OTP for a session and stores the tokens. */
    async verifyOtp(email: string, otp: string) {
      const session = await http.post<Session>(
        "/auth/login/verify",
        { email, otp },
        { anonymous: true },
      );
      setTokens(session.access_token, session.refresh_token);
      return session;
    },

    /** POST /auth/logout — revokes the refresh token server-side. */
    async logout() {
      try {
        await http.post<null>("/auth/logout");
      } finally {
        clearTokens();
      }
    },
  },

  users: {
    /** GET /users/me */
    me: () => http.get<User>("/users/me"),
    /** PATCH /users/me */
    updateMe: (payload: UpdateProfilePayload) => http.patch<User>("/users/me", payload),
    /** DELETE /users/me — soft-deletes the account. */
    async deleteMe() {
      await http.delete<null>("/users/me");
      clearTokens();
    },

    /** GET /users/me/bank-account — the user's NGN account with a live balance. */
    bankAccount: () => http.get<BankAccount>("/users/me/bank-account"),
    /** POST /users/me/bank-account — provisions the AutoRamp sub-account (idempotent). */
    provisionBankAccount: (payload: ProvisionAccountPayload = {}) =>
      http.post<BankAccount>("/users/me/bank-account", payload),

    /** GET /users/me/kyc */
    kycHistory: () => http.get<KycRecord[]>("/users/me/kyc"),
    /** POST /users/me/kyc/start — sends an OTP to the BVN/NIN holder. */
    startKyc: (payload: StartKycPayload) => http.post<StartKycResponse>("/users/me/kyc/start", payload),
    /** POST /users/me/kyc/complete — validates the OTP and stamps the profile. */
    completeKyc: (payload: CompleteKycPayload) =>
      http.post<CompleteKycResponse>("/users/me/kyc/complete", payload),
  },

  autoramp: {
    /** GET /autoramp/misc/banks */
    banks: () => http.get<Bank[]>("/autoramp/misc/banks"),
    /** GET /autoramp/misc/resolve-account */
    resolveAccount: (bankCode: string, accountNumber: string) =>
      http.get<ResolvedAccount>("/autoramp/misc/resolve-account", { bankCode, accountNumber }),
    /** GET /autoramp/rates/usd-ngn */
    usdNgnRate: () => http.get<UsdNgnRate>("/autoramp/rates/usd-ngn"),

    /** POST /autoramp/ramp/onramp — NGN in, stablecoin to the wallet address. */
    onramp: (payload: OnrampPayload) => http.post<OnrampResponse>("/autoramp/ramp/onramp", payload),
    /** POST /autoramp/ramp/offramp — stablecoin in, NGN to the bank account. */
    offramp: (payload: OfframpPayload) => http.post<OfframpResponse>("/autoramp/ramp/offramp", payload),
    /** GET /autoramp/ramp/transactions */
    transactions: (query: RampTransactionsQuery = {}) =>
      http.get<RampTransactionsResponse>("/autoramp/ramp/transactions", { ...query }),

    swap: {
      /** POST /autoramp/swap/initialize */
      initialize: (payload: InitializeSwapPayload) =>
        http.post<unknown>("/autoramp/swap/initialize", payload),
      /** POST /autoramp/swap/{reference}/complete */
      complete: (reference: string, payload: CompleteSwapPayload) =>
        http.post<unknown>(`/autoramp/swap/${encodeURIComponent(reference)}/complete`, payload),
      /** POST /autoramp/swap/create */
      create: (payload: CreateSwapPayload) => http.post<unknown>("/autoramp/swap/create", payload),
    },

    identity: {
      /** POST /autoramp/identity/verify */
      verify: (payload: StartKycPayload) =>
        http.post<StartKycResponse>("/autoramp/identity/verify", payload),
      /** POST /autoramp/identity/validate */
      validate: (payload: CompleteKycPayload) =>
        http.post<CompleteKycResponse>("/autoramp/identity/validate", payload),
    },

    vas: {
      /** GET /autoramp/vas/services */
      services: () => http.get<VasService[]>("/autoramp/vas/services"),
      /** GET /autoramp/vas/services/{serviceId} */
      service: (serviceId: string) =>
        http.get<VasService>(`/autoramp/vas/services/${encodeURIComponent(serviceId)}`),
      /** GET /autoramp/vas/services/{serviceId}/categories — providers (MTN, DSTV…). */
      categories: (serviceId: string) =>
        http.get<VasCategory[]>(`/autoramp/vas/services/${encodeURIComponent(serviceId)}/categories`),
      /** GET /autoramp/vas/categories/{categoryId}/products — bundles / bouquets. */
      products: (categoryId: string) =>
        http.get<VasProduct[]>(`/autoramp/vas/categories/${encodeURIComponent(categoryId)}/products`),

      /** POST /autoramp/vas/verify — resolve a meter or smartcard before paying. */
      verify: (payload: VasVerifyPayload) => http.post<VasVerification>("/autoramp/vas/verify", payload),

      /** POST /autoramp/vas/pay/airtime */
      payAirtime: (payload: PayAirtimePayload) =>
        http.post<VasPaymentResponse>("/autoramp/vas/pay/airtime", payload),
      /** POST /autoramp/vas/pay/data */
      payData: (payload: PayDataPayload) =>
        http.post<VasPaymentResponse>("/autoramp/vas/pay/data", payload),
      /** POST /autoramp/vas/pay/cable-tv */
      payCableTv: (payload: PayCableTvPayload) =>
        http.post<VasPaymentResponse>("/autoramp/vas/pay/cable-tv", payload),
      /** POST /autoramp/vas/pay/utility */
      payUtility: (payload: PayUtilityPayload) =>
        http.post<VasPaymentResponse>("/autoramp/vas/pay/utility", payload),

      /** GET /autoramp/vas/transactions */
      transactions: (page = 1, limit = 10) =>
        http.get<Paginated<VasTransaction>>("/autoramp/vas/transactions", { page, limit }),
      /** GET /autoramp/vas/transactions/{id} */
      transaction: (transactionId: string) =>
        http.get<VasTransaction>(`/autoramp/vas/transactions/${encodeURIComponent(transactionId)}`),
      /** POST /autoramp/vas/transactions/{id}/sync — poll for the final status. */
      syncTransaction: (transactionId: string) =>
        http.post<VasTransaction>(
          `/autoramp/vas/transactions/${encodeURIComponent(transactionId)}/sync`,
        ),
    },
  },
};

export { ApiError, isAuthenticated, clearTokens, getAccessToken } from "./client";
export type * from "./types";
