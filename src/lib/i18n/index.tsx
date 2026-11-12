"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db, DEFAULT_CHURCH_ID } from "@/lib/db";
import { dictionary, type DictKey, type UILang } from "./dictionary";

export function translate(lang: UILang, key: DictKey): string {
  return dictionary[key][lang] ?? dictionary[key].en;
}

/** Current UI language (from church settings, stored locally). */
export function useUILang(): UILang {
  const s = useLiveQuery(() => db.churches.get(DEFAULT_CHURCH_ID), []);
  return s?.uiLanguage ?? "en";
}

export function useT() {
  const lang = useUILang();
  return (key: DictKey) => translate(lang, key);
}
