"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { db, DEFAULT_CHURCH_ID, type ChurchSettings, type SessionEvent } from "@/lib/db";
import { getPassage } from "@/lib/bible/loader";
import { formatReference, type VerseRef } from "@/lib/bible/reference";
import { buildSlides, type VerseSlide } from "@/lib/bible/slides";
import { TRANSLATION_BY_ID, translationLang } from "@/lib/bible/translations";
import type { MediaItem } from "@/modules/media/types";
import { newId, type Sermon, type VerseCue } from "@/modules/sermons/types";
import { backgroundScene, INITIAL_STATE, type ChurchInfo, type DisplayState, type LanguageMode, type MediaStatus, type Scene } from "./protocol";
import { createTransport, type PresenterTransport } from "./transport";

export interface ActiveVerse {
  cueId: string;
  ref: VerseRef;
  slides: VerseSlide[];
  index: number;
}

/** pre = welcome screen before the sermon; live = preaching; ended = thank-you screen. */
export type Phase = "pre" | "live" | "ended";

interface Persisted {
  state: DisplayState;
  active: ActiveVerse | null;
  pointIndex: number;
  sessionId: string;
  startedAt: number | null;
  phase?: Phase;
}

export function churchInfo(s: ChurchSettings): ChurchInfo {
  return {
    name: s.name, nameTe: s.nameTe, tagline: s.tagline, pastorName: s.pastorName, address: s.address,
    serviceTimes: s.serviceTimes, youtubeName: s.youtubeName, youtubeUrl: s.youtubeUrl,
  };
}

const persistKey = (sermonId: string) => `presenter:${sermonId}`;

/**
 * Console-side brain. The console is the source of truth; every change is
 * broadcast to all displays. Commands are plain functions so the future AI
 * listener can call exactly the same ones as the buttons.
 */
