import { NextResponse, type NextRequest } from "next/server";
import { GOOGLE, googleClient } from "@/lib/youtube/server";

/** Start Google sign-in for the church's YouTube channel. */
export async function GET(req: NextRequest) {
  const client = googleClient();
  if (!client) return NextResponse.redirect(new URL("/settings?youtube=not_configured", req.url));
  const state = crypto.randomUUID();
  const url = new URL(GOOGLE.authUrl);
  url.search = new URLSearchParams({
    client_id: client.id,
    redirect_uri: `${req.nextUrl.origin}/api/youtube/callback`,
    response_type: "code",
    scope: GOOGLE.scope,
    access_type: "offline",
    prompt: "consent select_account",
    include_granted_scopes: "true",
    state,
  }).toString();
  const res = NextResponse.redirect(url);
  // CSRF protection: the callback must return the same state.
  res.cookies.set("cm_yt_state", state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/api/youtube", maxAge: 600 });
  return res;
}
