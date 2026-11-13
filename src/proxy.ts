import { NextResponse, type NextRequest } from "next/server";
import { authSecret, cookieOptions, newSessionPayload, SESSION_COOKIE, SESSION_TTL_SEC, signSession, verifySession } from "@/lib/auth/session";

/**
 * Every page and API requires the admin session, except the login page/API and
 * static assets (see matcher). Fails closed when auth is not configured.
 */
export async function proxy(req: NextRequest) {
  const secret = authSecret();
  const session = secret ? await verifySession(req.cookies.get(SESSION_COOKIE)?.value, secret) : null;

  if (!session) {
    if (req.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const url = new URL("/login", req.url);
    const next = req.nextUrl.pathname + req.nextUrl.search;
    if (next !== "/") url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  }

  const res = NextResponse.next();
  // Sliding renewal: refresh when less than half the lifetime remains.
  if (session.exp - Date.now() / 1000 < SESSION_TTL_SEC / 2) {
    res.cookies.set(SESSION_COOKIE, await signSession(newSessionPayload(session.sub), secret!), cookieOptions);
  }
  return res;
}

export const config = {
  matcher: [
    // Everything except: login page + login/logout API, Next static files, public Bible data, public branding, favicon.
    "/((?!login|api/auth/login|api/auth/logout|_next/static|_next/image|bibles/|branding/|favicon.ico).*)",
  ],
};
