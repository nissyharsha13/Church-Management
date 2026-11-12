import { BOOKS, BOOK_BY_ID, bookName, chapterCount, verseCount, type Lang } from "./canon";

/**
 * A passage inside one chapter. `start`/`end` are verse numbers (inclusive).
 * Cross-chapter passages are stored as two references.
 */
export interface VerseRef {
  book: string;
  chapter: number;
  start: number;
  end: number;
}

/** Lower-case, drop dots/spaces so "1 Cor." === "1cor" and "1 యోహాను" === "1యోహాను". */
export function normalizeBookKey(s: string): string {
  return s.toLowerCase().replace(/[.\s‌‍]/g, "");
}

const ALIAS_INDEX: Map<string, string> = (() => {
  const m = new Map<string, string>();
  const add = (alias: string, id: string) => {
    const k = normalizeBookKey(alias);
    if (k && !m.has(k)) m.set(k, id);
  };
  // Canonical names first so they win over ambiguous aliases.
  for (const b of BOOKS) for (const lang of Object.keys(b.names) as Lang[]) add(b.names[lang].name, b.id);
  for (const b of BOOKS) {
    add(b.id, b.id);
    add(b.osis, b.id);
    for (const lang of Object.keys(b.names) as Lang[]) for (const a of b.names[lang].aliases) add(a, b.id);
  }
  return m;
})();
const ALIAS_KEYS = [...ALIAS_INDEX.keys()];

/** Resolve a typed book name/abbreviation in any supported language. */
export function findBook(input: string): string | null {
  const k = normalizeBookKey(input);
  if (!k) return null;
  const exact = ALIAS_INDEX.get(k);
  if (exact) return exact;
  // Unique prefix match ("philip" -> PHP, "ప్రక" -> REV)
  const hits = new Set(ALIAS_KEYS.filter((a) => a.startsWith(k)).map((a) => ALIAS_INDEX.get(a)!));
  return hits.size === 1 ? [...hits][0] : null;
}

/** Books whose names start with the input — for autocomplete. */
export function suggestBooks(input: string, limit = 8): string[] {
  const k = normalizeBookKey(input);
  if (!k) return [];
  const ids: string[] = [];
  for (const a of ALIAS_KEYS) {
    if (a.startsWith(k)) {
      const id = ALIAS_INDEX.get(a)!;
      if (!ids.includes(id)) ids.push(id);
      if (ids.length >= limit) break;
    }
  }
  return ids;
}

const REF_RE = /^\s*((?:[1-3]\s*)?[^\d:]+?)\s*(\d+)(?:\s*[:.,\s]\s*(\d+)(?:\s*[-–—]\s*(\d+))?)?\s*$/u;

/**
 * Parse one reference: "John 3:16", "Jn 3 16-18", "1 Cor 13", "యోహాను 3:16", "కీర్తనలు 23".
 * Returns null if the book or numbers are invalid.
 */
export function parseReference(input: string): VerseRef | null {
  const m = input.match(REF_RE);
  if (!m) return null;
  const book = findBook(m[1]);
  if (!book) return null;
  const chapter = +m[2];
  if (chapter < 1 || chapter > chapterCount(book)) return null;
  const max = verseCount(book, chapter);
  let start = m[3] ? +m[3] : 1;
  let end = m[4] ? +m[4] : m[3] ? start : max;
  if (start < 1) return null;
  if (end < start) [start, end] = [end, start];
  // Allow a few verses beyond KJV counts (versification differences) but clamp absurd values.
  if (start > max + 3) return null;
  end = Math.min(end, max + 3);
  return { book, chapter, start, end };
}

/** Parse a list such as "John 3:16; Rom 5:8, Psalm 23". */
export function parseReferences(input: string): VerseRef[] {
  return input
    .split(/[;\n]|,(?=\s*(?:[1-3]\s*)?[^\d\s,])/u)
    .map((s) => parseReference(s))
    .filter((r): r is VerseRef => r !== null);
}

export function formatReference(ref: VerseRef, lang: Lang): string {
  const name = bookName(ref.book, lang);
  const whole = ref.start === 1 && ref.end >= verseCount(ref.book, ref.chapter);
  if (whole) return `${name} ${ref.chapter}`;
  return ref.start === ref.end ? `${name} ${ref.chapter}:${ref.start}` : `${name} ${ref.chapter}:${ref.start}-${ref.end}`;
}

export function isValidBook(id: string): boolean {
  return id in BOOK_BY_ID;
}
