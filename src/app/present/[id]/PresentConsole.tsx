"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowLeft, BookOpen, Camera, ChevronLeft, ChevronRight, Circle, Eraser, Keyboard, Maximize2, Minus, MonitorUp, Pause,
  Play, Plus, RotateCcw, Square, Type, Video,
} from "lucide-react";
import { db, DEFAULT_CHURCH_ID, DEFAULT_SETTINGS, type ChurchSettings } from "@/lib/db";
import { useT } from "@/lib/i18n";
import { formatReference, parseReference } from "@/lib/bible/reference";
import { TRANSLATION_BY_ID, translationLang } from "@/lib/bible/translations";
import { MediaIcon } from "@/modules/media/components/MediaIcon";
import { formatTime, type MediaItem } from "@/modules/media/types";
import { CameraView, Stage } from "@/modules/presenter/Stage";
import { listCameras, useCameraStream } from "@/modules/presenter/useCamera";
import { useController, type Controller } from "@/modules/presenter/useController";
import type { LanguageMode } from "@/modules/presenter/protocol";
import type { Sermon } from "@/modules/sermons/types";

export default function PresentConsole({ id }: { id: string }) {
  const sermon = useLiveQuery(() => db.sermons.get(id), [id]);
  const settings = useLiveQuery(() => db.churches.get(DEFAULT_CHURCH_ID), []);
  const media = useLiveQuery(() => db.media.toArray(), []);
  if (sermon === undefined || media === undefined) return <div className="min-h-screen bg-slate-950" />;
  if (!sermon) return <div className="p-8">Sermon not found. <Link className="text-indigo-600" href="/">Back</Link></div>;
  return <Console sermon={sermon} settings={settings ?? DEFAULT_SETTINGS} media={media} />;
}

