"use client";

import { BOOKS, BOOK_BY_ID, chapterCount, verseCount } from "@/lib/bible/canon";
import type { VerseRef } from "@/lib/bible/reference";
import { useT } from "@/lib/i18n";

/** Book (grouped by testament) → chapter → tap verses. Controlled: parent owns the state. */
export interface VerseSelection {
  book: string;
  chapter: number;
  /** verse range, null until the user taps a verse */
  start: number | null;
  end: number | null;
}

export const EMPTY_SELECTION: VerseSelection = { book: "", chapter: 0, start: null, end: null };

export function selectionToRef(s: VerseSelection): VerseRef | null {
  if (!s.book || !s.chapter || s.start === null) return null;
  const end = s.end ?? s.start;
  return { book: s.book, chapter: s.chapter, start: Math.min(s.start, end), end: Math.max(s.start, end) };
}

/** Tap logic: 1st tap = single verse; 2nd tap = range end; tap again after a range = new start. */
export function tapVerse(s: VerseSelection, n: number): VerseSelection {
  if (s.start === null) return { ...s, start: n, end: null };
  if (s.end === null) {
    if (n === s.start) return { ...s, start: null, end: null }; // tap same verse again = deselect
    return { ...s, start: Math.min(s.start, n), end: Math.max(s.start, n) };
  }
  return { ...s, start: n, end: null };
}

interface Props {
  value: VerseSelection;
  onChange: (s: VerseSelection) => void;
  tone?: "light" | "dark";
}

export function VerseSelector({ value, onChange, tone = "light" }: Props) {
  const t = useT();
  const dark = tone === "dark";
  const field = dark
    ? "w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-100"
    : "input";
  const chapters = value.book ? chapterCount(value.book) : 0;
  const verses = value.book && value.chapter ? verseCount(value.book, value.chapter) : 0;
  const ref = selectionToRef(value);
  const inRange = (n: number) => ref !== null && n >= ref.start && n <= ref.end;

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <select
          className={field}
          value={value.book}
          onChange={(e) => onChange({ book: e.target.value, chapter: e.target.value && chapterCount(e.target.value) === 1 ? 1 : 0, start: null, end: null })}
          aria-label={t("selectBook")}
        >
          <option value="">{t("selectBook")}…</option>
          {(["OT", "NT"] as const).map((tst) => (
            <optgroup key={tst} label={tst === "OT" ? t("oldTestament") : t("newTestament")}>
              {BOOKS.filter((b) => b.testament === tst).map((b) => (
                <option key={b.id} value={b.id}>{b.names.te.name} · {b.names.en.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <select
          className={field}
          value={value.chapter || ""}
          disabled={!value.book}
          onChange={(e) => onChange({ ...value, chapter: +e.target.value, start: null, end: null })}
          aria-label={t("chapter")}
        >
          <option value="">{t("chapter")}…</option>
          {Array.from({ length: chapters }, (_, i) => <option key={i} value={i + 1}>{t("chapter")} {i + 1}</option>)}
        </select>
      </div>

      {verses > 0 && (
        <div>
          <div className={`mb-1.5 flex items-center justify-between text-xs ${dark ? "text-slate-400" : "text-slate-500"}`}>
            <span>{t("verseRangeHint")}</span>
            {value.start !== null && (
              <button className="underline" onClick={() => onChange({ ...value, start: null, end: null })}>{t("clearSelection")}</button>
            )}
          </div>
          <div className="grid grid-cols-8 gap-1 sm:grid-cols-10" role="group" aria-label={`${BOOK_BY_ID[value.book]?.names.en.name} ${value.chapter}`}>
            {Array.from({ length: verses }, (_, i) => {
              const n = i + 1;
              const on = inRange(n);
              const edge = ref && (n === ref.start || n === ref.end);
              return (
                <button
                  key={n}
                  onClick={() => onChange(tapVerse(value, n))}
                  aria-pressed={on}
                  data-testid="verse-tile"
                  className={`h-9 rounded-md text-sm font-medium tabular-nums transition ${
                    on
                      ? edge ? "bg-indigo-600 text-white" : "bg-indigo-400 text-white"
                      : dark ? "bg-slate-800 text-slate-200 hover:bg-slate-700" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-indigo-50"
                  }`}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
