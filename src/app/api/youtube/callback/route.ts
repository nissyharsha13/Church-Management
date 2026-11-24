import { NextResponse, type NextRequest } from "next/server";
import { tokenRequest, writeSession, yt, YouTubeError, type YouTubeSession } from "@/lib/youtube/server";

type ChannelList = { items?: { id: string; snippet: { title: string; customUrl?: string; thumbnails?: { default?: { url: string } } } }[] };

export async function GET(req: NextRequest) {
  const back = (q: string) => {
    const res = NextResponse.redirect(new URL(`/settings?youtube=${q}`, req.url));
    res.cookies.delete({ name: "cm_yt_state", path: "/api/youtube" });
    return res;
  };
  const params = req.nextUrl.searchParams;
  if (params.get("error")) return back(`error&reason=${encodeURIComponent(params.get("error")!)}`);
  const state = params.get("state");
  if (!state || state !== req.cookies.get("cm_yt_state")?.value) return back("error&reason=state");
  const code = params.get("code");
  if (!code) return back("error&reason=no_code");

  try {
    const t = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: `${req.nextUrl.origin}/api/youtube/callback` });
    if (!t.refresh_token) return back("error&reason=no_refresh_token");
    const draft: YouTubeSession = {
      refreshToken: t.refresh_token,
      accessToken: t.access_token,
      expiresAt: Date.now() + t.expires_in * 1000,
      channel: { id: "", title: "", thumbnail: "", url: "" },
    };
    const ch = await yt<ChannelList>(draft, "channels", { query: { part: "snippet", mine: "true" } });
    const c = ch.items?.[0];
    if (!c) return back("error&reason=no_channel");
    draft.channel = {
      id: c.id,
      title: c.snippet.title,
      thumbnail: c.snippet.thumbnails?.default?.url ?? "",
      url: c.snippet.customUrl ? `https://www.youtube.com/${c.snippet.customUrl}` : `https://www.youtube.com/channel/${c.id}`,
    };
    await writeSession(draft);
    return back("connected");
  } catch (e) {
    const reason = e instanceof YouTubeError ? e.code : "failed";
    console.error("youtube callback failed:", e);
    return back(`error&reason=${reason}`);
  }
}
