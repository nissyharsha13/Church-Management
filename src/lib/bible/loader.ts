import type { VerseRef } from "./reference";

/** chapters[chapterIndex][verseIndex] = text ("" missing, "^N" = merged into verse N) */
type BookData = { c: string[][] };

const CACHE_NAME = "bibles-v1";
const memory = new Map<string, Promise<BookData>>();

function url(translationId: string, book: string) {
  return `/bibles/${translationId}/${book}.json`;
}

async function fetchBook(translationId: string, book: string): Promise<BookData> {
  const u = url(translationId, book);
  // Offline-first: Cache Storage (filled by prepareOffline) before network.
  if (typeof caches !== "undefined") {
    try {
      const cache = await caches.open(CACHE_NAME);
      const hit = await cache.match(u);
      if (hit) return hit.json();
      const res = await fetch(u);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${u}`);
      await cache.put(u, res.clone());
      return res.json();
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("HTTP")) throw e;
      // Cache API unavailable (e.g. insecure context) -> plain fetch below.
    }
  }
  const res = await fetch(u);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${u}`);
  return res.json();
}

export function loadBook(translationId: string, book: string): Promise<BookData> {
  const key = `${translationId}/${book}`;
  let p = memory.get(key);
  if (!p) {
    p = fetchBook(translationId, book);
    p.catch(() => memory.delete(key));
    memory.set(key, p);
  }
  return p;
}

export interface Verse {
  n: number;
  text: string;
  /** Set when this verse is printed together with others, e.g. "3-4". */
  label?: string;
}

/** Load the verses of a passage. Combined verses (IRV "3-4") are returned once with a range label. */
export async function getPassage(translationId: string, ref: VerseRef): Promise<Verse[]> {
  const data = await loadBook(translationId, ref.book);
  const chapter = data.c[ref.chapter - 1] ?? [];
  const out: Verse[] = [];
  const seen = new Set<number>();
  for (let n = ref.start; n <= Math.min(ref.end, chapter.length); n++) {
    let raw = chapter[n - 1] ?? "";
    let anchor = n;
    if (raw.startsWith("^")) {
      anchor = +raw.slice(1);
      raw = chapter[anchor - 1] ?? "";
    }
    if (!raw || seen.has(anchor)) continue;
    seen.add(anchor);
    let last = anchor;
    while ((chapter[last] ?? "") === `^${anchor}`) last++;
    out.push({ n: anchor, text: raw, label: last > anchor ? `${anchor}-${last}` : undefined });
  }
  return out;
}

/** Download every book of the given translations into Cache Storage for offline use. */
export async function prepareOffline(
  translationIds: string[],
  books: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const cache = await caches.open(CACHE_NAME);
  const jobs = translationIds.flatMap((t) => books.map((b) => url(t, b)));
  let done = 0;
  const queue = [...jobs];
  const worker = async () => {
    for (let u = queue.shift(); u; u = queue.shift()) {
      if (!(await cache.match(u))) {
        const res = await fetch(u);
        if (res.ok) await cache.put(u, res);
      }
      onProgress?.(++done, jobs.length);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
}

export async function offlineStatus(translationIds: string[], books: string[]): Promise<number> {
  if (typeof caches === "undefined") return 0;
  const cache = await caches.open(CACHE_NAME);
  const keys = new Set((await cache.keys()).map((r) => new URL(r.url).pathname));
  const want = translationIds.flatMap((t) => books.map((b) => url(t, b)));
  return want.filter((u) => keys.has(u)).length / Math.max(1, want.length);
}
