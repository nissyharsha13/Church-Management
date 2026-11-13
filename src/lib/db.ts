import Dexie, { type EntityTable } from "dexie";
import type { Sermon } from "@/modules/sermons/types";
import type { MediaFile, MediaItem } from "@/modules/media/types";

/**
 * Local-first storage (IndexedDB). Every record carries `churchId` so the same
 * schema can later sync to a multi-church cloud database (see docs/ARCHITECTURE.md).
 */
export interface ChurchSettings {
  id: string;
  name: string;
  /** Church name in Telugu script */
  nameTe: string;
  tagline: string;
  pastorName: string;
  address: string;
  serviceTimes: string;
  youtubeName: string;
  youtubeUrl: string;
  /** Uploaded logo (data URL, resized). Empty = bundled emblem. */
  logoDataUrl: string;
  /** Render the logo as a glossy gold silhouette (needs a transparent logo). */
  logoGold: boolean;
  uiLanguage: "en" | "te";
  defaultPrimaryTranslation: string;
  defaultSecondaryTranslation: string;
  defaultSpeaker: string;
}

export interface SessionEvent {
  t: number;
  kind: string;
  label: string;
}

/** A delivered session: what was shown and when (future: YouTube chapters, AI training data). */
export interface SermonSession {
  id: string;
  churchId: string;
  sermonId: string;
  startedAt: number;
  endedAt?: number;
  events: SessionEvent[];
}

export const DEFAULT_CHURCH_ID = "default";

/**
 * First-run church profile. Seeded from Divine Church's YouTube banner; every
 * field is editable in Settings. Another church only needs to change these.
 */
export const DEFAULT_SETTINGS: ChurchSettings = {
  id: DEFAULT_CHURCH_ID,
  name: "Divine Church",
  nameTe: "డివైన్ చర్చ్",
  tagline: "We Preach CHRIST Crucified — 1 Corinthians 1:23",
  pastorName: "Ps Prasanna Kumar",
  address: "5th Floor, Skyvue Banquet Hall, DNS Business Hub, Opp. Alanati, Manikonda, Hyderabad",
  serviceTimes: "Sunday · 10:30 AM",
  youtubeName: "Prasanna Kumar Official",
  youtubeUrl: "",
  logoDataUrl: "",
  logoGold: true,
  uiLanguage: "en",
  defaultPrimaryTranslation: "te-irv",
  defaultSecondaryTranslation: "en-kjv",
  defaultSpeaker: "Ps Prasanna Kumar",
};

/** Stored settings merged over defaults (older records lack newer fields). */
export function withDefaults(stored: Partial<ChurchSettings> | undefined): ChurchSettings {
  const s = { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
  // The pre-branding placeholder name is replaced by the real profile.
  if (stored?.name === "Our Church") s.name = DEFAULT_SETTINGS.name;
  return s;
}

class ChurchDB extends Dexie {
  churches!: EntityTable<ChurchSettings, "id">;
  sermons!: EntityTable<Sermon, "id">;
  media!: EntityTable<MediaItem, "id">;
  mediaFiles!: EntityTable<MediaFile, "id">;
  sessions!: EntityTable<SermonSession, "id">;

  constructor() {
    super("church-management");
    this.version(1).stores({
      churches: "id",
      sermons: "id, churchId, date, status, updatedAt",
      media: "id, churchId, createdAt",
      mediaFiles: "id",
      sessions: "id, churchId, sermonId, startedAt",
    });
  }
}

export const db = new ChurchDB();

export async function getSettings(): Promise<ChurchSettings> {
  return withDefaults(await db.churches.get(DEFAULT_CHURCH_ID));
}
