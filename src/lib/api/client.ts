import type { ApiEnvelope } from "./types";

/**
 * Base for every backend call. Defaults to the Next proxy at
 * `/api/backend/*` (see `app/api/backend/[...path]/route.ts`); set
 * NEXT_PUBLIC_API_BASE to hit a backend origin directly instead.
 */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE?.trim() || "/api/backend";

export const ACCESS_TOKEN_KEY = "rampit_access_token";
export const REFRESH_TOKEN_KEY = "rampit_refresh_token";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ── Token storage ────────────────────────────────────────────────────────────

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken?: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return !!getAccessToken();
}

// ── Request plumbing ─────────────────────────────────────────────────────────

type Query = Record<string, string | number | boolean | undefined>;

function buildUrl(path: string, query?: Query): string {
  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  if (!query) return url;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${url}?${qs}` : url;
}

async function parse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  if (!response.ok) {
    const message =
      (body as { message?: string; error?: string } | null)?.message ??
      (body as { error?: string } | null)?.error ??
      `Request failed (${response.status})`;
    throw new ApiError(message, response.status);
  }

  // The backend wraps successful payloads as { success, data }.
  const envelope = body as ApiEnvelope<T> | null;
  if (envelope && typeof envelope === "object" && "data" in envelope && "success" in envelope) {
    return envelope.data;
  }
  return body as T;
}

/** Swap an expired access token for a fresh one. Returns false if not possible. */
let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const refresh_token = getRefreshToken();
  if (!refresh_token) return false;

  refreshInFlight ??= (async () => {
    try {
      const response = await fetch(buildUrl("/auth/refresh"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token }),
      });
      const data = await parse<{ access_token: string }>(response);
      setTokens(data.access_token);
      return true;
    } catch {
      clearTokens();
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

interface RequestOptions {
  query?: Query;
  body?: unknown;
  /** Skip the bearer token (public endpoints such as sign-in). */
  anonymous?: boolean;
}

async function request<T>(
  method: string,
  path: string,
  { query, body, anonymous }: RequestOptions = {},
  isRetry = false,
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = anonymous ? null : getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  // One transparent refresh-and-retry on an expired access token.
  if (response.status === 401 && !anonymous && !isRetry && (await refreshAccessToken())) {
    return request<T>(method, path, { query, body, anonymous }, true);
  }

  return parse<T>(response);
}

export const http = {
  get: <T>(path: string, query?: Query) => request<T>("GET", path, { query }),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "body">) =>
    request<T>("POST", path, { ...opts, body }),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, { body }),
  delete: <T>(path: string) => request<T>("DELETE", path),
};
