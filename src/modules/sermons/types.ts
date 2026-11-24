import type { VerseRef } from "@/lib/bible/reference";

export type SermonStatus = "draft" | "ready" | "delivered";

/** One pointer / section of the sermon — the "cue list" the console walks through. */
export interface SermonPoint {
  id: string;
  title: string;
  notes: string;
  /** Optional time guidance for the preacher, in minutes. */
  minutes?: number;
}

export interface VerseCue {
  id: string;
  /** null = not tied to a point ("general" verses) */
  pointId: string | null;
  ref: VerseRef;
}

export interface MediaCue {
  id: string;
  pointId: string | null;
  mediaId: string;
}

export interface Sermon {
  id: string;
  churchId: string;
  /** Topic / title */
  title: string;
  /** ISO date YYYY-MM-DD of the service */
  date: string;
  /** e.g. "Sunday Morning", "Cottage Prayer" — becomes a Service entity later (see docs/DATA-MODEL.md) */
  serviceName: string;
  speaker: string;
  /** Short gist of the message */
  gist: string;
  status: SermonStatus;
  points: SermonPoint[];
  verses: VerseCue[];
  media: MediaCue[];
  /** Translation shown first (Telugu by default) and the one shown under it. */
  primaryTranslation: string;
  secondaryTranslation: string;
  /** YouTube live broadcast created for this sermon (see docs/DECISIONS.md D-016) */
  youtube?: YouTubeLink;
  createdAt: number;
  updatedAt: number;
}

export interface YouTubeLink {
  broadcastId: string;
  url: string;
  studioUrl: string;
  privacy: StreamPrivacy;
  scheduledStart: string;
}

export type StreamPrivacy = "public" | "unlisted" | "private";

export function newId(): string {
  return crypto.randomUUID();
}

export function todayISO(d = new Date()): string {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}
