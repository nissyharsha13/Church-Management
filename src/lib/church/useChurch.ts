"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db, DEFAULT_CHURCH_ID, DEFAULT_SETTINGS, withDefaults, type ChurchSettings } from "@/lib/db";

/** Live church profile (merged with defaults). Returns defaults until IndexedDB answers. */
export function useChurch(): ChurchSettings {
  const stored = useLiveQuery(() => db.churches.get(DEFAULT_CHURCH_ID), []);
  return stored === undefined ? DEFAULT_SETTINGS : withDefaults(stored);
}

export const DEFAULT_EMBLEM = "/branding/divine-church-emblem.svg";