function Console({ sermon, settings, media }: { sermon: Sermon; settings: ChurchSettings; media: MediaItem[] }) {
  const t = useT();
  const router = useRouter();
  const c = useController(sermon, settings, media);
  const { state, actions } = c;
  const [showKeys, setShowKeys] = useState(false);

  // Keyboard & presentation clicker (clickers send PageUp/PageDown)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT") return;
      const k = e.key;
      if (["ArrowRight", "PageDown", " "].includes(k)) { e.preventDefault(); actions.gotoSlide(1); }
      else if (["ArrowLeft", "PageUp"].includes(k)) { e.preventDefault(); actions.gotoSlide(-1); }
      else if (k === "b" || k === "B" || k === ".") actions.blank();
      else if (k === "l" || k === "L") actions.logo();
      else if (k === "c" || k === "C") actions.camera();
      else if (k === "t" || k === "T") actions.title();
      else if (k === "Escape") actions.clear();
      else if (k === "n" || k === "N" || k === "ArrowDown") { e.preventDefault(); c.setPointIndex(Math.min(sermon.points.length - 1, c.pointIndex + 1)); }
      else if (k === "p" || k === "P" || k === "ArrowUp") { e.preventDefault(); c.setPointIndex(Math.max(0, c.pointIndex - 1)); }
      else if (/^[1-9]$/.test(k)) {
        const pid = sermon.points[c.pointIndex]?.id;
        const cue = sermon.verses.filter((v) => v.pointId === pid)[+k - 1];
        if (cue) void actions.showVerseCue(cue);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actions, c, sermon.points, sermon.verses]);

  const plannedMin = sermon.points.reduce((n, p) => n + (p.minutes ?? 0), 0);
  const over = plannedMin > 0 && c.elapsedSec > plannedMin * 60;
  const sceneBtn = (active: boolean) => `btn border ${active ? "border-amber-400 bg-amber-400 text-slate-950" : "border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700"}`;
  const k = state.scene.kind;

  const endSermon = async () => {
    if (!confirm(`${t("endSession")}?`)) return;
    await actions.end();
    router.push("/");
  };

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-100">
      {/* Top bar */}
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-2">
        <Link href={`/sermons/${sermon.id}`} className="btn text-slate-300 hover:bg-slate-800" aria-label={t("back")}><ArrowLeft className="h-4 w-4" /></Link>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{sermon.title || "Untitled"}</div>
          <div className="text-xs text-slate-400">{sermon.date} · {sermon.serviceName}</div>
        </div>
        <div className={`rounded-lg px-3 py-1 font-mono text-lg tabular-nums ${over ? "bg-red-900/60 text-red-200" : "bg-slate-800"}`} title={t("elapsed")}>
          {formatTime(c.elapsedSec)}{plannedMin > 0 && <span className="text-sm text-slate-400"> / {plannedMin}:00</span>}
        </div>
        <ScreenButton c={c} />
        <button className="btn text-slate-300 hover:bg-slate-800" onClick={() => setShowKeys(!showKeys)} title={t("shortcuts")}><Keyboard className="h-4 w-4" /></button>
        <button className="btn border border-red-800 text-red-300 hover:bg-red-950" onClick={endSermon}><Square className="h-4 w-4" />{t("endSession")}</button>
      </header>

      {/* Scene controls */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-2">
        <button className={sceneBtn(k === "blank")} onClick={actions.blank} data-testid="btn-blank"><Circle className="h-4 w-4 fill-current" />{t("blank")}</button>
        <button className={sceneBtn(k === "logo")} onClick={actions.logo}>✝ {t("logo")}</button>
        <button className={sceneBtn(k === "title")} onClick={actions.title}><Type className="h-4 w-4" />{t("showTitle")}</button>
        <button className={sceneBtn(k === "camera")} onClick={actions.camera}><Camera className="h-4 w-4" />{t("camera")}</button>
        <button className={sceneBtn(false)} onClick={actions.clear} title="Esc"><Eraser className="h-4 w-4" />{t("clear")}</button>
        <div className="mx-1 h-6 w-px bg-slate-700" />
        <LanguageToggle sermon={sermon} value={state.languageMode} onChange={actions.setLanguageMode} />
        <div className="flex items-center rounded-lg border border-slate-700" title={t("textSize")}>
          <button className="px-2 py-2 hover:bg-slate-800" onClick={() => actions.setFontScale(state.fontScale - 0.1)} aria-label="Smaller text"><Minus className="h-4 w-4" /></button>
          <span className="w-10 text-center text-xs tabular-nums">{Math.round(state.fontScale * 100)}%</span>
          <button className="px-2 py-2 hover:bg-slate-800" onClick={() => actions.setFontScale(state.fontScale + 0.1)} aria-label="Larger text"><Plus className="h-4 w-4" /></button>
        </div>
      </div>

      {showKeys && <ShortcutHelp onClose={() => setShowKeys(false)} />}

      {/* Main grid */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1fr)] lg:overflow-hidden">
        <PointersPanel sermon={sermon} c={c} />
        <VersesPanel sermon={sermon} c={c} />
        <div className="flex min-h-0 flex-col gap-3 lg:overflow-y-auto">
          <LiveMonitor c={c} />
          <MediaPanel sermon={sermon} c={c} />
          <CameraPanel c={c} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ScreenButton({ c }: { c: Controller }) {
  const t = useT();
  const win = useRef<Window | null>(null);
  const open = async () => {
    if (win.current && !win.current.closed) { win.current.focus(); return; }
    let features = "popup,width=1280,height=720";
    // Window Management API (Chrome/Edge): place the window on the other screen if there is one.
    try {
      const w = window as unknown as { getScreenDetails?: () => Promise<{ screens: ScreenDetailed[]; currentScreen: ScreenDetailed }> };
      if (w.getScreenDetails) {
        const d = await w.getScreenDetails();
        const other = d.screens.find((s) => s !== d.currentScreen);
        if (other) features = `popup,left=${other.availLeft},top=${other.availTop},width=${other.availWidth},height=${other.availHeight}`;
      }
    } catch { /* permission denied — open normally */ }
    win.current = window.open("/display", "church-display", features);
  };
  return (
    <button onClick={open} className={`btn border ${c.screenConnected ? "border-emerald-700 bg-emerald-950 text-emerald-200" : "border-amber-700 bg-amber-950 text-amber-200"}`} data-testid="open-screen">
      <MonitorUp className="h-4 w-4" />
      {c.screenConnected ? <>{t("screenConnected")}{!c.screenFullscreen && <Maximize2 className="h-3 w-3 opacity-60" />}</> : t("openScreen")}
    </button>
  );
}
interface ScreenDetailed { availLeft: number; availTop: number; availWidth: number; availHeight: number }

function LanguageToggle({ sermon, value, onChange }: { sermon: Sermon; value: LanguageMode; onChange: (m: LanguageMode) => void }) {
  const t = useT();
  const p = TRANSLATION_BY_ID[sermon.primaryTranslation]?.abbr ?? "1";
  const s = TRANSLATION_BY_ID[sermon.secondaryTranslation]?.abbr;
  const opts: [LanguageMode, string][] = s ? [["both", `${t("both")} (${p}+${s})`], ["primary", p], ["secondary", s]] : [["primary", p]];
  return (
    <div className="flex overflow-hidden rounded-lg border border-slate-700" role="group" aria-label="Language">
      {opts.map(([m, label]) => (
        <button key={m} onClick={() => onChange(m)} className={`px-3 py-2 text-sm ${value === m ? "bg-indigo-600 text-white" : "text-slate-300 hover:bg-slate-800"}`}>{label}</button>
      ))}
    </div>
  );
}

