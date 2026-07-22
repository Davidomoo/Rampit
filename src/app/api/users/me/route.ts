import { NextResponse } from "next/server";

const API_BASE = process.env.RAMPIT_API_BASE?.trim() || "https://api.rampit.xyz/api/v1";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!auth) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  try {
    const response = await fetch(`${API_BASE}/users/me`, {
      headers: { Authorization: auth, "Content-Type": "application/json" },
    });
    const body = await response.json().catch(() => null);
    return NextResponse.json(body, { status: response.status });
  } catch (err) {
    console.error("Upstream users/me proxy error:", err);
    return NextResponse.json({ error: "Upstream request failed" }, { status: 502 });
  }
}

export async function PATCH(request: Request) {
  const auth = request.headers.get("authorization");
  if (!auth) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const payload = await request.json().catch(() => null);
  try {
    const response = await fetch(`${API_BASE}/users/me`, {
      method: "PATCH",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    const body = await response.json().catch(() => null);
    return NextResponse.json(body, { status: response.status });
  } catch (err) {
    console.error("Upstream users/me PATCH proxy error:", err);
    return NextResponse.json({ error: "Upstream request failed" }, { status: 502 });
  }
}
