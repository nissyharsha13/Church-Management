export type MediaKind = "video" | "image";
export type MediaSource = "file" | "youtube";

export interface MediaItem {
  id: string;
  churchId: string;
  title: string;
  kind: MediaKind;
  source: MediaSource;
  /** source=file: key into the mediaFiles table (Blob stored in IndexedDB, available offline) */
  fileId?: string;
  mime?: string;
  size?: number;
  /** source=youtube */
  youtubeId?: string;
  /** Optional clip trimming, seconds */
  startSec?: number;
  endSec?: number;
  tags: string[];
  createdAt: number;
}

export interface MediaFile {
  id: string;
  blob: Blob;
}

/** Extract an 11-char YouTube id from any common URL form, or accept a bare id. */
export function parseYouTubeId(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    if (u.hostname.endsWith("youtu.be")) return u.pathname.slice(1, 12) || null;
    if (u.hostname.includes("youtube")) {
      const v = u.searchParams.get("v");
      if (v) return v.slice(0, 11);
      const m = u.pathname.match(/\/(embed|shorts|live)\/([\w-]{11})/);
      if (m) return m[2];
    }
  } catch {
    /* not a URL */
  }
  return null;
}

/** Parse "1:23", "83", "1:02:03" into seconds. */
export function parseTime(s: string): number | undefined {
  const t = s.trim();
  if (!t) return undefined;
  const parts = t.split(":").map(Number);
  if (parts.some((n) => Number.isNaN(n))) return undefined;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

export function formatTime(sec?: number): string {
  if (sec === undefined || Number.isNaN(sec)) return "";
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
}
