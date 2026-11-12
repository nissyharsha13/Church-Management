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
  tagline: string;
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

export const DEFAULT_SETTINGS: ChurchSettings = {
  id: DEFAULT_CHURCH_ID,
  name: "Our Church",
  tagline: "",
  uiLanguage: "en",
  defaultPrimaryTranslation: "te-irv",
  defaultSecondaryTranslation: "en-kjv",
  defaultSpeaker: "",
};

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
  return (await db.churches.get(DEFAULT_CHURCH_ID)) ?? DEFAULT_SETTINGS;
}
