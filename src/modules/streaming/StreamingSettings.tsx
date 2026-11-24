"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Eye, EyeOff, Link2, Loader2, LogOut, Plug, Radio, Send } from "lucide-react";
import { db, getSettings, type ChurchSettings } from "@/lib/db";
import { useT } from "@/lib/i18n";
import { explain, youtube, type Ingest, type YouTubeStatus } from "./youtubeClient";
import { loadObsConnection, saveObsConnection, useObs, type ObsConnection } from "./useObs";

/** Settings → Live streaming: YouTube channel connection + OBS on this computer. */
export function StreamingSettings() {
  return (
    <section className="card p-5" data-testid="streaming-settings">
      <h2 className="mb-1 flex items-center gap-2 font-semibold"><Radio className="h-4 w-4 text-red-600" />Live streaming</h2>
      <p className="mb-4 text-sm text-stone-500">
        OBS on the church computer sends the video; this app creates the YouTube broadcast, loads the stream key into OBS and lets the console go live.
        Setup guide: <span className="font-medium">docs/STREAMING-SETUP.md</span>.
      </p>
      <div className="grid gap-5 lg:grid-cols-2">
        <YouTubeCard />
        <ObsCard />
      </div>
    </section>
  );
}

function YouTubeCard() {
  const t = useT();
  const [st, setSt] = useState<YouTubeStatus | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [settings, setSettings] = useState<ChurchSettings | null>(null);
  const [ingest, setIngest] = useState<Ingest | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Result of the Google sign-in redirect (read once, then clean the URL).
    const q = new URLSearchParams(window.location.search);
    const r = q.get("youtube");
    const reason = q.get("reason");
    const n = r === "connected" ? { ok: true, text: "YouTube channel connected." }
      : r === "not_configured" ? { ok: false, text: "The server isn't set up for YouTube yet (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)." }
      : r === "error" ? { ok: false, text: `Couldn't connect YouTube (${reason ?? "unknown"}).${reason === "access_denied" ? " Sign-in was cancelled." : ""}` }
      : null;
    if (r) window.history.replaceState(null, "", window.location.pathname);
    youtube.status().then(async (s) => {
      const cur = await getSettings();
      // Fill the channel link/name used for the QR code on the welcome screen.
      if (s.connected && s.channel && !cur.youtubeUrl) {
        const next = { ...cur, youtubeUrl: s.channel.url, youtubeName: cur.youtubeName || s.channel.title };
        await db.churches.put(next);
        setSettings(next);
      } else setSettings(cur);
      setSt(s);
      if (n) setNotice(n);
    }).catch(() => setSt({ configured: false, connected: false, channel: null }));
  }, []);

  const saveDefault = async (patch: Partial<ChurchSettings>) => {
    const next = { ...(await getSettings()), ...patch };
    await db.churches.put(next);
    setSettings(next);
  };
  const loadKey = async () => {
    setBusy(true);
    try { setIngest(await youtube.ingest()); } catch (e) { setNotice({ ok: false, text: explain(e) }); }
    setBusy(false);
  };

  return (
    <div className="rounded-lg border border-stone-200 p-4" data-testid="youtube-card">
      <div className="mb-3 flex items-center gap-2 font-medium"><YouTubeLogo />YouTube channel</div>
      {notice && <p className={`mb-3 rounded-md px-3 py-2 text-sm ${notice.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`} role="status">{notice.text}</p>}
      {!st ? (
        <Loader2 className="h-4 w-4 animate-spin text-stone-400" />
      ) : !st.configured ? (
        <p className="text-sm text-stone-600">Not available yet: the server needs a Google client (one-time setup by the admin — see the setup guide).</p>
      ) : !st.connected ? (
        <div className="space-y-2">
          <p className="text-sm text-stone-600">Sign in with the Google account that owns or manages the church channel.</p>
          {/* Full navigation: Google sign-in happens on Google's page. */}
          <a className="btn-primary" href="/api/youtube/connect" data-testid="youtube-connect"><Link2 className="h-4 w-4" />Connect YouTube</a>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {st.channel?.thumbnail ? <img src={st.channel.thumbnail} alt="" className="h-10 w-10 rounded-full" /> : <YouTubeLogo />}
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold" data-testid="youtube-channel">{st.channel?.title}</div>
              <a href={st.channel?.url} target="_blank" rel="noreferrer" className="truncate text-xs text-gold-700 underline">{st.channel?.url}</a>
            </div>
            <button className="btn-ghost" onClick={async () => { await youtube.disconnect(); setSt({ ...st, connected: false, channel: null }); setIngest(null); }}>
              <LogOut className="h-4 w-4" />Disconnect
            </button>
          </div>
          {settings && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="label">New broadcasts are</span>
                <select className="input" value={settings.streamPrivacy} onChange={(e) => saveDefault({ streamPrivacy: e.target.value as ChurchSettings["streamPrivacy"] })}>
                  <option value="public">Public</option>
                  <option value="unlisted">Unlisted (link only)</option>
                  <option value="private">Private</option>
                </select>
              </label>
              <label className="flex items-start gap-2 pt-5 text-sm text-stone-700">
                <input type="checkbox" className="mt-1" checked={settings.streamAutoStart} onChange={(e) => saveDefault({ streamAutoStart: e.target.checked })} />
                <span>Go live automatically when YouTube receives video<br /><span className="text-xs text-stone-500">Off = press “Go live” in the console</span></span>
              </label>
            </div>
          )}
          <div className="rounded-md bg-stone-50 p-3 text-sm">
            <div className="mb-1 font-medium">Permanent stream key (for OBS)</div>
            {!ingest ? (
              <button className="btn-secondary" onClick={loadKey} disabled={busy} data-testid="youtube-key">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}Show server & key</button>
            ) : (
              <div className="space-y-1.5">
                <CopyRow label="Server" value={ingest.rtmpsServer} />
                <CopyRow label="Key" value={ingest.key} secret={!showKey} onToggle={() => setShowKey(!showKey)} />
                <p className="text-xs text-stone-500">The same key works every week. Keep it private — anyone with it can stream to your channel.</p>
              </div>
            )}
          </div>
          <p className="text-xs text-stone-500">{t("autoSaveHint")}</p>
        </div>
      )}
    </div>
  );
}

