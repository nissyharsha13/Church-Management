import canonData from "./data/canon.json";
import bookMeta from "./data/book-meta.json";

export type Lang = "en" | "te";

export interface BookNames {
  name: string;
  aliases: string[];
}

export interface Book {
  /** USFM book id, e.g. "JHN" */
  id: string;
  order: number;
  osis: string;
  testament: "OT" | "NT";
  names: Record<Lang, BookNames>;
}

export const BOOKS: Book[] = canonData as Book[];
export const BOOK_BY_ID: Record<string, Book> = Object.fromEntries(BOOKS.map((b) => [b.id, b]));

/** Verse counts per chapter (KJV versification). */
const META = bookMeta as Record<string, number[]>;

export function chapterCount(bookId: string): number {
  return META[bookId]?.length ?? 0;
}

export function verseCount(bookId: string, chapter: number): number {
  return META[bookId]?.[chapter - 1] ?? 0;
}

export function bookName(bookId: string, lang: Lang): string {
  const b = BOOK_BY_ID[bookId];
  return b?.names[lang]?.name ?? b?.names.en.name ?? bookId;
}
