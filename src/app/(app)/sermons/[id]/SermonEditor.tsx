"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowDown, ArrowLeft, ArrowUp, BookOpen, Check, Film, Play, Plus, Trash2, X } from "lucide-react";
import { db } from "@/lib/db";
import { useT } from "@/lib/i18n";
import { formatReference, type VerseRef } from "@/lib/bible/reference";
import { TRANSLATIONS } from "@/lib/bible/translations";
import { PassagePreview, VersePicker } from "@/modules/sermons/components/VersePicker";
import { useSermonDraft } from "@/modules/sermons/useSermonDraft";
import { newId, type Sermon, type SermonPoint, type SermonStatus } from "@/modules/sermons/types";
import { MediaIcon } from "@/modules/media/components/MediaIcon";

export default function SermonEditor({ id }: { id: string }) {
  const t = useT();
  const router = useRouter();
  const { sermon, update, saved, flush } = useSermonDraft(id);

  if (sermon === undefined) return null;
  if (sermon === null) return <div className="card p-8 text-center">{t("notFound")} · <Link className="text-indigo-600" href="/">{t("back")}</Link></div>;

  const set = <K extends keyof Sermon>(k: K, v: Sermon[K]) => update((s) => ({ ...s, [k]: v }));
  const totalMinutes = sermon.points.reduce((n, p) => n + (p.minutes ?? 0), 0);

  return (
    <div className="space-y-5 pb-24">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/" className="btn-ghost"><ArrowLeft className="h-4 w-4" />{t("back")}</Link>
        <span className="ml-auto text-xs text-slate-500">{saved ? <><Check className="mr-1 inline h-3 w-3" />{t("saved")}</> : "…"}</span>
        <button className="btn-primary" onClick={async () => { await flush(); router.push(`/present/${sermon.id}`); }}>
          <Play className="h-4 w-4" />{t("start")}
        </button>
      </div>

      {/* Details */}
      <section className="card grid gap-4 p-5 md:grid-cols-6">
        <div className="md:col-span-6">
          <label className="label" htmlFor="title">{t("topic")}</label>
          <input id="title" className="input text-lg font-semibold" value={sermon.title} onChange={(e) => set("title", e.target.value)} placeholder="తుఫానులో విశ్వాసం" />
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
          <label className="label" htmlFor="gist">{t("gist")}</label>
          <textarea id="gist" className="input min-h-20" value={sermon.gist} onChange={(e) => set("gist", e.target.value)} placeholder={t("gistHint")} />
        </div>
      </section>

      {/* Pointers */}
      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-lg font-semibold">{t("points")}</h2>
            <p className="text-sm text-slate-500">{t("pointsHint")}</p>
          </div>
          {totalMinutes > 0 && <span className="text-sm text-slate-500">{t("planned")}: {totalMinutes} {t("minutes")}</span>}
        </div>
        {sermon.points.map((p, i) => (
          <PointEditor key={p.id} sermon={sermon} point={p} index={i} update={update} />
        ))}
        <button className="btn-secondary" onClick={() => update((s) => ({ ...s, points: [...s.points, { id: newId(), title: "", notes: "" }] }))}>
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

type Update = (fn: (s: Sermon) => Sermon) => void;

function PointEditor({ sermon, point, index, update }: { sermon: Sermon; point: SermonPoint; index: number; update: Update }) {
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
    <div className="card p-4" data-testid="point">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">{index + 1}</span>
        <input className="input font-semibold" placeholder={t("pointTitle")} value={point.title} onChange={(e) => setPoint({ title: e.target.value })} />
        <input className="input w-20" type="number" min={0} placeholder={t("minutes")} value={point.minutes ?? ""} onChange={(e) => setPoint({ minutes: e.target.value ? +e.target.value : undefined })} title={`${t("planned")} (${t("minutes")})`} />
        <button className="btn-ghost px-2" onClick={() => move(-1)} aria-label="Move up"><ArrowUp className="h-4 w-4" /></button>
        <button className="btn-ghost px-2" onClick={() => move(1)} aria-label="Move down"><ArrowDown className="h-4 w-4" /></button>
        <button className="btn-danger px-2" onClick={remove} aria-label={t("delete")}><Trash2 className="h-4 w-4" /></button>
      </div>
      <textarea className="input mt-3 min-h-24" placeholder={t("notes")} value={point.notes} onChange={(e) => setPoint({ notes: e.target.value })} />
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
        <div key={v.id} className="rounded-lg border border-slate-200">
          <div className="flex items-center gap-2 px-3 py-1.5">
            <BookOpen className="h-4 w-4 text-indigo-500" />
            <button className="flex-1 text-left text-sm font-medium" onClick={() => setOpen(open === v.id ? null : v.id)} data-testid="verse-cue">
              {formatReference(v.ref, "te")} <span className="text-slate-400">· {formatReference(v.ref, "en")}</span>
            </button>
            <select className="rounded border border-slate-200 bg-white px-1 py-0.5 text-xs text-slate-500" value={v.pointId ?? ""} onChange={(e) => moveVerse(v.id, e.target.value)} aria-label="Move to pointer">
              {pointOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            <button className="text-slate-400 hover:text-red-600" onClick={() => update((s) => ({ ...s, verses: s.verses.filter((x) => x.id !== v.id) }))} aria-label="Remove"><X className="h-4 w-4" /></button>
          </div>
          {open === v.id && <div className="px-3 pb-3"><PassagePreview refValue={v.ref} primary={sermon.primaryTranslation} secondary={sermon.secondaryTranslation} compact /></div>}
        </div>
      ))}
      {cues.map((c) => {
        const m = mediaById.get(c.mediaId);
        return (
          <div key={c.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
            <MediaIcon item={m} />
            <span className="flex-1 font-medium">{m?.title ?? "(missing media)"}</span>
            <button className="text-slate-400 hover:text-red-600" onClick={() => update((s) => ({ ...s, media: s.media.filter((x) => x.id !== c.id) }))} aria-label="Remove"><X className="h-4 w-4" /></button>
          </div>
        );
      })}
    </div>
  );
}

