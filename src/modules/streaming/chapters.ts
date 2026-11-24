/**
 * YouTube chapters from the session log (what was shown on screen, and when).
 * YouTube rules: first chapter at 0:00, at least 3 chapters, each >= 10 s.
 */
export interface LogEvent {
  t: number;
  kind: string;
  label: string;
}

export const CHAPTERS_START = "— Chapters · అధ్యాయాలు —";
export const CHAPTERS_END = "— · —";
const MIN_GAP_S = 10;

function label(e: LogEvent): string | null {
  switch (e.kind) {
    case "begin": return "Message begins";
    case "title": return e.label ? `Message: ${e.label}` : "Message";
    case "verse": return e.label || null;
    case "media": return e.label ? `Video: ${e.label}` : "Video";
    case "prayer": return e.label ? `Prayer — ${e.label}` : "Prayer";
    default: return null; // blank, logo, clear, camera, welcome: not chapter-worthy
  }
}

export function formatOffset(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
}

/** Chapter lines like "12:40 Mark 4:35-38". Empty when YouTube wouldn't accept them. */
export function buildChapters(events: LogEvent[], streamStartMs: number, opening = "Welcome · స్వాగతం"): string[] {
  const chapters: { at: number; text: string }[] = [{ at: 0, text: opening }];
  for (const e of [...events].sort((a, b) => a.t - b.t)) {
    const text = label(e);
    if (!text) continue;
    const at = Math.floor((e.t - streamStartMs) / 1000);
    if (at <= 0) continue;
    const last = chapters[chapters.length - 1];
    if (last.text === text) continue;
    if (at - last.at < MIN_GAP_S) {
      // The previous item was only on screen briefly: the newer one replaces it.
      // (Content in the first 10 s becomes the 0:00 chapter — YouTube needs 0:00.)
      last.text = text;
      continue;
    }
    chapters.push({ at, text });
  }
  // Drop consecutive duplicates created by replacements.
  const dedup = chapters.filter((c, i) => i === 0 || c.text !== chapters[i - 1].text);
  if (dedup.length < 3) return [];
  return dedup.map((c) => `${formatOffset(c.at)} ${c.text}`);
}

/** Insert or replace the chapter block in a video description. */
export function replaceChapters(description: string, lines: string[]): string {
  const block = lines.length ? `${CHAPTERS_START}\n${lines.join("\n")}\n${CHAPTERS_END}` : "";
  const start = description.indexOf(CHAPTERS_START);
  if (start >= 0) {
    const endIdx = description.indexOf(CHAPTERS_END, start);
    const end = endIdx >= 0 ? endIdx + CHAPTERS_END.length : description.length;
    return (description.slice(0, start) + block + description.slice(end)).replace(/\n{3,}/g, "\n\n").trim();
  }
  return block ? `${description.trim()}\n\n${block}`.trim() : description;
}
