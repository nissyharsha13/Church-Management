"use client";

import { useMemo, useState } from "react";
import { Keyboard, ListFilter, Plus } from "lucide-react";
import { BOOKS, bookName, chapterCount, verseCount } from "@/lib/bible/canon";
import { formatReference, parseReference, suggestBooks, type VerseRef } from "@/lib/bible/reference";
import { usePassage } from "@/lib/bible/usePassage";
import { translationLang } from "@/lib/bible/translations";
import { useT, useUILang } from "@/lib/i18n";

interface Props {
  primaryTranslation: string;
  secondaryTranslation: string;
  onAdd: (ref: VerseRef) => void;
  /** Extra controls rendered next to the Add button (e.g. "attach to" select) */
  extra?: React.ReactNode;
  autoFocus?: boolean;
}

/**
 * Two ways to pick: type a reference (English or Telugu), or use the
 * book / chapter / verse selectors. Both show a live preview.
 */
export function VersePicker({ primaryTranslation, secondaryTranslation, onAdd, extra, autoFocus }: Props) {
  const t = useT();
  const lang = useUILang();
  const [text, setText] = useState("");
  const [sel, setSel] = useState<VerseRef>({ book: "JHN", chapter: 3, start: 16, end: 16 });
  const [mode, setMode] = useState<"type" | "select">("type");

  const typed = useMemo(() => (text.trim() ? parseReference(text) : null), [text]);
  const ref = mode === "type" ? typed : sel;
  const suggestions = useMemo(() => {
    const bookPart = text.replace(/\d+[\s:.,-]*\d*[\s-]*\d*$/, "").trim();
    return !typed && bookPart ? suggestBooks(bookPart, 6) : [];
  }, [text, typed]);

  const add = () => {
    if (!ref) return;
    onAdd(ref);
    setText("");
  };

  const chapters = chapterCount(sel.book);
  const verses = verseCount(sel.book, sel.chapter);

  return (
    <div className="space-y-3">
      <div className="flex gap-1 text-xs">
        {(["type", "select"] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={`flex items-center gap-1 rounded-md px-2 py-1 ${mode === m ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}>
            {m === "type" ? <><Keyboard className="h-3.5 w-3.5" />Type</> : <><ListFilter className="h-3.5 w-3.5" />Select</>}
          </button>
        ))}
      </div>

      {mode === "type" ? (
        <div>
          <input
            className="input text-base"
            autoFocus={autoFocus}
            placeholder={t("verseSearchHint")}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            aria-label={t("addVerse")}
          />
          {suggestions.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {suggestions.map((id) => (
                <button key={id} className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700" onClick={() => setText(`${bookName(id, lang)} `)}>
                  {bookName(id, "te")} · {bookName(id, "en")}
                </button>
              ))}
            </div>
          )}
          {text.trim() && !typed && suggestions.length === 0 && <p className="mt-1 text-xs text-red-600">{t("invalidRef")}</p>}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <select className="input col-span-2 sm:col-span-1" value={sel.book} onChange={(e) => setSel({ book: e.target.value, chapter: 1, start: 1, end: 1 })}>
            {BOOKS.map((b) => <option key={b.id} value={b.id}>{b.names.te.name} · {b.names.en.name}</option>)}
          </select>
          <select className="input" value={sel.chapter} onChange={(e) => setSel({ ...sel, chapter: +e.target.value, start: 1, end: 1 })} aria-label="Chapter">
            {Array.from({ length: chapters }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
          </select>
          <div className="flex items-center gap-1">
            <select className="input" value={sel.start} onChange={(e) => setSel({ ...sel, start: +e.target.value, end: Math.max(+e.target.value, sel.end) })} aria-label="From verse">
              {Array.from({ length: verses }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
            </select>
            <span className="text-slate-400">–</span>
            <select className="input" value={sel.end} onChange={(e) => setSel({ ...sel, end: +e.target.value })} aria-label="To verse">
              {Array.from({ length: verses - sel.start + 1 }, (_, i) => <option key={i} value={sel.start + i}>{sel.start + i}</option>)}
            </select>
          </div>
        </div>
      )}

      {ref && <PassagePreview refValue={ref} primary={primaryTranslation} secondary={secondaryTranslation} />}

      <div className="flex flex-wrap items-center gap-2">
        {extra}
        <button className="btn-primary" disabled={!ref} onClick={add}><Plus className="h-4 w-4" />{t("addVerse")}</button>
      </div>
    </div>
  );
}

export function PassagePreview({ refValue, primary, secondary, compact }: { refValue: VerseRef; primary: string; secondary?: string; compact?: boolean }) {
  const p = usePassage(primary, refValue);
  const s = usePassage(secondary || null, refValue);
  const box = compact ? "max-h-28" : "max-h-48";
  return (
    <div className={`grid gap-3 rounded-lg bg-slate-50 p-3 text-sm ${secondary ? "md:grid-cols-2" : ""}`}>
      {[{ v: p, id: primary }, ...(secondary ? [{ v: s, id: secondary }] : [])].map(({ v, id }) => (
        <div key={id} className={`${box} overflow-y-auto`} lang={translationLang(id)}>
          <div className="mb-1 text-xs font-semibold text-slate-500">{formatReference(refValue, translationLang(id))} · {id.split("-")[1].toUpperCase()}</div>
          {v.loading && <div className="text-slate-400">…</div>}
          {v.error && <div className="text-red-600">{v.error}</div>}
          {v.verses.map((x) => (
            <p key={x.n} className="leading-relaxed"><sup className="mr-1 text-slate-400">{x.label ?? x.n}</sup>{x.text}</p>
          ))}
        </div>
      ))}
    </div>
  );
}
