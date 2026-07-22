/** Response shapes returned by the Rampit backend (`backend/src/modules/*`). */

export type ApiEnvelope<T> = { success: boolean; data: T; message?: string };

// ── Auth & users ─────────────────────────────────────────────────────────────

export type UserStatus = "active" | "inactive" | "blocked";
export type UserType = "user" | "admin";

export interface User {
  id: string;
  email: string;
  username: string | null;
  firstname: string | null;
  lastname: string | null;
  middlename: string | null;
  phone: string | null;
  gender: "male" | "female" | "other" | null;
  dob: string | null;
  house_number: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  zipcode: string | null;
  nin: string | null;
  nin_verified_at: string | null;
  bvn: string | null;
  bvn_verified_at: string | null;
  status: UserStatus;
  type: UserType;
  email_verified_at: string | null;
  phone_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LoginResponse {
  /** `register` on first sign-in, `login` for returning users. */
  action: "register" | "login";
}

export interface Session {
  access_token: string;
  refresh_token: string;
  user: User;
}

export interface UpdateProfilePayload {
  username?: string;
  firstname?: string;
  lastname?: string;
  middlename?: string;
  phone?: string;
  gender?: "male" | "female" | "other";
  dob?: string;
  house_number?: string;
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  zipcode?: string;
}

// ── Banking & KYC ────────────────────────────────────────────────────────────

export interface BankAccount {
  id: string;
  user_id: string;
  autoramp_id: string;
  external_reference: string;
  account_number: string;
  account_name: string | null;
  bank_code: string | null;
  status: string | null;
  /** Live from the provider — absent if the balance lookup failed. */
  accountBalance?: number;
  bookBalance?: number;
  created_at: string;
}

export type IdentityType = "BVN" | "NIN" | "vNIN" | "BVNUSSD" | "CAC" | "CREDITCHECK";
export type SubAccountIdentityType = "BVN" | "NIN" | "vNIN" | "BVNUSSD" | "vID";

export interface ProvisionAccountPayload {
  identityType?: SubAccountIdentityType;
  identityNumber?: string;
  identityId?: string;
  otp?: string;
}

export interface StartKycPayload {
  type: IdentityType;
  number: string;
  otp?: string;
  verifierId?: string;
}

export interface StartKycResponse {
  identityId: string;
  status: string;
}

export interface CompleteKycPayload {
  identityId: string;
  type: "BVN" | "NIN";
  otp: string;
}

export interface CompleteKycResponse {
  identityId: string;
  status: string;
}

export interface KycRecord {
  id: string;
  identity_id: string;
  type: IdentityType;
  status: string;
  verified_at: string | null;
  created_at: string;
}

// ── AutoRamp ─────────────────────────────────────────────────────────────────

export type RampNetwork = "base" | "bsc";
export type TransactionStatus =
  | "INITIALIZED"
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export interface Bank {
  code?: string;
  name?: string;
  bankCode?: string;
  bankName?: string;
}

export interface ResolvedAccount {
  accountName: string;
  accountNumber: string;
  bankCode: string;
  bankName?: string;
}

export interface UsdNgnRate {
  rate: number;
  timestamp: string;
}

export interface OnrampPayload {
  network: RampNetwork;
  /** NGN, minimum 1000. */
  amount: number;
  destination: { address: string };
}

export interface OfframpPayload {
  network: RampNetwork;
  amount: number;
  destination: { bankCode: string; accountNumber: string };
}

export interface RampTransaction {
  id: string;
  reference: string;
  amount: number;
  status: TransactionStatus;
  type?: string;
  createdAt: string;
  tokenAmount?: string;
  tokenType?: string;
  network?: string;
  destinationAddress?: string;
  transactionHash?: string;
  completedAt?: string;
}

export interface OnrampResponse extends RampTransaction {
  depositAccount?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
}

export interface OfframpResponse extends RampTransaction {
  fiatAmount?: string;
  depositAddress?: string;
}

/** GET /autoramp/ramp/transactions groups by product rather than one flat list. */
export interface RampTransactionsResponse {
  onramp: RampTransaction[];
  offramp: RampTransaction[];
  swap: RampTransaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface RampTransactionsQuery {
  id?: string;
  reference?: string;
  page?: number;
  limit?: number;
}

// ── Swap ─────────────────────────────────────────────────────────────────────

export interface InitializeSwapPayload {
  amount: number;
  usdcAmount: number;
  slippage: number;
  offrampDestination: { bankCode: string; accountNumber: string };
  network?: RampNetwork;
}

export interface CompleteSwapPayload {
  transactionHash: string;
  sourceAddress: string;
}

export interface CreateSwapPayload {
  fromTokenType: string;
  toTokenType: string;
  fromAmount: number;
  toAmount: number;
  exchangeRate: number;
  sourceAddress: string;
  destinationAddress: string;
  network?: RampNetwork;
  slippage?: number;
}

// ── Value Added Services ─────────────────────────────────────────────────────

export type VasChannel = "WEB" | "POS" | "ATM";

export interface VasService {
  _id: string;
  name: string;
  identifier?: string;
  slug?: string;
  description?: string;
}

export interface VasCategory {
  _id: string;
  name: string;
  identifier?: string;
  slug?: string;
  serviceId?: string;
}

export interface VasProduct {
  _id: string;
  bundleCode: string;
  name: string;
  amount: number;
  validity?: string;
}

export interface VasVerifyPayload {
  serviceCategoryId: string;
  /** Meter number (utility) or smartcard / IUC number (cable TV). */
  entityNumber: string;
}

export interface VasPowerVerification {
  meterNumber: string;
  meterType: string;
  vendType: string;
  customerName: string;
  address?: string;
}

export interface VasCableVerification {
  cardNumber: string;
  customerName: string;
  smartCardType: string;
  status: string;
}

export type VasVerification = VasPowerVerification | VasCableVerification;

interface VasPayBase {
  serviceCategoryId: string;
  amount: number;
  channel?: VasChannel;
  externalReference?: string;
}

export interface PayAirtimePayload extends VasPayBase {
  phoneNumber: string;
}

export interface PayDataPayload extends VasPayBase {
  bundleCode: string;
  phoneNumber: string;
}

export interface PayCableTvPayload extends VasPayBase {
  bundleCode: string;
  cardNumber: string;
}

export interface PayUtilityPayload extends VasPayBase {
  meterNumber: string;
  /** `prepaid` or `postpaid` — from the verify call. */
  vendType: string;
}

export interface VasPaymentResponse {
  transactionId: string;
  reference: string;
  status: TransactionStatus;
}

export interface VasTransaction {
  id: string;
  reference: string;
  serviceType: "airtime" | "data" | "cable_tv" | "utility";
  amount: number;
  status: TransactionStatus;
  phoneNumber?: string;
  /** Prepaid electricity tokens arrive here. */
  providerResponse?: Record<string, unknown>;
  createdAt: string;
  completedAt?: string;
}

export interface Paginated<T> {
  data: T[];
  pagination?: { page: number; limit: number; total: number; totalPages?: number };
}
