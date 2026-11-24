import { cleanDescription, cleanTitle, errorResponse, requireSession, yt, YouTubeError } from "@/lib/youtube/server";
import { ensureStream } from "@/lib/youtube/stream";

/** Create a broadcast for a sermon and bind it to the permanent stream. */
export async function POST(req: Request) {
  try {
    const s = await requireSession();
    const body = await req.json().catch(() => ({}));
    const privacy = ["public", "unlisted", "private"].includes(body.privacy) ? body.privacy : "unlisted";
    const start = body.scheduledStart && !Number.isNaN(Date.parse(body.scheduledStart)) ? new Date(body.scheduledStart) : new Date();
    // YouTube rejects start times in the past for new broadcasts.
    const scheduledStartTime = new Date(Math.max(start.getTime(), Date.now() + 60_000)).toISOString();
    const ingest = await ensureStream(s);
    const b = await yt<{ id: string }>(s, "liveBroadcasts", {
      method: "POST",
      query: { part: "snippet,status,contentDetails" },
      body: {
        snippet: { title: cleanTitle(String(body.title ?? "")), description: cleanDescription(String(body.description ?? "")), scheduledStartTime },
        status: { privacyStatus: privacy, selfDeclaredMadeForKids: false },
        contentDetails: {
          enableAutoStart: !!body.autoStart,
          enableAutoStop: true,
          enableDvr: true,
          recordFromStart: true,
          latencyPreference: "normal",
          // No separate "testing" phase: go straight from ready to live.
          monitorStream: { enableMonitorStream: false },
        },
      },
    });
    if (!b?.id) throw new YouTubeError("Broadcast was not created", 502);
    await yt(s, "liveBroadcasts/bind", { method: "POST", query: { id: b.id, part: "id,contentDetails", streamId: ingest.streamId } });
    return Response.json({ id: b.id, url: `https://youtu.be/${b.id}`, studioUrl: `https://studio.youtube.com/video/${b.id}/livestreaming`, privacy, scheduledStart: scheduledStartTime });
  } catch (e) {
    return errorResponse(e);
  }
}
