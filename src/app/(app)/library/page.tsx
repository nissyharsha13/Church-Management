"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Trash2, Upload, Wifi, WifiOff, MonitorPlay as Youtube } from "lucide-react";
import { db, DEFAULT_CHURCH_ID } from "@/lib/db";
import { useT } from "@/lib/i18n";
import { MediaIcon } from "@/modules/media/components/MediaIcon";
import { formatTime, parseTime, parseYouTubeId, type MediaItem } from "@/modules/media/types";
import { newId } from "@/modules/sermons/types";

export default function LibraryPage() {
  const t = useT();
  const items = useLiveQuery(() => db.media.orderBy("createdAt").reverse().toArray(), []);
  const [yt, setYt] = useState({ url: "", title: "", start: "", end: "" });
  const [busy, setBusy] = useState(false);
  const ytId = parseYouTubeId(yt.url);

  const addYouTube = async () => {
    if (!ytId) return;
    await db.media.add({
      id: newId(), churchId: DEFAULT_CHURCH_ID, title: yt.title.trim() || `YouTube ${ytId}`, kind: "video", source: "youtube",
      youtubeId: ytId, startSec: parseTime(yt.start), endSec: parseTime(yt.end), tags: [], createdAt: Date.now(),
    });
    setYt({ url: "", title: "", start: "", end: "" });
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const f of Array.from(files)) {
        const kind = f.type.startsWith("image/") ? "image" : "video";
        const fileId = newId();
        await db.transaction("rw", db.media, db.mediaFiles, async () => {
          await db.mediaFiles.add({ id: fileId, blob: f });
          await db.media.add({
            id: newId(), churchId: DEFAULT_CHURCH_ID, title: f.name.replace(/\.[^.]+$/, ""), kind, source: "file",
            fileId, mime: f.type, size: f.size, tags: [], createdAt: Date.now(),
          });
        });
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = async (m: MediaItem) => {
    if (!confirm(`${t("delete")} "${m.title}"?`)) return;
    await db.transaction("rw", db.media, db.mediaFiles, async () => {
      await db.media.delete(m.id);
      if (m.fileId) await db.mediaFiles.delete(m.fileId);
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("library")}</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="card space-y-3 p-5">
          <h2 className="flex items-center gap-2 font-semibold"><Upload className="h-4 w-4" />{t("uploadFile")}</h2>
          <p className="text-sm text-stone-500">Stored on this computer — plays without internet.</p>
          <label className={`btn-primary cursor-pointer ${busy ? "opacity-50" : ""}`}>
            <Upload className="h-4 w-4" />{busy ? "…" : t("uploadFile")}
            <input type="file" accept="video/*,image/*" multiple className="hidden" onChange={(e) => upload(e.target.files)} disabled={busy} data-testid="upload" />
          </label>
        </section>
        <section className="card space-y-3 p-5">
          <h2 className="flex items-center gap-2 font-semibold"><Youtube className="h-4 w-4 text-red-500" />{t("addYouTube")}</h2>
          <input className="input" placeholder="https://www.youtube.com/watch?v=…" value={yt.url} onChange={(e) => setYt({ ...yt, url: e.target.value })} aria-label="YouTube URL" />
          <input className="input" placeholder={t("title")} value={yt.title} onChange={(e) => setYt({ ...yt, title: e.target.value })} aria-label={t("title")} />
          <div className="flex gap-2">
            <input className="input" placeholder={t("startAt")} value={yt.start} onChange={(e) => setYt({ ...yt, start: e.target.value })} aria-label={t("startAt")} />
            <input className="input" placeholder={t("endAt")} value={yt.end} onChange={(e) => setYt({ ...yt, end: e.target.value })} aria-label={t("endAt")} />
            <button className="btn-primary" disabled={!ytId} onClick={addYouTube}>{t("add")}</button>
          </div>
          {yt.url && !ytId && <p className="text-xs text-red-600">Not a YouTube link</p>}
        </section>
      </div>

      {items && items.length === 0 && <div className="card p-8 text-center text-stone-500">{t("emptyLibrary")}</div>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items?.map((m) => <MediaCard key={m.id} item={m} onDelete={() => remove(m)} />)}
      </div>
    </div>
  );
}

function MediaCard({ item: m, onDelete }: { item: MediaItem; onDelete: () => void }) {
  const t = useT();
  const [fileThumb, setFileThumb] = useState<string | null>(null);
  const thumb = m.source === "youtube" ? `https://i.ytimg.com/vi/${m.youtubeId}/mqdefault.jpg` : fileThumb;
  useEffect(() => {
    if (m.source !== "file" || m.kind !== "image" || !m.fileId) return;
    let url = "";
    db.mediaFiles.get(m.fileId).then((f) => { if (f) { url = URL.createObjectURL(f.blob); setFileThumb(url); } });
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [m]);
  const trim = m.startSec !== undefined || m.endSec !== undefined ? `${formatTime(m.startSec ?? 0)} – ${formatTime(m.endSec) || "end"}` : "";
  return (
    <div className="card overflow-hidden">
      <div className="flex aspect-video items-center justify-center bg-stone-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {thumb ? <img src={thumb} alt="" className="h-full w-full object-cover" /> : <MediaIcon item={m} className="h-10 w-10" />}
      </div>
      <div className="flex items-center gap-2 p-3">
        <MediaIcon item={m} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{m.title}</div>
          <div className="flex items-center gap-1 text-xs text-stone-500">
            {m.source === "file" ? <><WifiOff className="h-3 w-3" />{t("offlineReady")}{m.size ? ` · ${(m.size / 1e6).toFixed(1)} MB` : ""}</> : <><Wifi className="h-3 w-3" />{t("needsInternet")}</>}
            {trim && ` · ${trim}`}
          </div>
        </div>
        <button className="btn-danger px-2" onClick={onDelete} aria-label={t("delete")}><Trash2 className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
