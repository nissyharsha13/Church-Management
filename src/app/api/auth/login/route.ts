import { NextResponse, type NextRequest } from "next/server";
import { adminConfig, safeEqual, verifyPassword } from "@/lib/auth/password";
import { authSecret, cookieOptions, newSessionPayload, SESSION_COOKIE, signSession } from "@/lib/auth/session";

// Simple per-instance brute-force throttle: 5 failures per 15 minutes per IP.
// (Serverless instances don't share memory — good enough for one admin; see docs/DECISIONS.md D-010.)
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const failures = new Map<string, { count: number; first: number }>();

export async function POST(req: NextRequest) {
  const admin = adminConfig();
  const secret = authSecret();
  if (!admin || !secret) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const f = failures.get(ip);
  if (f && now - f.first < WINDOW_MS && f.count >= MAX_FAILURES) {
    return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });
  }

  let body: { username?: unknown; password?: unknown };
  try { body = await req.json(); } catch { body = {}; }
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  // Always run the password check (even for a wrong username) so timing doesn't reveal which was wrong.
  const passOk = await verifyPassword(password, admin.passwordHash);
  const userOk = safeEqual(username.toLowerCase(), admin.username.toLowerCase());
  if (!passOk || !userOk) {
    const rec = f && now - f.first < WINDOW_MS ? f : { count: 0, first: now };
    rec.count++;
    failures.set(ip, rec);
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  failures.delete(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await signSession(newSessionPayload(admin.username), secret), cookieOptions);
  return res;
}
