import { errorResponse, requireSession } from "@/lib/youtube/server";
import { ensureStream } from "@/lib/youtube/stream";

/** The permanent ingest address + key (for OBS). Admin-only via the auth proxy. */
export async function POST() {
  try {
    return Response.json(await ensureStream(await requireSession()));
  } catch (e) {
    return errorResponse(e);
  }
}
