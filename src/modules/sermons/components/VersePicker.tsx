"use client";

import { useMemo, useState } from "react";
import { Keyboard, ListFilter, Plus } from "lucide-react";
import { bookName } from "@/lib/bible/canon";
import { formatReference, parseReference, suggestBooks, type VerseRef } from "@/lib/bible/reference";
import { usePassage } from "@/lib/bible/usePassage";
import { translationLang } from "@/lib/bible/translations";
import { useT, useUILang } from "@/lib/i18n";
import { EMPTY_SELECTION, selectionToRef, VerseSelector, type VerseSelection } from "@/components/bible/VerseSelector";

interface Props {
  primaryTranslation: string;
  secondaryTranslation: string;
  onAdd: (ref: VerseRef) => void;
  /** Book/chapter to start from (e.g. the last one used), verses always start unselected. */
  initialSelection?: VerseSelection;
}

/**
 * Two ways to pick: (1) select book → chapter → tap verses (default), or
 * (2) type a reference in English or Telugu. Both show a live preview.
 */
export function VersePicker({ primaryTranslation, secondaryTranslation, onAdd, initialSelection }: Props) {
  const t = useT();
  const lang = useUILang();
  const [mode, setMode] = useState<"select" | "type">("select");
  const [sel, setSel] = useState<VerseSelection>(initialSelection ? { ...initialSelection, start: null, end: null } : EMPTY_SELECTION);
  const [text, setText] = useState("");

  const typed = useMemo(() => (text.trim() ? parseReference(text) : null), [text]);
  const ref = mode === "type" ? typed : selectionToRef(sel);
  const suggestions = useMemo(() => {
    const bookPart = text.replace(/\d+[\s:.,-]*\d*[\s-]*\d*$/, "").trim();
    return !typed && bookPart ? suggestBooks(bookPart, 6) : [];
  }, [text, typed]);

  const add = () => {
    if (ref) onAdd(ref);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-1 text-xs" role="tablist">
        {(["select", "type"] as const).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`flex items-center gap-1 rounded-md px-2.5 py-1 ${mode === m ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}>
            {m === "select" ? <><ListFilter className="h-3.5 w-3.5" />{t("selectTab")}</> : <><Keyboard className="h-3.5 w-3.5" />{t("typeTab")}</>}
          </button>
        ))}
      </div>

      {mode === "select" ? (
        <VerseSelector value={sel} onChange={setSel} />
      ) : (
        <div>
          <input
            className="input text-base"
            autoFocus
            placeholder={t("verseSearchHint")}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            aria-label={t("typeReference")}
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
      )}

      {ref && (
        <>
          <div className="text-sm font-semibold text-indigo-700" data-testid="selection-summary">
            {formatReference(ref, "te")} <span className="font-normal text-slate-500">· {formatReference(ref, "en")}</span>
          </div>
          <PassagePreview refValue={ref} primary={primaryTranslation} secondary={secondaryTranslation} />
        </>
      )}

      <button className="btn-primary" disabled={!ref} onClick={add} data-testid="confirm-add-verse">
        <Plus className="h-4 w-4" />{t("addThisVerse")}
      </button>
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
