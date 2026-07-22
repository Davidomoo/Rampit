import { NextResponse } from "next/server";

/**
 * Catch-all proxy to the Rampit backend (Fastify).
 *
 * The browser calls `/api/backend/<path>` and this forwards to
 * `RAMPIT_API_BASE/<path>`, passing the caller's Authorization header
 * through. Keeps the backend origin server-side and sidesteps CORS.
 */
const API_BASE = process.env.RAMPIT_API_BASE?.trim() || "https://api.rampit.xyz/api/v1";

/** Only these are forwarded upstream — never cookies or host headers. */
const FORWARD_HEADERS = ["authorization", "content-type"];

async function proxy(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const search = new URL(request.url).search;
  const target = `${API_BASE}/${path.join("/")}${search}`;

  const headers = new Headers();
  for (const name of FORWARD_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (!headers.has("content-type")) headers.set("content-type", "application/json");

  const hasBody = request.method !== "GET" && request.method !== "DELETE";
  const body = hasBody ? await request.text() : undefined;

  let response: Response;
  try {
    response = await fetch(target, {
      method: request.method,
      headers,
      body: body || undefined,
      cache: "no-store",
    });
  } catch (error) {
    console.error("Backend proxy failed:", target, error);
    return NextResponse.json(
      { success: false, message: "Unable to reach the Rampit API" },
      { status: 502 },
    );
  }

  const text = await response.text();
  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { success: false, message: text || "Unexpected response from the Rampit API" };
  }

  return NextResponse.json(payload, { status: response.status });
}

export async function GET(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(request, ctx);
}
export async function POST(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(request, ctx);
}
export async function PATCH(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(request, ctx);
}
export async function PUT(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(request, ctx);
}
export async function DELETE(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(request, ctx);
}
