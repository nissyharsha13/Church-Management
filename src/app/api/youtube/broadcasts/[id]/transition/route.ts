import { errorResponse, requireSession, yt, YouTubeError } from "@/lib/youtube/server";

/** Go live / end the broadcast. Already-in-that-state is treated as success. */
export async function POST(req: Request, ctx: RouteContext<"/api/youtube/broadcasts/[id]/transition">) {
  try {
    const { id } = await ctx.params;
    const { to } = await req.json().catch(() => ({}));
    if (to !== "live" && to !== "complete") throw new YouTubeError("to must be live or complete", 400, "bad_request");
    const s = await requireSession();
    try {
      await yt(s, "liveBroadcasts/transition", { method: "POST", query: { broadcastStatus: to, id, part: "status" } });
    } catch (e) {
      if (e instanceof YouTubeError && e.code === "redundantTransition") return Response.json({ ok: true, already: true });
      if (e instanceof YouTubeError && e.code === "invalidTransition" && to === "live") {
        throw new YouTubeError("YouTube isn't receiving video yet — start streaming in OBS first, then try again.", 409, "no_signal");
      }
      throw e;
    }
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