function AddCues({ sermon, pointId, update }: { sermon: Sermon; pointId: string | null; update: Update }) {
  const t = useT();
  const [panel, setPanel] = useState<"none" | "verse" | "media">("none");
  const media = useLiveQuery(() => db.media.orderBy("createdAt").reverse().toArray(), []) ?? [];
  const addVerse = (ref: VerseRef) => update((s) => ({ ...s, verses: [...s.verses, { id: newId(), pointId, ref }] }));
  const addMedia = (mediaId: string) => update((s) => ({ ...s, media: [...s.media, { id: newId(), pointId, mediaId }] }));
  return (
    <div>
      <div className="flex gap-2">
        <button className={`btn ${panel === "verse" ? "bg-indigo-50 text-indigo-700" : "btn-ghost"}`} onClick={() => setPanel(panel === "verse" ? "none" : "verse")}><BookOpen className="h-4 w-4" />{t("addVerse")}</button>
        <button className={`btn ${panel === "media" ? "bg-emerald-50 text-emerald-700" : "btn-ghost"}`} onClick={() => setPanel(panel === "media" ? "none" : "media")}><Film className="h-4 w-4" />{t("addFromLibrary")}</button>
      </div>
      {panel === "verse" && (
        <div className="mt-2 rounded-lg border border-indigo-100 bg-indigo-50/30 p-3">
          <VersePicker primaryTranslation={sermon.primaryTranslation} secondaryTranslation={sermon.secondaryTranslation} onAdd={addVerse} autoFocus />
        </div>
      )}
      {panel === "media" && (
        <div className="mt-2 rounded-lg border border-emerald-100 bg-emerald-50/30 p-3">
          {media.length === 0 ? (
            <p className="text-sm text-slate-500">{t("emptyLibrary")} <Link className="text-indigo-600 underline" href="/library">{t("library")}</Link></p>
          ) : (
            <div className="grid gap-1.5 sm:grid-cols-2">
              {media.map((m) => (
                <button key={m.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:border-emerald-400" onClick={() => addMedia(m.id)}>
                  <MediaIcon item={m} /><span className="flex-1 truncate">{m.title}</span><Plus className="h-4 w-4 text-slate-400" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
