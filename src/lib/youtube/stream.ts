import "server-only";
import { writeSession, yt, type YouTubeSession } from "./server";

export interface IngestInfo {
  streamId: string;
  server: string;
  rtmpsServer: string;
  key: string;
}

type StreamList = {
  items?: {
    id: string;
    cdn: { ingestionInfo: { ingestionAddress: string; rtmpsIngestionAddress?: string; streamName: string } };
    status?: { streamStatus: string; healthStatus?: { status: string } };
  }[];
};

/**
 * One reusable stream per channel = a permanent stream key. OBS is set up
 * once and every weekly broadcast binds to the same stream.
 */
export async function ensureStream(s: YouTubeSession): Promise<IngestInfo> {
  if (s.streamId) {
    const found = await yt<StreamList>(s, "liveStreams", { query: { part: "cdn,status", id: s.streamId } });
    const item = found.items?.[0];
    if (item) return toInfo(item);
  }
  const created = await yt<StreamList["items"] extends (infer I)[] | undefined ? I : never>(s, "liveStreams", {
    method: "POST",
    query: { part: "snippet,cdn,contentDetails,status" },
    body: {
      snippet: { title: "Church Management — permanent stream key" },
      cdn: { frameRate: "variable", ingestionType: "rtmp", resolution: "variable" },
      contentDetails: { isReusable: true },
    },
  });
  s.streamId = created.id;
  await writeSession(s);
  return toInfo(created);
}

function toInfo(item: NonNullable<StreamList["items"]>[number]): IngestInfo {
  const i = item.cdn.ingestionInfo;
  return { streamId: item.id, server: i.ingestionAddress, rtmpsServer: i.rtmpsIngestionAddress ?? "rtmps://a.rtmps.youtube.com:443/live2", key: i.streamName };
}

export async function streamHealth(s: YouTubeSession, streamId: string) {
  const r = await yt<StreamList>(s, "liveStreams", { query: { part: "status", id: streamId } });
  const st = r.items?.[0]?.status;
  return { streamStatus: st?.streamStatus ?? "unknown", health: st?.healthStatus?.status ?? "noData" };
}