function ObsCard() {
  const [conn, setConn] = useState<ObsConnection>({ url: "ws://127.0.0.1:4455", password: "" });
  const obs = useObs();
  const [sent, setSent] = useState<string | null>(null);
  useEffect(() => { const id = setTimeout(() => setConn(loadObsConnection()), 0); return () => clearTimeout(id); }, []);

  const test = async () => {
    saveObsConnection(conn);
    await obs.connect(conn);
  };
  const sendKey = async () => {
    setSent(null);
    try {
      const i = await youtube.ingest();
      const changed = await obs.setYouTubeTarget(i.rtmpsServer, i.key);
      setSent(changed ? "YouTube key loaded into OBS." : "OBS already has the YouTube key.");
    } catch (e) { setSent(explain(e)); }
  };

  return (
    <div className="rounded-lg border border-stone-200 p-4" data-testid="obs-card">
      <div className="mb-3 flex items-center gap-2 font-medium"><Plug className="h-4 w-4" />OBS on this computer</div>
      <p className="mb-3 text-xs text-stone-500">In OBS: Tools → WebSocket Server Settings → Enable, then copy the password here. Saved on this computer only.</p>
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input className="input" value={conn.url} onChange={(e) => setConn({ ...conn, url: e.target.value })} aria-label="OBS address" />
        <input className="input" type="password" placeholder="Password" value={conn.password} onChange={(e) => setConn({ ...conn, password: e.target.value })} aria-label="OBS password" />
        <button className="btn-primary" onClick={test} disabled={obs.status === "connecting"} data-testid="obs-test">
          {obs.status === "connecting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}Save & test
        </button>
      </div>
      <div className="mt-3 text-sm" role="status" data-testid="obs-status">
        {obs.status === "connected" && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-emerald-700"><Check className="h-4 w-4" />Connected — {obs.scenes.length} scenes, {obs.audio.length} audio inputs</div>
            <div className="flex flex-wrap gap-1">{obs.scenes.map((s) => <span key={s} className="rounded bg-stone-100 px-1.5 py-0.5 text-xs">{s}</span>)}</div>
            <button className="btn-secondary" onClick={sendKey} data-testid="obs-send-key"><Send className="h-4 w-4" />Send YouTube key to OBS</button>
            {sent && <p className="text-xs text-stone-600">{sent}</p>}
          </div>
        )}
        {obs.status === "error" && <p className="text-red-600">{obs.error}</p>}
      </div>
    </div>
  );
}

function CopyRow({ label, value, secret, onToggle }: { label: string; value: string; secret?: boolean; onToggle?: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-xs text-stone-500">{label}</span>
      <code className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1 text-xs ring-1 ring-stone-200" data-testid={`ingest-${label.toLowerCase()}`}>{secret ? "•".repeat(Math.min(24, value.length)) : value}</code>
      {onToggle && <button className="btn-ghost px-1.5" onClick={onToggle} aria-label={secret ? "Show" : "Hide"}>{secret ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</button>}
      <button className="btn-ghost px-1.5" aria-label={`Copy ${label}`} onClick={async () => { await navigator.clipboard.writeText(value).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1200); }}>
        {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function YouTubeLogo({ className = "h-4 w-auto" }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 20" className={className} aria-hidden>
      <rect width="28" height="20" rx="5" fill="#FF0000" />
      <path d="M11 5.5v9l8-4.5z" fill="#fff" />
    </svg>
  );
}