export function useController(sermon: Sermon, settings: ChurchSettings, media: MediaItem[]) {
  const restored = useMemo<Persisted | null>(() => {
    try {
      const raw = localStorage.getItem(persistKey(sermon.id));
      return raw ? (JSON.parse(raw) as Persisted) : null;
    } catch { return null; }
  }, [sermon.id]);

  const [state, setStateRaw] = useState<DisplayState>(() => ({
    ...INITIAL_STATE,
    scene: { kind: "welcome" },
    languageMode: sermon.secondaryTranslation ? "both" : "primary",
    ...(restored?.state ?? {}),
    church: churchInfo(settings),
    translations: { primary: sermon.primaryTranslation, secondary: sermon.secondaryTranslation },
  }));
  const [phase, setPhase] = useState<Phase>(restored?.phase ?? (restored?.startedAt ? "live" : "pre"));
  const [active, setActive] = useState<ActiveVerse | null>(restored?.active ?? null);
  const [pointIndex, setPointIndex] = useState(restored?.pointIndex ?? 0);
  const [startedAt, setStartedAt] = useState<number | null>(restored?.startedAt ?? null);
  const [sessionId] = useState(() => restored?.sessionId ?? newId());
  const [lastPing, setLastPing] = useState(0);
  const [screenFullscreen, setScreenFullscreen] = useState(false);
  const [mediaStatus, setMediaStatus] = useState<MediaStatus | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const stateRef = useRef(state);
  const phaseRef = useRef(phase);
  const transport = useRef<PresenterTransport | null>(null);
  const events = useRef<SessionEvent[]>([]);
  /** Bumped on every screen change; async actions abort if a newer action happened meanwhile. */
  const actionSeq = useRef(0);

  const broadcast = useCallback((s: DisplayState) => transport.current?.send({ type: "state", state: s, sentAt: Date.now() }), []);

  const setState = useCallback((fn: (s: DisplayState) => DisplayState) => {
    const next = fn(stateRef.current);
    actionSeq.current++;
    stateRef.current = next;
    setStateRaw(next);
    broadcast(next);
  }, [broadcast]);

  const log = useCallback((kind: string, label: string) => {
    events.current.push({ t: Date.now(), kind, label });
  }, []);

  // Transport + heartbeat
  useEffect(() => {
    const tr = createTransport();
    transport.current = tr;
    const off = tr.subscribe((msg) => {
      if (msg.type === "hello") broadcast(stateRef.current);
      if (msg.type === "ping") { setLastPing(Date.now()); setScreenFullscreen(msg.fullscreen); }
      if (msg.type === "media-status") setMediaStatus(msg.status);
    });
    broadcast(stateRef.current);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => { off(); clearInterval(tick); tr.close(); };
  }, [broadcast]);

  // Keep church details and translations on the screen in sync with settings / the sermon
  const info = useMemo(() => churchInfo(settings), [settings]);
  useEffect(() => {
    const tr = { primary: sermon.primaryTranslation, secondary: sermon.secondaryTranslation };
    if (JSON.stringify(state.church) !== JSON.stringify(info) || JSON.stringify(state.translations) !== JSON.stringify(tr))
      setState((s) => ({ ...s, church: info, translations: tr }));
  }, [info, sermon.primaryTranslation, sermon.secondaryTranslation, state.church, state.translations, setState]);

  /** Leave the welcome screen phase: start the timer (first content shown, or "Begin"). */
  const ensureLive = useCallback(() => {
    if (phaseRef.current !== "pre") return;
    phaseRef.current = "live";
    setPhase("live");
    const t = Date.now();
    setStartedAt(t);
    void db.sessions.update(sessionId, { startedAt: t });
    events.current.push({ t, kind: "begin", label: "" });
  }, [sessionId]);

  // Session record + crash recovery
  useEffect(() => {
    db.sessions.get(sessionId).then((existing) => {
      if (existing) events.current = existing.events;
      else void db.sessions.put({ id: sessionId, churchId: DEFAULT_CHURCH_ID, sermonId: sermon.id, startedAt: startedAt ?? Date.now(), events: [] });
    });
    const save = setInterval(() => {
      if (events.current.length) void db.sessions.update(sessionId, { events: events.current });
    }, 5000);
    return () => clearInterval(save);
  }, [sessionId, sermon.id, startedAt]);

  useEffect(() => {
    try {
      localStorage.setItem(persistKey(sermon.id), JSON.stringify({ state, active, pointIndex, sessionId, startedAt, phase } satisfies Persisted));
    } catch { /* storage full or blocked */ }
  }, [state, active, pointIndex, sessionId, startedAt, phase, sermon.id]);

  // ---------- verses ----------
  const orderedVerseCues = useMemo(() => {
    const order = new Map(sermon.points.map((p, i) => [p.id, i]));
    return [...sermon.verses].sort((a, b) => (order.get(a.pointId ?? "") ?? 999) - (order.get(b.pointId ?? "") ?? 999));
  }, [sermon.points, sermon.verses]);

  const verseScene = useCallback((av: ActiveVerse): Scene => {
    const p = sermon.primaryTranslation, s = sermon.secondaryTranslation;
    // The reference names exactly what is on this slide (e.g. 4:35-36 of 4:35-38).
    const vs = av.slides[av.index]?.verses ?? [];
    const last = vs[vs.length - 1];
    const ref = av.slides.length > 1 && vs.length
      ? { ...av.ref, start: vs[0].n, end: last.label ? +last.label.split("-")[1] : last.n }
      : av.ref;
    return {
      kind: "verse",
      cueId: av.cueId,
      refPrimary: formatReference(ref, translationLang(p)),
      refSecondary: s ? formatReference(ref, translationLang(s)) : "",
      primaryAbbr: TRANSLATION_BY_ID[p]?.abbr ?? "",
      secondaryAbbr: s ? TRANSLATION_BY_ID[s]?.abbr ?? "" : "",
      slideIndex: av.index,
      slideCount: av.slides.length,
      verses: av.slides[av.index]?.verses ?? [],
    };
  }, [sermon.primaryTranslation, sermon.secondaryTranslation]);

  const loadSlides = useCallback(async (ref: VerseRef, mode: LanguageMode) => {
    const p = sermon.primaryTranslation, s = sermon.secondaryTranslation;
    const [pv, sv] = await Promise.all([
      mode !== "secondary" ? getPassage(p, ref) : Promise.resolve([]),
      s && mode !== "primary" ? getPassage(s, ref) : Promise.resolve([]),
    ]);
    return buildSlides(pv, sv, mode === "both" && s ? "both" : "single");
  }, [sermon.primaryTranslation, sermon.secondaryTranslation]);

  const showVerse = useCallback(async (cueId: string, ref: VerseRef, index = 0) => {
    const my = ++actionSeq.current;
    const slides = await loadSlides(ref, stateRef.current.languageMode);
    // The operator did something else while this passage loaded: the newer action wins.
    if (my !== actionSeq.current || !slides.length) return;
    ensureLive();
    const av = { cueId, ref, slides, index: Math.max(0, Math.min(index, slides.length - 1)) };
    setActive(av);
    setState((s) => ({ ...s, scene: verseScene(av) }));
    const cue = sermon.verses.find((v) => v.id === cueId);
    if (cue?.pointId) {
      const i = sermon.points.findIndex((p) => p.id === cue.pointId);
      if (i >= 0) setPointIndex(i);
    }
    log("verse", formatReference(ref, "en"));
  }, [loadSlides, setState, verseScene, sermon.verses, sermon.points, log, ensureLive]);

  const showVerseCue = useCallback((cue: VerseCue) => showVerse(cue.id, cue.ref), [showVerse]);

  const gotoSlide = useCallback((delta: number) => {
    const cur = stateRef.current.scene;
    if (cur.kind === "verse" && active && active.cueId === cur.cueId) {
      const ni = active.index + delta;
      if (ni >= 0 && ni < active.slides.length) {
        const av = { ...active, index: ni };
        setActive(av);
        setState((s) => ({ ...s, scene: verseScene(av) }));
        return;
      }
      // Past the end/start of this passage -> next/previous verse cue (clicker friendly)
      const i = orderedVerseCues.findIndex((c) => c.id === active.cueId);
      const next = orderedVerseCues[i + delta];
      if (next) void showVerse(next.id, next.ref, delta < 0 ? 999 : 0);
      return;
    }
    // Nothing live: start from the first verse of the current pointer
    const pid = sermon.points[pointIndex]?.id;
    const first = orderedVerseCues.find((c) => c.pointId === pid) ?? orderedVerseCues[0];
    if (first && delta > 0) void showVerseCue(first);
  }, [active, orderedVerseCues, pointIndex, sermon.points, setState, showVerse, showVerseCue, verseScene]);

  // Rebuild slides when the language mode changes so they fit the new layout
  const setLanguageMode = useCallback(async (mode: LanguageMode) => {
    setState((s) => ({ ...s, languageMode: mode }));
    const cur = stateRef.current.scene;
    if (cur.kind === "verse" && active) {
      const my = actionSeq.current;
      const slides = await loadSlides(active.ref, mode);
      if (my !== actionSeq.current) return;
      const firstVerse = active.slides[active.index]?.verses[0]?.n;
      const idx = Math.max(0, slides.findIndex((sl) => sl.verses.some((v) => v.n === firstVerse)));
      const av = { ...active, slides, index: idx };
      setActive(av);
      setState((s) => ({ ...s, scene: verseScene(av) }));
    }
  }, [active, loadSlides, setState, verseScene]);

  // ---------- media ----------
  const showMedia = useCallback((cueId: string, item: MediaItem) => {
    const nonce = newId();
    ensureLive();
    setMediaStatus(null);
    setState((s) => ({
      ...s,
      scene: { kind: "media", cueId, nonce, mediaId: item.id, title: item.title, mediaKind: item.kind, source: item.source, fileId: item.fileId, youtubeId: item.youtubeId, startSec: item.startSec, endSec: item.endSec },
    }));
    log("media", item.title);
  }, [setState, log, ensureLive]);

  const mediaCommand = useCallback((action: "play" | "pause" | "restart") => {
    const sc = stateRef.current.scene;
    if (sc.kind === "media") transport.current?.send({ type: "media", action, nonce: sc.nonce });
  }, []);

  const clear = useCallback(() => { setState((s) => ({ ...s, scene: backgroundScene(s) })); log("clear", ""); }, [setState, log]);

  // When a video finishes, go back to the background (camera or logo).
  useEffect(() => {
    const sc = stateRef.current.scene;
    if (mediaStatus?.ended && sc.kind === "media" && sc.nonce === mediaStatus.nonce) clear();
  }, [mediaStatus, clear]);

  // ---------- simple scenes ----------
  const blank = useCallback(() => { setState((s) => ({ ...s, scene: { kind: "blank" } })); log("blank", ""); }, [setState, log]);
  const logo = useCallback(() => { setState((s) => ({ ...s, scene: { kind: "logo" } })); log("logo", ""); }, [setState, log]);
  const title = useCallback(() => {
    ensureLive();
    setState((s) => ({ ...s, scene: { kind: "title", title: sermon.title, subtitle: [sermon.speaker, sermon.serviceName].filter(Boolean).join(" · ") } }));
    log("title", sermon.title);
  }, [setState, sermon.title, sermon.speaker, sermon.serviceName, log, ensureLive]);
  const camera = useCallback(() => {
    ensureLive();
    setState((s) => ({ ...s, cameraOn: true, scene: { kind: "camera" } }));
    log("camera", "");
  }, [setState, log, ensureLive]);
  const setCameraOn = useCallback((on: boolean) => setState((s) => ({ ...s, cameraOn: on, scene: !on && s.scene.kind === "camera" ? { kind: "logo" } : s.scene })), [setState]);
  const setCameraDevice = useCallback((id: string | null) => setState((s) => ({ ...s, cameraDeviceId: id })), [setState]);
  const setOverlay = useCallback((on: boolean) => setState((s) => ({ ...s, overlayOnCamera: on })), [setState]);
  const setFontScale = useCallback((f: number) => setState((s) => ({ ...s, fontScale: Math.max(0.6, Math.min(1.6, Math.round(f * 10) / 10)) })), [setState]);

  /** Prayer screen: invite everyone to join in prayer. Topic optional; leader defaults to the pastor. */
  const prayer = useCallback((topic: { te: string; en: string }, leader: string) => {
    setState((s) => ({ ...s, scene: { kind: "prayer", topicTe: topic.te, topicEn: topic.en, leader } }));
    log("prayer", topic.en || topic.te);
  }, [setState, log]);
  const welcome = useCallback(() => { setState((s) => ({ ...s, scene: { kind: "welcome" } })); log("welcome", ""); }, [setState, log]);
  /** Explicit start: timer runs and the title slide goes up. */
  const begin = useCallback(() => {
    ensureLive();
    setState((s) => ({ ...s, scene: { kind: "title", title: sermon.title, subtitle: [sermon.speaker, sermon.serviceName].filter(Boolean).join(" · ") } }));
  }, [ensureLive, setState, sermon.title, sermon.speaker, sermon.serviceName]);

  const end = useCallback(async () => {
    await db.sessions.update(sessionId, { events: events.current, endedAt: Date.now() });
    await db.sermons.update(sermon.id, { status: "delivered", updatedAt: Date.now() });
    try { localStorage.removeItem(persistKey(sermon.id)); } catch { /* ignore */ }
    phaseRef.current = "ended";
    setPhase("ended");
    // The thank-you screen stays up until the screen window is closed.
    setState((s) => ({ ...s, scene: { kind: "ended" } }));
  }, [sessionId, sermon.id, setState]);

  return {
    state, active, pointIndex, setPointIndex, mediaStatus,
    screenConnected: now - lastPing < 4000, screenFullscreen,
    phase,
    elapsedSec: startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0,
    mediaById: new Map(media.map((m) => [m.id, m])),
    actions: { begin, welcome, prayer, showVerse, showVerseCue, gotoSlide, setLanguageMode, showMedia, mediaCommand, clear, blank, logo, title, camera, setCameraOn, setCameraDevice, setOverlay, setFontScale, end },
  };
}

export type Controller = ReturnType<typeof useController>;
