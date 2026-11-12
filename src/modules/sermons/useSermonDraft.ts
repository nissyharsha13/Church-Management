"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { db } from "@/lib/db";
import { saveSermon } from "./repo";
import type { Sermon } from "./types";

/** Load a sermon once, edit locally, autosave (debounced) to IndexedDB. */
export function useSermonDraft(id: string) {
  const [sermon, setSermon] = useState<Sermon | null | undefined>(undefined);
  const [saved, setSaved] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<Sermon | null>(null);

  useEffect(() => {
    db.sermons.get(id).then((s) => setSermon(s ?? null));
  }, [id]);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (latest.current) {
      await saveSermon(latest.current);
      setSaved(true);
    }
  }, []);

  const update = useCallback((fn: (s: Sermon) => Sermon) => {
    setSermon((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      latest.current = next;
      return next;
    });
    setSaved(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 600);
  }, [flush]);

  // Save pending edits when leaving the page.
  useEffect(() => () => { void flush(); }, [flush]);

  return { sermon, update, saved, flush };
}
