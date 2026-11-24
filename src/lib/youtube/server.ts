import "server-only";
import { cookies } from "next/headers";
import { authSecret } from "@/lib/auth/session";
import { seal, unseal } from "./crypto";

/**
 * YouTube Data API v3 access for the church channel.
 * Google endpoints are overridable so tests can run against a local mock.
 * See docs/YOUTUBE-SETUP.md and docs/DECISIONS.md D-016.
 */
export const GOOGLE = {
  authUrl: process.env.GOOGLE_OAUTH_BASE || "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: process.env.GOOGLE_TOKEN_URL || "https://oauth2.googleapis.com/token",
  revokeUrl: process.env.GOOGLE_REVOKE_URL || "https://oauth2.googleapis.com/revoke",
  api: process.env.YOUTUBE_API_BASE || "https://www.googleapis.com/youtube/v3",
  scope: "https://www.googleapis.com/auth/youtube",
};

export function googleClient() {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  return id && secret ? { id, secret } : null;
}

export const YT_COOKIE = "cm_youtube";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export interface YouTubeSession {
  refreshToken: string;
  accessToken?: string;
  /** ms epoch */
  expiresAt?: number;
  channel: { id: string; title: string; thumbnail: string; url: string };
  /** The reusable stream (permanent key) created for this channel */
  streamId?: string;
}

export class YouTubeError extends Error {
  constructor(message: string, public status = 500, public code = "youtube_error") {
    super(message);
  }
}

export async function readSession(): Promise<YouTubeSession | null> {
  const secret = authSecret();
  if (!secret) return null;
  const jar = await cookies();
  return unseal<YouTubeSession>(jar.get(YT_COOKIE)?.value, secret);
}

export async function writeSession(s: YouTubeSession | null) {
  const jar = await cookies();
  if (!s) {
    jar.delete(YT_COOKIE);
    return;
  }
  const secret = authSecret();
  if (!secret) throw new YouTubeError("AUTH_SECRET missing", 503, "not_configured");
  jar.set(YT_COOKIE, await seal(s, secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/youtube",
    maxAge: COOKIE_MAX_AGE,
  });
}

/** Exchange an auth code or refresh token at Google's token endpoint. */
export async function tokenRequest(params: Record<string, string>) {
  const client = googleClient();
  if (!client) throw new YouTubeError("Google client not configured", 503, "not_configured");
  const res = await fetch(GOOGLE.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: client.id, client_secret: client.secret, ...params }),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reconnect = data.error === "invalid_grant";
    throw new YouTubeError(data.error_description || data.error || "token request failed", reconnect ? 401 : 502, reconnect ? "reconnect" : "token_failed");
  }
  return data as { access_token: string; expires_in: number; refresh_token?: string };
}

/** A valid access token, refreshing (and re-saving the cookie) when needed. */
async function accessToken(s: YouTubeSession): Promise<string> {
  if (s.accessToken && s.expiresAt && s.expiresAt - Date.now() > 60_000) return s.accessToken;
  const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: s.refreshToken });
  s.accessToken = t.access_token;
  s.expiresAt = Date.now() + t.expires_in * 1000;
  await writeSession(s);
  return s.accessToken;
}

/** Call the YouTube Data API as the connected channel. */
export async function yt<T = Record<string, unknown>>(
  s: YouTubeSession,
  path: string,
  init: { method?: string; query?: Record<string, string>; body?: unknown } = {},
): Promise<T> {
  const token = await accessToken(s);
  const url = `${GOOGLE.api}/${path}${init.query ? `?${new URLSearchParams(init.query)}` : ""}`;
  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: { authorization: `Bearer ${token}`, ...(init.body ? { "content-type": "application/json" } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  if (res.status === 204) return {} as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason: string = data?.error?.errors?.[0]?.reason ?? "";
    const message: string = data?.error?.message ?? `YouTube API ${res.status}`;
    const code = reason === "liveStreamingNotEnabled" ? "live_not_enabled"
      : reason === "quotaExceeded" ? "quota"
      : res.status === 401 ? "reconnect"
      : reason || "youtube_error";
    throw new YouTubeError(message, res.status, code);
  }
  return data as T;
}

/** YouTube rejects "<" and ">" in titles/descriptions; titles max 100 chars. */
export function cleanTitle(s: string) {
  return s.replace(/[<>]/g, "").trim().slice(0, 100) || "Live";
}
export function cleanDescription(s: string) {
  return s.replace(/[<>]/g, "").slice(0, 4900);
}

export async function requireSession(): Promise<YouTubeSession> {
  const s = await readSession();
  if (!s) throw new YouTubeError("YouTube is not connected", 401, "not_connected");
  return s;
}

export function errorResponse(e: unknown) {
  const err = e instanceof YouTubeError ? e : new YouTubeError((e as Error)?.message ?? "error");
  if (!(e instanceof YouTubeError)) console.error("youtube route failed:", e);
  return Response.json({ error: err.code, message: err.message }, { status: err.status });
}