function Panel({ title, icon, children, className = "", right }: { title: string; icon?: React.ReactNode; children: React.ReactNode; className?: string; right?: React.ReactNode }) {
  return (
    <section className={`flex min-h-0 flex-col rounded-xl border border-slate-800 bg-slate-900 ${className}`}>
      <div className="flex items-center gap-2 border-b border-slate-800 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {icon}{title}<span className="ml-auto normal-case tracking-normal">{right}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">{children}</div>
    </section>
  );
}

function PointersPanel({ sermon, c }: { sermon: Sermon; c: Controller }) {
  const t = useT();
  const i = c.pointIndex;
  return (
    <Panel
      title={t("points")}
      right={
        <span className="flex gap-1">
          <button className="rounded p-1 hover:bg-slate-800 disabled:opacity-30" disabled={i <= 0} onClick={() => c.setPointIndex(i - 1)} aria-label={t("prevPoint")}><ChevronLeft className="h-4 w-4" /></button>
          <span className="tabular-nums">{Math.min(i + 1, sermon.points.length)}/{sermon.points.length}</span>
          <button className="rounded p-1 hover:bg-slate-800 disabled:opacity-30" disabled={i >= sermon.points.length - 1} onClick={() => c.setPointIndex(i + 1)} aria-label={t("nextPoint")}><ChevronRight className="h-4 w-4" /></button>
        </span>
      }
    >
      {sermon.gist && <p className="mb-3 rounded-lg bg-slate-800/60 p-3 text-sm italic text-slate-300">{sermon.gist}</p>}
      <ol className="space-y-2">
        {sermon.points.map((p, idx) => {
          const current = idx === i;
          return (
            <li key={p.id}>
              <button onClick={() => c.setPointIndex(idx)} className={`w-full rounded-lg border p-3 text-left transition ${current ? "border-indigo-500 bg-indigo-950/60" : "border-slate-800 hover:border-slate-700"}`} data-testid="console-point">
                <div className="flex items-center gap-2">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${current ? "bg-indigo-500 text-white" : "bg-slate-700 text-slate-300"}`}>{idx + 1}</span>
                  <span className={`flex-1 font-semibold ${current ? "text-lg" : "text-slate-300"}`}>{p.title || "…"}</span>
                  {p.minutes ? <span className="text-xs text-slate-400">{p.minutes} {t("minutes")}</span> : null}
                </div>
                {current && p.notes && <div className="mt-2 whitespace-pre-wrap text-[1.05rem] leading-relaxed text-slate-100">{p.notes}</div>}
              </button>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

function VersesPanel({ sermon, c }: { sermon: Sermon; c: Controller }) {
  const t = useT();
  const [quick, setQuick] = useState("");
  const quickRef = parseReference(quick);
  const pLang = translationLang(sermon.primaryTranslation);
  const currentPointId = sermon.points[c.pointIndex]?.id;
  const live = c.state.scene.kind === "verse" ? c.state.scene : null;
  const groups = [
    ...sermon.points.map((p, i) => ({ id: p.id, label: `${i + 1}. ${p.title || "…"}`, verses: sermon.verses.filter((v) => v.pointId === p.id) })),
    { id: "general", label: t("general"), verses: sermon.verses.filter((v) => !v.pointId) },
  ].filter((g) => g.verses.length);
  // Current pointer's verses first
  groups.sort((a, b) => (a.id === currentPointId ? -1 : b.id === currentPointId ? 1 : 0));

  const showQuick = () => {
    if (!quickRef) return;
    void c.actions.showVerse(`adhoc:${quick}`, quickRef);
    setQuick("");
  };

  return (
    <Panel title={t("verses")} icon={<BookOpen className="h-4 w-4" />}>
      <div className="mb-3 flex gap-2">
        <input
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-indigo-500"
          placeholder={`${t("quickVerse")}: యోహాను 3:16 / John 3:16`}
          value={quick}
          onChange={(e) => setQuick(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") showQuick(); if (e.key === "Escape") (e.target as HTMLInputElement).blur(); }}
          aria-label={t("quickVerse")}
        />
        <button className="btn bg-indigo-600 text-white hover:bg-indigo-500" disabled={!quickRef} onClick={showQuick}>{t("show")}</button>
      </div>
      {quick && quickRef && <div className="-mt-2 mb-3 text-xs text-slate-400">→ {formatReference(quickRef, pLang)} · {formatReference(quickRef, "en")}</div>}
      {!sermon.verses.length && <p className="text-sm text-slate-500">{t("noVerses")}</p>}
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.id}>
            <div className={`mb-1.5 text-xs font-semibold ${g.id === currentPointId ? "text-indigo-300" : "text-slate-500"}`}>{g.label}</div>
            <div className="space-y-1.5">
              {g.verses.map((v, idx) => {
                const isLive = live?.cueId === v.id;
                return (
                  <div key={v.id} className={`rounded-lg border ${isLive ? "border-amber-400 bg-amber-400/10" : "border-slate-700 bg-slate-800/50"}`}>
                    <button onClick={() => c.actions.showVerseCue(v)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-slate-800/80" data-testid="console-verse">
                      {g.id === currentPointId && idx < 9 && <kbd className="rounded bg-slate-700 px-1.5 text-xs text-slate-300">{idx + 1}</kbd>}
                      <span className="flex-1">
                        <span className="font-semibold">{formatReference(v.ref, pLang)}</span>
                        <span className="ml-2 text-xs text-slate-400">{formatReference(v.ref, "en")}</span>
                      </span>
                      {isLive && <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-slate-950">{t("live")}</span>}
                    </button>
                    {isLive && live.slideCount > 1 && (
                      <div className="flex items-center gap-2 border-t border-amber-400/30 px-3 py-1.5">
                        <button className="rounded p-1 hover:bg-slate-700" onClick={() => c.actions.gotoSlide(-1)} aria-label="Previous slide"><ChevronLeft className="h-4 w-4" /></button>
                        <div className="flex flex-1 flex-wrap gap-1">
                          {c.active?.slides.map((s, si) => (
                            <button key={si} onClick={() => c.actions.showVerse(v.id, v.ref, si)} className={`rounded px-1.5 py-0.5 text-xs ${si === live.slideIndex ? "bg-amber-400 text-slate-950" : "bg-slate-700 text-slate-300"}`}>{s.span}</button>
                          ))}
                        </div>
                        <button className="rounded p-1 hover:bg-slate-700" onClick={() => c.actions.gotoSlide(1)} aria-label="Next slide"><ChevronRight className="h-4 w-4" /></button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {live?.cueId.startsWith("adhoc:") && <div className="mt-3 rounded-lg border border-amber-400 bg-amber-400/10 px-3 py-2 text-sm">{t("live")}: {live.refPrimary}</div>}
    </Panel>
  );
}

function LiveMonitor({ c }: { c: Controller }) {
  const t = useT();
  const { stream } = useCameraStream(c.state.cameraOn, c.state.cameraDeviceId);
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-2">
      <div className="mb-1.5 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
        <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />{t("onScreen")}
      </div>
      <div className="aspect-video overflow-hidden rounded-lg ring-1 ring-slate-700" data-testid="monitor">
        <Stage
          state={c.state}
          cameraStream={stream}
          renderMedia={(scene) => {
            const m = c.mediaStatus?.nonce === scene.nonce ? c.mediaStatus : null;
            return (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-[3cqh] bg-neutral-900">
                {scene.source === "youtube" && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`https://i.ytimg.com/vi/${scene.youtubeId}/mqdefault.jpg`} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
                )}
                <div className="relative text-[7cqh] font-semibold">{m?.paused ? "⏸" : "▶"} {scene.title}</div>
                {m && m.duration > 0 && (
                  <div className="relative h-[2cqh] w-3/4 rounded-full bg-white/20">
                    <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.min(100, (m.currentTime / m.duration) * 100)}%` }} />
                  </div>
                )}
                {m && <div className="relative text-[5cqh] tabular-nums text-white/70">{formatTime(m.currentTime)} / {formatTime(m.duration)}</div>}
              </div>
            );
          }}
        />
      </div>
    </div>
  );
}

function MediaPanel({ sermon, c }: { sermon: Sermon; c: Controller }) {
  const t = useT();
  const live = c.state.scene.kind === "media" ? c.state.scene : null;
  return (
    <Panel title={t("videos")} icon={<Video className="h-4 w-4" />} className="shrink-0">
      {!sermon.media.length && <p className="text-sm text-slate-500">{t("noMedia")}</p>}
      <div className="space-y-1.5">
        {sermon.media.map((cue) => {
          const m = c.mediaById.get(cue.mediaId);
          if (!m) return null;
          const isLive = live?.cueId === cue.id;
          const status = isLive && c.mediaStatus?.nonce === live.nonce ? c.mediaStatus : null;
          return (
            <div key={cue.id} className={`rounded-lg border ${isLive ? "border-amber-400 bg-amber-400/10" : "border-slate-700 bg-slate-800/50"}`}>
              <button className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-slate-800/80" onClick={() => c.actions.showMedia(cue.id, m)} data-testid="console-media">
                <MediaIcon item={m} />
                <span className="flex-1 truncate font-medium">{m.title}</span>
                {isLive ? <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-slate-950">{t("live")}</span> : <Play className="h-4 w-4 text-slate-400" />}
              </button>
              {isLive && m.kind === "video" && (
                <div className="flex items-center gap-1 border-t border-amber-400/30 px-2 py-1.5">
                  <button className="btn px-2 py-1 hover:bg-slate-700" onClick={() => c.actions.mediaCommand(status?.paused ? "play" : "pause")} aria-label={status?.paused ? t("play") : t("pause")}>
                    {status?.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  </button>
                  <button className="btn px-2 py-1 hover:bg-slate-700" onClick={() => c.actions.mediaCommand("restart")} aria-label={t("restart")}><RotateCcw className="h-4 w-4" /></button>
                  <button className="btn px-2 py-1 hover:bg-slate-700" onClick={c.actions.clear} aria-label={t("stop")}><Square className="h-4 w-4" /></button>
                  {status && <span className="ml-auto text-xs tabular-nums text-slate-400">{formatTime(status.currentTime)} / {formatTime(status.duration)}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function CameraPanel({ c }: { c: Controller }) {
  const t = useT();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const refresh = async () => setDevices(await listCameras());
  useEffect(() => { listCameras().then(setDevices); }, []);
  const labelled = devices.some((d) => d.label);
  const enable = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true });
      s.getTracks().forEach((tr) => tr.stop());
      await refresh();
      c.actions.setCameraOn(true);
      setError(null);
    } catch (e) { setError((e as Error).message); }
  };
  const { stream } = useCameraStream(c.state.cameraOn, c.state.cameraDeviceId);
  return (
    <Panel title={t("camera")} icon={<Camera className="h-4 w-4" />} className="shrink-0">
      {devices.length === 0 && !error && <p className="text-sm text-slate-500">{t("noCamera")}</p>}
      {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
      {(!labelled || !c.state.cameraOn) && (
        <button className="btn mb-2 border border-slate-700 hover:bg-slate-800" onClick={enable}><Camera className="h-4 w-4" />{t("enableCamera")}</button>
      )}
      {labelled && (
        <select className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm" value={c.state.cameraDeviceId ?? ""} onChange={(e) => c.actions.setCameraDevice(e.target.value || null)} aria-label="Camera device">
          <option value="">Default camera</option>
          {devices.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>)}
        </select>
      )}
      {c.state.cameraOn && (
        <button onClick={c.actions.camera} className={`relative block aspect-video w-full overflow-hidden rounded-lg ring-2 ${c.state.scene.kind === "camera" ? "ring-amber-400" : "ring-slate-700 hover:ring-slate-500"}`} style={{ containerType: "size" }}>
          <CameraView stream={stream} />
          <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 text-xs">{t("show")}</span>
        </button>
      )}
      <label className="mt-2 flex items-center gap-2 text-sm text-slate-300">
        <input type="checkbox" checked={c.state.cameraOn} onChange={(e) => c.actions.setCameraOn(e.target.checked)} /> Camera as background
      </label>
      <label className="mt-1 flex items-center gap-2 text-sm text-slate-300">
        <input type="checkbox" checked={c.state.overlayOnCamera} onChange={(e) => c.actions.setOverlay(e.target.checked)} /> {t("overlayOnCamera")}
      </label>
    </Panel>
  );
}

function ShortcutHelp({ onClose }: { onClose: () => void }) {
  const rows: [string, string][] = [
    ["→ / PageDown / Space", "Next slide → next verse"],
    ["← / PageUp", "Previous slide"],
    ["1 – 9", "Show verse N of current pointer"],
    ["↓ / N   ↑ / P", "Next / previous pointer"],
    ["B or .", "Blank screen"],
    ["L", "Logo"],
    ["T", "Title slide"],
    ["C", "Camera"],
    ["Esc", "Clear (back to camera/logo)"],
  ];
  return (
    <div className="border-b border-slate-800 bg-slate-900 px-4 py-3 text-sm" onClick={onClose}>
      <div className="grid gap-x-8 gap-y-1 sm:grid-cols-3">
        {rows.map(([k, v]) => <div key={k}><kbd className="rounded bg-slate-700 px-1.5 py-0.5 text-xs">{k}</kbd> <span className="text-slate-400">{v}</span></div>)}
      </div>
    </div>
  );
}
