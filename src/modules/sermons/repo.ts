import { db, DEFAULT_CHURCH_ID, getSettings } from "@/lib/db";
import { newId, todayISO, type Sermon } from "./types";

export async function createSermon(partial: Partial<Sermon> = {}): Promise<Sermon> {
  const s = await getSettings();
  const now = Date.now();
  const sermon: Sermon = {
    id: newId(),
    churchId: DEFAULT_CHURCH_ID,
    title: "",
    date: todayISO(),
    serviceName: "Sunday Service",
    speaker: s.defaultSpeaker,
    gist: "",
    status: "draft",
    points: [{ id: newId(), title: "", notes: "" }],
    verses: [],
    media: [],
    primaryTranslation: s.defaultPrimaryTranslation,
    secondaryTranslation: s.defaultSecondaryTranslation,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
  await db.sermons.add(sermon);
  return sermon;
}

export async function saveSermon(sermon: Sermon): Promise<void> {
  await db.sermons.put({ ...sermon, updatedAt: Date.now() });
}

export async function deleteSermon(id: string): Promise<void> {
  await db.sermons.delete(id);
}

export async function duplicateSermon(id: string): Promise<Sermon | null> {
  const src = await db.sermons.get(id);
  if (!src) return null;
  const pointMap = new Map(src.points.map((p) => [p.id, newId()]));
  return createSermon({
    ...src,
    id: newId(),
    title: `${src.title} (copy)`,
    status: "draft",
    date: todayISO(),
    points: src.points.map((p) => ({ ...p, id: pointMap.get(p.id)! })),
    verses: src.verses.map((v) => ({ ...v, id: newId(), pointId: v.pointId ? pointMap.get(v.pointId) ?? null : null })),
    media: src.media.map((m) => ({ ...m, id: newId(), pointId: m.pointId ? pointMap.get(m.pointId) ?? null : null })),
  });
}

/** A realistic sample so the console can be tried immediately. */
export async function createSampleSermon(): Promise<Sermon> {
  const p1 = newId(), p2 = newId(), p3 = newId();
  return createSermon({
    title: "తుఫానులో విశ్వాసం — Faith in the Storm",
    gist: "యేసు మన పడవలో ఉన్నప్పుడు తుఫాను మనలను ముంచలేదు. Fear asks 'Don't you care?'; faith rests in who is in the boat.",
    date: todayISO(),
    points: [
      { id: p1, title: "తుఫాను వస్తుంది — Storms come", notes: "• శిష్యులు యేసు మాట ప్రకారమే బయలుదేరారు, అయినా తుఫాను వచ్చింది\n• Obedience doesn't exempt us from storms\n• Share: a storm in your own life", minutes: 8 },
      { id: p2, title: "యేసు పడవలో ఉన్నాడు — Jesus is in the boat", notes: "• He was asleep — not absent\n• 'Teacher, don't you care?' (Mark 4:38)\n• Isaiah 43:2 — when you pass through the waters", minutes: 12 },
      { id: p3, title: "నెమ్మదించు — Peace, be still", notes: "• His word calms the wind\n• Invitation: hand over your storm today\n• Prayer", minutes: 7 },
    ],
    verses: [
      { id: newId(), pointId: p1, ref: { book: "MRK", chapter: 4, start: 35, end: 38 } },
      { id: newId(), pointId: p2, ref: { book: "ISA", chapter: 43, start: 2, end: 2 } },
      { id: newId(), pointId: p2, ref: { book: "PSA", chapter: 46, start: 1, end: 3 } },
      { id: newId(), pointId: p3, ref: { book: "MRK", chapter: 4, start: 39, end: 41 } },
      { id: newId(), pointId: p3, ref: { book: "JHN", chapter: 14, start: 27, end: 27 } },
      { id: newId(), pointId: null, ref: { book: "PSA", chapter: 23, start: 1, end: 6 } },
    ],
    status: "ready",
  });
}
