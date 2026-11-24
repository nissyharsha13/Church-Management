import { errorResponse, requireSession, yt } from "@/lib/youtube/server";
import { streamHealth } from "@/lib/youtube/stream";

type BroadcastList = {
  items?: {
    id: string;
    snippet: { title: string; scheduledStartTime?: string; actualStartTime?: string; actualEndTime?: string };
    status: { lifeCycleStatus: string; privacyStatus: string };
    contentDetails: { boundStreamId?: string; enableAutoStart?: boolean };
  }[];
};
type VideoList = { items?: { liveStreamingDetails?: { concurrentViewers?: string } }[] };

/** Broadcast state + stream signal + live viewers, in one call for the console. */
export async function GET(_req: Request, ctx: RouteContext<"/api/youtube/broadcasts/[id]">) {
  try {
    const { id } = await ctx.params;
    const s = await requireSession();
    const b = (await yt<BroadcastList>(s, "liveBroadcasts", { query: { part: "snippet,status,contentDetails", id } })).items?.[0];
    if (!b) return Response.json({ error: "not_found", message: "Broadcast not found (deleted in YouTube Studio?)" }, { status: 404 });
    const streamId = b.contentDetails.boundStreamId ?? s.streamId;
    const [health, video] = await Promise.all([
      streamId ? streamHealth(s, streamId) : Promise.resolve({ streamStatus: "unbound", health: "noData" }),
      b.status.lifeCycleStatus === "live" ? yt<VideoList>(s, "videos", { query: { part: "liveStreamingDetails", id } }) : Promise.resolve({} as VideoList),
    ]);
    const viewers = video.items?.[0]?.liveStreamingDetails?.concurrentViewers;
    return Response.json({
      id,
      title: b.snippet.title,
      lifeCycleStatus: b.status.lifeCycleStatus,
      privacy: b.status.privacyStatus,
      scheduledStart: b.snippet.scheduledStartTime ?? null,
      actualStart: b.snippet.actualStartTime ?? null,
      actualEnd: b.snippet.actualEndTime ?? null,
      autoStart: !!b.contentDetails.enableAutoStart,
      ...health,
      viewers: viewers !== undefined ? Number(viewers) : null,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
