"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { BookOpenCheck, Copy, Pencil, Play, Plus, Sparkles, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { useT } from "@/lib/i18n";
import { formatReference } from "@/lib/bible/reference";
import { createSampleSermon, createSermon, deleteSermon, duplicateSermon } from "@/modules/sermons/repo";
import { todayISO, type Sermon } from "@/modules/sermons/types";

export default function Dashboard() {
  const t = useT();
  const router = useRouter();
  const sermons = useLiveQuery(() => db.sermons.orderBy("date").reverse().toArray(), []);
  if (!sermons) return null;
  // Read the clock only after data loads (client-side), never during prerender.
  const today = todayISO();
  const groups: [string, Sermon[]][] = [
    [t("today"), sermons.filter((s) => s.date === today)],
    [t("upcoming"), sermons.filter((s) => s.date > today).reverse()],
    [t("past"), sermons.filter((s) => s.date < today)],
  ];

  const create = async () => router.push(`/sermons/${(await createSermon()).id}`);
  const sample = async () => { await createSampleSermon(); };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t("sermons")}</h1>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={sample}><Sparkles className="h-4 w-4" />{t("sampleSermon")}</button>
          <button className="btn-primary" onClick={create}><Plus className="h-4 w-4" />{t("newSermon")}</button>
        </div>
      </div>

      {sermons.length === 0 && (
        <div className="card p-10 text-center text-stone-500">
          <BookOpenCheck className="mx-auto mb-3 h-10 w-10 text-stone-300" />
          {t("noSermons")}
        </div>
      )}

      {groups.map(([label, list]) => list.length > 0 && (
        <section key={label}>
          <h2 className="label mb-2">{label}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {list.map((s) => <SermonCard key={s.id} sermon={s} isToday={s.date === today} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

function SermonCard({ sermon: s, isToday }: { sermon: Sermon; isToday: boolean }) {
  const t = useT();
  const router = useRouter();
  const statusColor = { draft: "bg-amber-100 text-amber-800", ready: "bg-emerald-100 text-emerald-800", delivered: "bg-stone-100 text-stone-600" }[s.status];
  return (
    <div className={`card flex flex-col p-4 ${isToday ? "ring-2 ring-gold-300" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs text-stone-500">
            {new Date(s.date + "T00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })} · {s.serviceName}
          </div>
          <Link href={`/sermons/${s.id}`} className="mt-0.5 block truncate text-lg font-semibold hover:text-gold-700">
            {s.title || <span className="italic text-stone-400">Untitled</span>}
          </Link>
          {s.speaker && <div className="text-sm text-stone-500">{s.speaker}</div>}
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusColor}`}>{t(`status_${s.status}`)}</span>
      </div>
      <div className="mt-2 line-clamp-2 text-sm text-stone-600">
        {s.verses.slice(0, 4).map((v) => formatReference(v.ref, "te")).join(" · ")}
      </div>
      <div className="mt-3 flex items-center gap-1 border-t border-stone-100 pt-3">
        <button className="btn-primary" onClick={() => router.push(`/present/${s.id}`)}><Play className="h-4 w-4" />{t("start")}</button>
        <Link className="btn-ghost" href={`/sermons/${s.id}`}><Pencil className="h-4 w-4" />{t("edit")}</Link>
        <button className="btn-ghost" onClick={() => duplicateSermon(s.id)}><Copy className="h-4 w-4" />{t("duplicate")}</button>
        <button className="btn-danger ml-auto" onClick={() => confirm(t("confirmDelete")) && deleteSermon(s.id)} aria-label={t("delete")}><Trash2 className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
