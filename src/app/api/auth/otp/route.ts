import { NextResponse } from "next/server";

const OTP_LENGTH = 6;
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const otpStore = new Map<string, { code: string; expires: number }>();

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function makeCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function buildEmailHtml(code: string) {
  return `
    <div style="font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827;">
      <div style="max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 24px; background: #ffffff;">
        <h1 style="font-size: 22px; font-weight: 700; margin-bottom: 16px;">Rampit verification code</h1>
        <p style="margin: 0 0 24px; line-height: 1.6; color: #6b7280;">Use the code below to sign in to Rampit. It expires in 10 minutes.</p>
        <div style="display: inline-flex; padding: 18px 24px; background: #111827; border-radius: 16px; color: #ffffff; font-size: 28px; letter-spacing: 0.15em; font-weight: 700;">${code}</div>
        <p style="margin: 24px 0 0; line-height: 1.6; color: #6b7280;">If you did not request this code, you can safely ignore this email.</p>
      </div>
    </div>
  `;
}

async function sendEmail(email: string, code: string) {
  const localEndpoint = process.env.EMAIL_SERVICE_URL?.trim();

  if (localEndpoint) {
    const response = await fetch(localEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, code }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error("Local email service failed:", response.status, body);
      throw new Error("Failed to send verification email via local service");
    }

    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY environment variable");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Rampit <noreply@rampit.xyz>",
      to: email,
      subject: "Your Rampit verification code",
      html: buildEmailHtml(code),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("Resend email failed:", response.status, body);
    throw new Error("Failed to send verification email");
  }
}

function cleanupExpiredOtps() {
  const now = Date.now();
  for (const [email, record] of otpStore.entries()) {
    if (record.expires <= now) {
      otpStore.delete(email);
    }
  }
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const email = payload?.email?.toString()?.trim();

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 422 });
  }

  cleanupExpiredOtps();
  const normalizedEmail = normalizeEmail(email);
  const code = makeCode();
  otpStore.set(normalizedEmail, { code, expires: Date.now() + OTP_TTL_MS });

  await sendEmail(normalizedEmail, code);
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const payload = await request.json().catch(() => null);
  const email = payload?.email?.toString()?.trim();
  const code = payload?.code?.toString()?.trim();

  if (!email || !isValidEmail(email) || !code || code.length !== OTP_LENGTH) {
    return NextResponse.json({ error: "Invalid verification request" }, { status: 422 });
  }

  cleanupExpiredOtps();
  const normalizedEmail = normalizeEmail(email);
  const record = otpStore.get(normalizedEmail);

  if (!record || record.code !== code || record.expires <= Date.now()) {
    return NextResponse.json({ error: "Incorrect or expired code" }, { status: 400 });
  }

  otpStore.delete(normalizedEmail);
  return NextResponse.json({ ok: true });
}
