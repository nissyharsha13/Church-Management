"use client";

import { useEffect, useState } from "react";
import { getPassage, type Verse } from "./loader";
import type { VerseRef } from "./reference";

/** Load a passage in a translation; null translation => []. */
export function usePassage(translationId: string | null | undefined, ref: VerseRef | null) {
  const key = translationId && ref ? `${translationId}|${ref.book}|${ref.chapter}|${ref.start}|${ref.end}` : "";
  const [state, setState] = useState<{ key: string; verses: Verse[]; error?: string }>({ key: "", verses: [] });
  useEffect(() => {
    if (!key || !translationId || !ref) return;
    let alive = true;
    getPassage(translationId, ref)
      .then((verses) => alive && setState({ key, verses }))
      .catch((e: Error) => alive && setState({ key, verses: [], error: e.message }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const ready = state.key === key;
  return { verses: ready ? state.verses : [], loading: !!key && !ready, error: ready ? state.error : undefined };
}
