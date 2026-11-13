"use client";

import { useEffect, useState } from "react";
import { Check, Download, ImageUp, RotateCcw } from "lucide-react";
import { db, DEFAULT_SETTINGS, getSettings, type ChurchSettings } from "@/lib/db";
import { useT } from "@/lib/i18n";
import { BOOKS } from "@/lib/bible/canon";
import { offlineStatus, prepareOffline } from "@/lib/bible/loader";
import { TRANSLATIONS } from "@/lib/bible/translations";
import { ChurchLogo } from "@/components/ChurchLogo";
import { FieldLabel } from "@/components/TeluguConvert";
import { Stage } from "@/modules/presenter/Stage";
import { INITIAL_STATE, type DisplayState } from "@/modules/presenter/protocol";

const ALL_BOOKS = BOOKS.map((b) => b.id);

/** Resize an uploaded logo (keeps transparency) so it stays small in local storage. */
async function logoToDataUrl(file: File): Promise<string> {
  if (file.type === "image/svg+xml") {
    if (file.size > 300_000) throw new Error("SVG too large (max 300 KB)");
    return await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(file); });
  }
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 800 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/png");
}

export default function SettingsPage() {
  const t = useT();
  const [s, setS] = useState<ChurchSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [preview, setPreview] = useState<"welcome" | "ended">("welcome");
  useEffect(() => { getSettings().then(setS); }, []);

  const save = async () => {
    await db.churches.put(s);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };
  /** Logo changes apply immediately (no need to press Save). */
  const saveLogo = async (patch: Partial<ChurchSettings>) => {
    const next = { ...(await getSettings()), ...patch };
    await db.churches.put(next);
    setS((cur) => ({ ...cur, ...patch }));
  };
  const field = (k: keyof ChurchSettings) => ({ value: s[k] as string, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setS({ ...s, [k]: e.target.value }) });
  const text = (k: keyof ChurchSettings) => ({ value: s[k] as string, onChange: (v: string) => setS({ ...s, [k]: v }) });

  const previewState: DisplayState = {
    ...INITIAL_STATE,
    scene: { kind: preview },
    church: { name: s.name, nameTe: s.nameTe, tagline: s.tagline, pastorName: s.pastorName, address: s.address, serviceTimes: s.serviceTimes, youtubeName: s.youtubeName, youtubeUrl: s.youtubeUrl },
    translations: { primary: s.defaultPrimaryTranslation, secondary: s.defaultSecondaryTranslation },
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("settings")}</h1>

      {/* Church profile — shown on the screen */}
      <section className="card p-5">
        <h2 className="mb-1 font-semibold">{t("churchProfile")}</h2>
        <p className="mb-4 text-sm text-stone-500">{t("churchProfileHint")}</p>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 flex items-center gap-4 rounded-lg border border-gold-200 bg-gold-50/40 p-3">
              <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-stone-900"><ChurchLogo className="h-16 w-16" shine /></div>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <label className="btn-secondary cursor-pointer">
                    <ImageUp className="h-4 w-4" />{t("uploadLogo")}
                    <input
                      type="file"
                      accept="image/png,image/svg+xml,image/webp,image/jpeg"
                      className="hidden"
                      data-testid="logo-upload"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        try { setLogoError(null); await saveLogo({ logoDataUrl: await logoToDataUrl(f) }); }
                        catch (err) { setLogoError((err as Error).message); }
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {s.logoDataUrl && <button className="btn-ghost" onClick={() => saveLogo({ logoDataUrl: "" })}><RotateCcw className="h-4 w-4" />{t("defaultLogo")}</button>}
                </div>
                <label className="flex items-center gap-2 text-sm text-stone-700">
                  <input type="checkbox" checked={s.logoGold} onChange={(e) => saveLogo({ logoGold: e.target.checked })} /> {t("goldFinish")}
                </label>
                <p className="text-xs text-stone-500">{t("logoHint")}</p>
                {logoError && <p className="text-xs text-red-600">{logoError}</p>}
              </div>
            </div>
            <div><label className="label" htmlFor="name">{t("churchName")}</label><input id="name" className="input" {...field("name")} /></div>
            <div><FieldLabel htmlFor="nameTe" {...text("nameTe")}>{t("churchNameTe")}</FieldLabel><input id="nameTe" className="input" {...field("nameTe")} /></div>
            <div className="sm:col-span-2"><label className="label" htmlFor="tagline">{t("tagline")}</label><input id="tagline" className="input" {...field("tagline")} /></div>
            <div><label className="label" htmlFor="pastor">{t("pastorName")}</label><input id="pastor" className="input" {...field("pastorName")} /></div>
            <div><label className="label" htmlFor="times">{t("serviceTimes")}</label><input id="times" className="input" {...field("serviceTimes")} /></div>
            <div className="sm:col-span-2"><label className="label" htmlFor="address">{t("address")}</label><textarea id="address" className="input min-h-16" {...field("address")} /></div>
            <div><label className="label" htmlFor="ytName">{t("youtubeName")}</label><input id="ytName" className="input" {...field("youtubeName")} /></div>
            <div><label className="label" htmlFor="ytUrl">{t("youtubeUrl")}</label><input id="ytUrl" className="input" placeholder="https://www.youtube.com/@…" {...field("youtubeUrl")} /></div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="label mb-0">{t("screenPreview")}</span>
              <div className="flex overflow-hidden rounded-lg border border-stone-200 text-xs">
                {(["welcome", "ended"] as const).map((v) => (
                  <button key={v} onClick={() => setPreview(v)} className={`px-2.5 py-1 ${preview === v ? "bg-gold-100 font-semibold text-gold-900" : "text-stone-600"}`}>
                    {v === "welcome" ? t("previewBefore") : t("previewAfter")}
                  </button>
                ))}
              </div>
            </div>
            <div className="aspect-video overflow-hidden rounded-lg shadow-lg ring-1 ring-stone-300" data-testid="settings-preview">
              <Stage state={previewState} cameraStream={null} renderMedia={() => null} />
            </div>
          </div>
        </div>
      </section>

      <section className="card grid gap-4 p-5 md:grid-cols-2">
        <div><label className="label" htmlFor="speaker">{t("defaultSpeaker")}</label><input id="speaker" className="input" {...field("defaultSpeaker")} /></div>
        <div>
          <label className="label" htmlFor="lang">{t("uiLanguage")}</label>
          <select id="lang" className="input" {...field("uiLanguage")}><option value="en">English</option><option value="te">తెలుగు</option></select>
        </div>
        <div>
          <label className="label" htmlFor="p">{t("translations")} · {t("primary")}</label>
          <select id="p" className="input" {...field("defaultPrimaryTranslation")}>{TRANSLATIONS.map((x) => <option key={x.id} value={x.id}>{x.abbr} — {x.nativeName}</option>)}</select>
        </div>
        <div>
          <label className="label" htmlFor="sec">{t("secondary")}</label>
          <select id="sec" className="input" {...field("defaultSecondaryTranslation")}><option value="">{t("none")}</option>{TRANSLATIONS.map((x) => <option key={x.id} value={x.id}>{x.abbr} — {x.nativeName}</option>)}</select>
        </div>
      </section>

      <div className="sticky bottom-4 z-10 flex justify-end">
        <button className="btn-primary px-6 shadow-lg" onClick={save} data-testid="settings-save">{saved ? <Check className="h-4 w-4" /> : null}{saved ? t("saved") : t("save")}</button>
      </div>

      <section className="card p-5">
        <h2 className="mb-1 font-semibold">{t("offlineBibles")}</h2>
        <p className="mb-4 text-sm text-stone-500">Download Bibles to this computer so the service never depends on the internet.</p>
        <div className="divide-y divide-stone-100">
          {TRANSLATIONS.map((tr) => <OfflineRow key={tr.id} id={tr.id} label={`${tr.abbr} — ${tr.nativeName}`} license={[tr.license, tr.attribution].filter(Boolean).join(" · ")} />)}
        </div>
      </section>
    </div>
  );
}

function OfflineRow({ id, label, license }: { id: string; label: string; license: string }) {
  const t = useT();
  const [pct, setPct] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { offlineStatus([id], ALL_BOOKS).then(setPct); }, [id]);
  const download = async () => {
    setBusy(true);
    await prepareOffline([id], ALL_BOOKS, (d, n) => setPct(d / n));
    setBusy(false);
  };
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="flex-1">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-stone-500">{license}</div>
      </div>
      {pct === 1 ? (
        <span className="flex items-center gap-1 text-sm text-emerald-700"><Check className="h-4 w-4" />{t("offlineReady")}</span>
      ) : (
        <button className="btn-secondary" onClick={download} disabled={busy}>
          <Download className="h-4 w-4" />{busy && pct !== null ? `${Math.round(pct * 100)}%` : t("downloadOffline")}
        </button>
      )}
    </div>
  );
}
