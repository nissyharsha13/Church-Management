"use client";

import { useEffect, useState } from "react";
import { Check, Download } from "lucide-react";
import { db, DEFAULT_SETTINGS, getSettings, type ChurchSettings } from "@/lib/db";
import { useT } from "@/lib/i18n";
import { BOOKS } from "@/lib/bible/canon";
import { offlineStatus, prepareOffline } from "@/lib/bible/loader";
import { TRANSLATIONS } from "@/lib/bible/translations";

const ALL_BOOKS = BOOKS.map((b) => b.id);

export default function SettingsPage() {
  const t = useT();
  const [s, setS] = useState<ChurchSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  useEffect(() => { getSettings().then(setS); }, []);

  const save = async () => {
    await db.churches.put(s);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };
  const field = (k: keyof ChurchSettings) => ({ value: s[k] as string, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setS({ ...s, [k]: e.target.value }) });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("settings")}</h1>
      <section className="card grid gap-4 p-5 md:grid-cols-2">
        <div><label className="label" htmlFor="name">{t("churchName")}</label><input id="name" className="input" {...field("name")} /></div>
        <div><label className="label" htmlFor="tagline">{t("tagline")}</label><input id="tagline" className="input" {...field("tagline")} /></div>
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
        <div className="md:col-span-2"><button className="btn-primary" onClick={save}>{saved ? <Check className="h-4 w-4" /> : null}{t("save")}</button></div>
      </section>

      <section className="card p-5">
        <h2 className="mb-1 font-semibold">{t("offlineBibles")}</h2>
        <p className="mb-4 text-sm text-slate-500">Download Bibles to this computer so the service never depends on the internet.</p>
        <div className="divide-y divide-slate-100">
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
        <div className="text-xs text-slate-500">{license}</div>
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
