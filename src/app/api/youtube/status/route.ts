import { googleClient, readSession } from "@/lib/youtube/server";

/** Is the Google client configured, and which channel is connected (if any)? */
export async function GET() {
  const s = await readSession();
  return Response.json({ configured: !!googleClient(), connected: !!s, channel: s?.channel ?? null });
}
