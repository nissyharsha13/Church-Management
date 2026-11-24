import { cleanDescription, errorResponse, requireSession, yt, YouTubeError } from "@/lib/youtube/server";
import { CHAPTERS_END, CHAPTERS_START, replaceChapters } from "@/modules/streaming/chapters";

type VideoSnippet = { items?: { snippet: { title: string; description: string; categoryId: string; tags?: string[]; defaultLanguage?: string; defaultAudioLanguage?: string } }[] };

/** Write (or replace) the chapter list in the video description after the service. */
export async function POST(req: Request, ctx: RouteContext<"/api/youtube/broadcasts/[id]/chapters">) {
  try {
    const { id } = await ctx.params;
    const { lines } = await req.json().catch(() => ({}));
    if (!Array.isArray(lines) || !lines.every((l) => typeof l === "string")) throw new YouTubeError("lines must be strings", 400, "bad_request");
    const s = await requireSession();
    const v = (await yt<VideoSnippet>(s, "videos", { query: { part: "snippet", id } })).items?.[0];
    if (!v) throw new YouTubeError("Video not found", 404, "not_found");
    const { title, categoryId, tags, defaultLanguage, defaultAudioLanguage } = v.snippet;
    const description = cleanDescription(replaceChapters(v.snippet.description ?? "", lines));
    await yt(s, "videos", {
      method: "PUT",
      query: { part: "snippet" },
      body: { id, snippet: { title, categoryId, tags, defaultLanguage, defaultAudioLanguage, description } },
    });
    return Response.json({ ok: true, markers: [CHAPTERS_START, CHAPTERS_END] });
  } catch (e) {
    return errorResponse(e);
  }
}
