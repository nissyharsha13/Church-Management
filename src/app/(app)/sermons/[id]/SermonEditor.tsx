"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowDown, ArrowLeft, ArrowUp, BookOpen, Check, ChevronDown, ChevronUp, Film, Loader2, Play, Plus, Save, Trash2, X } from "lucide-react";
import { db } from "@/lib/db";
import { useT } from "@/lib/i18n";
import { formatReference, type VerseRef } from "@/lib/bible/reference";
import { TRANSLATIONS } from "@/lib/bible/translations";
import { FieldLabel, TeluguConvert } from "@/components/TeluguConvert";
import type { VerseSelection } from "@/components/bible/VerseSelector";
import { PassagePreview, VersePicker } from "@/modules/sermons/components/VersePicker";
import { useSermonDraft } from "@/modules/sermons/useSermonDraft";
import { newId, type Sermon, type SermonPoint, type SermonStatus } from "@/modules/sermons/types";
import { MediaIcon } from "@/modules/media/components/MediaIcon";

type Update = (fn: (s: Sermon) => Sermon) => void;

export default function SermonEditor({ id }: { id: string }) {
  const t = useT();
  const router = useRouter();
  const { sermon, update, saved, flush } = useSermonDraft(id);
  // Pointers start collapsed unless still empty; adding a pointer collapses the others.
  const [expanded, setExpanded] = useState<Set<string> | null>(null);
  const [flash, setFlash] = useState(false);

  if (sermon === undefined) return null;
  if (sermon === null) return <div className="card p-8 text-center">{t("notFound")} · <Link className="text-gold-600" href="/">{t("back")}</Link></div>;

  const open = expanded ?? new Set(sermon.points.filter((p) => !p.title && !p.notes).map((p) => p.id));
  const toggle = (pid: string) => {
    const next = new Set(open);
    if (next.has(pid)) next.delete(pid); else next.add(pid);
    setExpanded(next);
  };
  const addPoint = () => {
    const pid = newId();
    update((s) => ({ ...s, points: [...s.points, { id: pid, title: "", notes: "" }] }));
    setExpanded(new Set([pid]));
  };

  const set = <K extends keyof Sermon>(k: K, v: Sermon[K]) => update((s) => ({ ...s, [k]: v }));
  const totalMinutes = sermon.points.reduce((n, p) => n + (p.minutes ?? 0), 0);

  const save = async () => {
    await flush();
    setFlash(true);
    setTimeout(() => setFlash(false), 1800);
  };

  return (
    <div className="space-y-5 pb-24">
      {/* Sticky save bar */}
      <div className="sticky top-[57px] z-10 -mx-4 flex flex-wrap items-center gap-2 border-b border-stone-200 bg-stone-50/95 px-4 py-2 backdrop-blur">
        <Link href="/" className="btn-ghost"><ArrowLeft className="h-4 w-4" />{t("back")}</Link>
        <span className="ml-auto flex items-center gap-1.5 text-sm" title={t("autoSaveHint")} data-testid="save-status">
          {saved ? (
            <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 ${flash ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700"}`}>
              <Check className="h-3.5 w-3.5" />{t("allSaved")}
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-amber-700"><Loader2 className="h-3.5 w-3.5 animate-spin" />{t("saving")}</span>
          )}
        </span>
        <button className="btn-primary" onClick={save}><Save className="h-4 w-4" />{t("save")}</button>
        <button className="btn-secondary" onClick={async () => { await flush(); router.push(`/present/${sermon.id}`); }}>
          <Play className="h-4 w-4" />{t("saveAndStart")}
        </button>
      </div>

      {/* Details */}
      <section className="card grid gap-4 p-5 md:grid-cols-6">
        <div className="md:col-span-6">
          <FieldLabel htmlFor="title" value={sermon.title} onChange={(v) => set("title", v)}>{t("topic")}</FieldLabel>
          <input id="title" className="input text-lg font-semibold" value={sermon.title} onChange={(e) => set("title", e.target.value)} placeholder="tufaanulo vishvasam / తుఫానులో విశ్వాసం" />
        </div>
        <div className="md:col-span-2">
          <label className="label" htmlFor="date">{t("date")}</label>
          <input id="date" type="date" className="input" value={sermon.date} onChange={(e) => set("date", e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <label className="label" htmlFor="service">{t("service")}</label>
          <input id="service" className="input" list="service-names" value={sermon.serviceName} onChange={(e) => set("serviceName", e.target.value)} />
          <datalist id="service-names">
            {["Sunday Service", "Sunday Evening", "Midweek Prayer", "Cottage Prayer", "House Prayer", "Youth Meeting", "Retreat"].map((s) => <option key={s} value={s} />)}
          </datalist>
        </div>
        <div className="md:col-span-2">
          <label className="label" htmlFor="status">{t("status")}</label>
          <select id="status" className="input" value={sermon.status} onChange={(e) => set("status", e.target.value as SermonStatus)}>
            {(["draft", "ready", "delivered"] as const).map((s) => <option key={s} value={s}>{t(`status_${s}`)}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="label" htmlFor="speaker">{t("speaker")}</label>
          <input id="speaker" className="input" value={sermon.speaker} onChange={(e) => set("speaker", e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <label className="label" htmlFor="primaryTr">{t("translations")} · {t("primary")}</label>
          <select id="primaryTr" className="input" value={sermon.primaryTranslation} onChange={(e) => set("primaryTranslation", e.target.value)}>
            {TRANSLATIONS.map((tr) => <option key={tr.id} value={tr.id}>{tr.abbr} — {tr.nativeName}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="label" htmlFor="secondaryTr">{t("secondary")}</label>
          <select id="secondaryTr" className="input" value={sermon.secondaryTranslation} onChange={(e) => set("secondaryTranslation", e.target.value)}>
            <option value="">{t("none")}</option>
            {TRANSLATIONS.map((tr) => <option key={tr.id} value={tr.id}>{tr.abbr} — {tr.nativeName}</option>)}
          </select>
        </div>
        <div className="md:col-span-6">
          <FieldLabel htmlFor="gist" value={sermon.gist} onChange={(v) => set("gist", v)}>{t("gist")}</FieldLabel>
          <textarea id="gist" className="input min-h-20" value={sermon.gist} onChange={(e) => set("gist", e.target.value)} placeholder={t("gistHint")} />
        </div>
      </section>

      {/* Pointers */}
      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-lg font-semibold">{t("points")}</h2>
            <p className="text-sm text-stone-500">{t("pointsHint")}</p>
          </div>
          {totalMinutes > 0 && <span className="text-sm text-stone-500">{t("planned")}: {totalMinutes} {t("minutes")}</span>}
        </div>
        {sermon.points.map((p, i) => (
          open.has(p.id)
            ? <PointEditor key={p.id} sermon={sermon} point={p} index={i} update={update} onCollapse={() => toggle(p.id)} />
            : <PointTile key={p.id} sermon={sermon} point={p} index={i} onExpand={() => toggle(p.id)} />
        ))}
        <button className="btn-secondary" onClick={addPoint} data-testid="add-point">
          <Plus className="h-4 w-4" />{t("addPoint")}
        </button>
      </section>

      {/* General verses + media */}
      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">{t("general")}</h2>
        <CueList sermon={sermon} pointId={null} update={update} />
        <AddCues sermon={sermon} pointId={null} update={update} />
      </section>
    </div>
  );
}

/** Collapsed pointer: compact summary, click to expand. */
function PointTile({ sermon, point, index, onExpand }: { sermon: Sermon; point: SermonPoint; index: number; onExpand: () => void }) {
  const t = useT();
  const media = useLiveQuery(() => db.media.toArray(), []) ?? [];
  const verses = sermon.verses.filter((v) => v.pointId === point.id);
  const cues = sermon.media.filter((m) => m.pointId === point.id);
  return (
    <button onClick={onExpand} className="card block w-full p-3 text-left transition hover:border-gold-300" data-testid="point-tile" aria-label={`${t("expand")} ${index + 1}`}>
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-100 text-xs font-bold text-gold-700">{index + 1}</span>
        <span className="flex-1 truncate font-semibold">{point.title || <span className="italic text-stone-400">{t("pointTitle")}</span>}</span>
        {point.minutes ? <span className="text-xs text-stone-500">{point.minutes} {t("minutes")}</span> : null}
        <ChevronDown className="h-4 w-4 text-stone-400" />
      </div>
      <p className="mt-1 line-clamp-2 whitespace-pre-line pl-8 text-xs leading-relaxed text-stone-500">{point.notes || t("noNotes")}</p>
      {(verses.length > 0 || cues.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-1 pl-8">
          {verses.map((v) => (
            <span key={v.id} className="inline-flex items-center gap-1 rounded bg-gold-50 px-1.5 py-0.5 text-[11px] text-gold-700"><BookOpen className="h-3 w-3" />{formatReference(v.ref, "te")}</span>
          ))}
          {cues.map((c) => {
            const m = media.find((x) => x.id === c.mediaId);
            return <span key={c.id} className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] text-emerald-700"><MediaIcon item={m} className="h-3 w-3" />{m?.title ?? "…"}</span>;
          })}
        </div>
      )}
    </button>
  );
}

function PointEditor({ sermon, point, index, update, onCollapse }: { sermon: Sermon; point: SermonPoint; index: number; update: Update; onCollapse: () => void }) {
  const t = useT();
  const setPoint = (patch: Partial<SermonPoint>) =>
    update((s) => ({ ...s, points: s.points.map((p) => (p.id === point.id ? { ...p, ...patch } : p)) }));
  const move = (dir: -1 | 1) => update((s) => {
    const pts = [...s.points];
    const j = index + dir;
    if (j < 0 || j >= pts.length) return s;
    [pts[index], pts[j]] = [pts[j], pts[index]];
    return { ...s, points: pts };
  });
  const remove = () => {
    if (!confirm(`${t("delete")}?`)) return;
    // Cues of a removed pointer become "general" rather than being lost.
    update((s) => ({
      ...s,
      points: s.points.filter((p) => p.id !== point.id),
      verses: s.verses.map((v) => (v.pointId === point.id ? { ...v, pointId: null } : v)),
      media: s.media.map((m) => (m.pointId === point.id ? { ...m, pointId: null } : m)),
    }));
  };
  return (
    <div className="card border-gold-200 p-4 ring-1 ring-gold-100" data-testid="point">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold-600 text-sm font-bold text-white">{index + 1}</span>
        <input className="input font-semibold" placeholder={t("pointTitle")} value={point.title} onChange={(e) => setPoint({ title: e.target.value })} aria-label={t("pointTitle")} />
        <input className="input w-20" type="number" min={0} placeholder={t("minutes")} value={point.minutes ?? ""} onChange={(e) => setPoint({ minutes: e.target.value ? +e.target.value : undefined })} title={`${t("planned")} (${t("minutes")})`} />
        <button className="btn-ghost px-2" onClick={() => move(-1)} aria-label="Move up"><ArrowUp className="h-4 w-4" /></button>
        <button className="btn-ghost px-2" onClick={() => move(1)} aria-label="Move down"><ArrowDown className="h-4 w-4" /></button>
        <button className="btn-danger px-2" onClick={remove} aria-label={t("delete")}><Trash2 className="h-4 w-4" /></button>
        <button className="btn-ghost px-2" onClick={onCollapse} aria-label={t("collapse")}><ChevronUp className="h-4 w-4" /></button>
      </div>
      <div className="mt-1 pl-9">
        <TeluguConvert value={point.title} onChange={(v) => setPoint({ title: v })} label={t("pointTitle")} />
      </div>
      <div className="mt-3">
        <FieldLabel htmlFor={`notes-${point.id}`} value={point.notes} onChange={(v) => setPoint({ notes: v })}>{t("notes")}</FieldLabel>
        <textarea id={`notes-${point.id}`} className="input min-h-24" placeholder={t("notes")} value={point.notes} onChange={(e) => setPoint({ notes: e.target.value })} />
      </div>
      <div className="mt-3 space-y-3">
        <CueList sermon={sermon} pointId={point.id} update={update} />
        <AddCues sermon={sermon} pointId={point.id} update={update} />
      </div>
    </div>
  );
}

function CueList({ sermon, pointId, update }: { sermon: Sermon; pointId: string | null; update: Update }) {
  const media = useLiveQuery(() => db.media.toArray(), []) ?? [];
  const mediaById = new Map(media.map((m) => [m.id, m]));
  const verses = sermon.verses.filter((v) => v.pointId === pointId);
  const cues = sermon.media.filter((m) => m.pointId === pointId);
  const [open, setOpen] = useState<string | null>(null);
  if (!verses.length && !cues.length) return null;
  const pointOptions = [{ id: "", label: "—" }, ...sermon.points.map((p, i) => ({ id: p.id, label: `${i + 1}. ${p.title || "…"}` }))];
  const moveVerse = (id: string, to: string) => update((s) => ({ ...s, verses: s.verses.map((v) => (v.id === id ? { ...v, pointId: to || null } : v)) }));
  return (
    <div className="space-y-1.5">
      {verses.map((v) => (
        <div key={v.id} className="rounded-lg border border-stone-200">
          <div className="flex items-center gap-2 px-3 py-1.5">
            <BookOpen className="h-4 w-4 text-gold-500" />
            <button className="flex-1 text-left text-sm font-medium" onClick={() => setOpen(open === v.id ? null : v.id)} data-testid="verse-cue">
              {formatReference(v.ref, "te")} <span className="text-stone-400">· {formatReference(v.ref, "en")}</span>
            </button>
            <select className="rounded border border-stone-200 bg-white px-1 py-0.5 text-xs text-stone-500" value={v.pointId ?? ""} onChange={(e) => moveVerse(v.id, e.target.value)} aria-label="Move to pointer">
              {pointOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            <button className="text-stone-400 hover:text-red-600" onClick={() => update((s) => ({ ...s, verses: s.verses.filter((x) => x.id !== v.id) }))} aria-label="Remove"><X className="h-4 w-4" /></button>
          </div>
          {open === v.id && <div className="px-3 pb-3"><PassagePreview refValue={v.ref} primary={sermon.primaryTranslation} secondary={sermon.secondaryTranslation} compact /></div>}
        </div>
      ))}
      {cues.map((c) => {
        const m = mediaById.get(c.mediaId);
        return (
          <div key={c.id} className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-1.5 text-sm">
            <MediaIcon item={m} />
            <span className="flex-1 font-medium">{m?.title ?? "(missing media)"}</span>
            <button className="text-stone-400 hover:text-red-600" onClick={() => update((s) => ({ ...s, media: s.media.filter((x) => x.id !== c.id) }))} aria-label="Remove"><X className="h-4 w-4" /></button>
          </div>
        );
      })}
    </div>
  );
}

function AddCues({ sermon, pointId, update }: { sermon: Sermon; pointId: string | null; update: Update }) {
  const t = useT();
  const [panel, setPanel] = useState<"none" | "verse" | "media">("none");
  // Remember the last book/chapter so the next verse from the same chapter is one tap away.
  const [lastPlace, setLastPlace] = useState<VerseSelection | undefined>(undefined);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const media = useLiveQuery(() => db.media.orderBy("createdAt").reverse().toArray(), []) ?? [];
  const hasVerses = sermon.verses.some((v) => v.pointId === pointId);

  const addVerse = (ref: VerseRef) => {
    update((s) => ({ ...s, verses: [...s.verses, { id: newId(), pointId, ref }] }));
    setLastPlace({ book: ref.book, chapter: ref.chapter, start: null, end: null });
    setJustAdded(formatReference(ref, "te"));
    setTimeout(() => setJustAdded(null), 2500);
    setPanel("none"); // close; reopening starts a fresh selection
  };
  const addMedia = (mediaId: string) => update((s) => ({ ...s, media: [...s.media, { id: newId(), pointId, mediaId }] }));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button className={`btn ${panel === "verse" ? "bg-gold-50 text-gold-700" : "btn-ghost"}`} onClick={() => setPanel(panel === "verse" ? "none" : "verse")} data-testid="open-verse-picker">
          <BookOpen className="h-4 w-4" />{hasVerses ? t("addAnotherVerse") : t("addVerse")}
        </button>
        <button className={`btn ${panel === "media" ? "bg-emerald-50 text-emerald-700" : "btn-ghost"}`} onClick={() => setPanel(panel === "media" ? "none" : "media")}><Film className="h-4 w-4" />{t("addFromLibrary")}</button>
        {justAdded && <span className="flex items-center gap-1 text-sm text-emerald-700" role="status"><Check className="h-4 w-4" />{t("verseAdded")}: {justAdded}</span>}
      </div>
      {panel === "verse" && (
        <div className="mt-2 rounded-lg border border-gold-100 bg-gold-50/30 p-3">
          <VersePicker primaryTranslation={sermon.primaryTranslation} secondaryTranslation={sermon.secondaryTranslation} onAdd={addVerse} initialSelection={lastPlace} />
        </div>
      )}
      {panel === "media" && (
        <div className="mt-2 rounded-lg border border-emerald-100 bg-emerald-50/30 p-3">
          {media.length === 0 ? (
            <p className="text-sm text-stone-500">{t("emptyLibrary")} <Link className="text-gold-600 underline" href="/library">{t("library")}</Link></p>
          ) : (
            <div className="grid gap-1.5 sm:grid-cols-2">
              {media.map((m) => (
                <button key={m.id} className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-left text-sm hover:border-emerald-400" onClick={() => addMedia(m.id)}>
                  <MediaIcon item={m} /><span className="flex-1 truncate">{m.title}</span><Plus className="h-4 w-4 text-stone-400" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
