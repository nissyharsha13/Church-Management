import type { Verse } from "./loader";

export interface SlideVerse {
  n: number;
  label?: string;
  primary?: string;
  secondary?: string;
}

export interface VerseSlide {
  verses: SlideVerse[];
  /** e.g. "16-17" — verse span covered by this slide */
  span: string;
}

/** Character budget per slide for each language block. Telugu glyphs are wider, so its budget is smaller. */
export const SLIDE_BUDGET = { both: { primary: 260, secondary: 300 }, single: 520 };

/**
 * Merge two translations verse-by-verse and split into screen-sized slides.
 * A single verse that exceeds the budget still gets its own slide (the display shrinks the font).
 */
export function buildSlides(primary: Verse[], secondary: Verse[], mode: "both" | "single" = "both"): VerseSlide[] {
  const byN = new Map<number, SlideVerse>();
  for (const v of primary) byN.set(v.n, { n: v.n, label: v.label, primary: v.text });
  for (const v of secondary) {
    const e = byN.get(v.n) ?? { n: v.n };
    e.secondary = v.text;
    e.label ??= v.label;
    byN.set(v.n, e);
  }
  const all = [...byN.values()].sort((a, b) => a.n - b.n);
  const slides: VerseSlide[] = [];
  let cur: SlideVerse[] = [];
  let p = 0, s = 0;
  const pMax = mode === "both" ? SLIDE_BUDGET.both.primary : SLIDE_BUDGET.single;
  const sMax = mode === "both" ? SLIDE_BUDGET.both.secondary : SLIDE_BUDGET.single;
  const push = () => {
    if (!cur.length) return;
    const first = cur[0], last = cur[cur.length - 1];
    const lastN = last.label ? last.label.split("-")[1] : String(last.n);
    slides.push({ verses: cur, span: cur.length === 1 ? (first.label ?? String(first.n)) : `${first.n}-${lastN}` });
    cur = []; p = 0; s = 0;
  };
  for (const v of all) {
    const lp = v.primary?.length ?? 0, ls = v.secondary?.length ?? 0;
    if (cur.length && (p + lp > pMax || s + ls > sMax)) push();
    cur.push(v); p += lp; s += ls;
  }
  push();
  return slides;
}
