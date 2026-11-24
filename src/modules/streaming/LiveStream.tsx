"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, Mic, MicOff, Plug, Radio, Square, Users, Video } from "lucide-react";
import { db, getSettings } from "@/lib/db";
import type { Sermon } from "@/modules/sermons/types";
import { buildChapters } from "./chapters";
import { broadcastDescription, broadcastTitle } from "./description";
import type { Obs } from "./useObs";
import { explain, youtube, type BroadcastStatus, type YouTubeStatus } from "./youtubeClient";

export type LivePhase = "idle" | "starting" | "live" | "ending" | "ended";

/**
 * "Go live" / "End stream" across YouTube (broadcast) and OBS (the encoder).
 * Works without OBS control too: the operator starts streaming in OBS by hand.
 */
export function useLiveStream(sermon: Sermon, getEvents: () => { t: number; kind: string; label: string }[], obs: Obs) {
  const [yt, setYt] = useState<YouTubeStatus | null>(null);
  const [status, setStatus] = useState<BroadcastStatus | null>(null);
  const [phase, setPhase] = useState<LivePhase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const broadcastId = sermon.youtube?.broadcastId ?? null;
  const cancel = useRef(false);

  useEffect(() => { youtube.status().then(setYt).catch(() => setYt({ configured: false, connected: false, channel: null })); }, []);

  const refresh = useCallback(async (id: string) => {
    try {
      const s = await youtube.broadcast(id);
      setStatus(s);
      return s;
    } catch (e) {
      setError(explain(e));
      return null;
    }
  }, []);

  // Poll broadcast state (faster while starting).
  useEffect(() => {
    if (!broadcastId || !yt?.connected) return;
    const first = setTimeout(() => { void refresh(broadcastId); }, 0);
    const id = setInterval(() => { void refresh(broadcastId); }, phase === "starting" ? 3000 : 10000);
    return () => { clearTimeout(first); clearInterval(id); };
  }, [broadcastId, yt?.connected, phase, refresh]);

  const ytLive = status?.lifeCycleStatus === "live" || status?.lifeCycleStatus === "liveStarting";
  const isLive = ytLive || obs.stream.active;

  const goLive = useCallback(async () => {
    setError(null);
    cancel.current = false;
    setPhase("starting");
    try {
      // 1. Broadcast (create now if it wasn't scheduled in the planner).
      let id = broadcastId;
      const church = await getSettings();
      if (!id) {
        setMessage("Creating the YouTube broadcast…");
        const b = await youtube.createBroadcast({
          title: broadcastTitle(sermon, church),
          description: broadcastDescription(sermon, church),
          scheduledStart: new Date().toISOString(),
          privacy: church.streamPrivacy,
          autoStart: church.streamAutoStart,
        });
        await db.sermons.update(sermon.id, { youtube: { broadcastId: b.id, url: b.url, studioUrl: b.studioUrl, privacy: b.privacy, scheduledStart: b.scheduledStart } });
        id = b.id;
      }
      // 2. Encoder: load the key into OBS and start streaming (or ask the operator).
      if (obs.status === "connected") {
        setMessage("Starting OBS…");
        const ingest = await youtube.ingest();
        await obs.setYouTubeTarget(ingest.rtmpsServer, ingest.key);
        if (!obs.stream.active) await obs.startStream();
      } else {
        setMessage("Start streaming in OBS now (OBS isn't connected to the console).");
      }
      // 3. Wait for YouTube to receive video, then go live.
      setMessage("Waiting for YouTube to receive video…");
      const deadline = Date.now() + 90_000;
      for (;;) {
        if (cancel.current) { setPhase("idle"); setMessage(null); return; }
        const s = await refresh(id);
        if (s && (s.lifeCycleStatus === "live" || s.lifeCycleStatus === "liveStarting")) break;
        if (s?.streamStatus === "active") {
          setMessage("Going live…");
          await youtube.transition(id, "live");
          await refresh(id);
          break;
        }
        if (Date.now() > deadline) throw new Error("YouTube hasn't received video after 90 seconds. Check OBS is streaming and the internet connection, then press Go live again.");
        await new Promise((r) => setTimeout(r, 3000));
      }
      setPhase("live");
      setMessage(null);
    } catch (e) {
      setPhase("idle");
      setMessage(null);
      setError(explain(e));
    }
  }, [broadcastId, obs, refresh, sermon]);

  const endStream = useCallback(async () => {
    cancel.current = true;
    setError(null);
    setPhase("ending");
    try {
      if (broadcastId && yt?.connected) {
        const s = status ?? (await refresh(broadcastId));
        if (s && s.lifeCycleStatus !== "complete") await youtube.transition(broadcastId, "complete");
        // Chapters from what was shown on screen (needs the actual start time).
        const fresh = await refresh(broadcastId);
        const startIso = fresh?.actualStart ?? s?.actualStart;
        if (startIso) {
          const lines = buildChapters(getEvents(), Date.parse(startIso));
          if (lines.length) await youtube.chapters(broadcastId, lines).catch(() => {});
        }
      }
      if (obs.status === "connected" && obs.stream.active) await obs.stopStream().catch(() => {});
      setPhase("ended");
    } catch (e) {
      setPhase(isLive ? "live" : "idle");
      setError(explain(e));
    }
  }, [broadcastId, yt?.connected, status, refresh, getEvents, obs, isLive]);

  return { yt, status, phase, message, error, isLive, ytLive, goLive, endStream, cancelStart: () => { cancel.current = true; } };
}

export type LiveStream = ReturnType<typeof useLiveStream>;

const STATE_LABEL: Record<string, string> = {
  created: "Scheduled", ready: "Ready", testing: "Testing", liveStarting: "Starting", live: "LIVE", complete: "Ended", revoked: "Removed",
};

/** Console panel: one place for YouTube + OBS during the service. */
export function StreamPanel({ live, obs, sermon }: { live: LiveStream; obs: Obs; sermon: Sermon }) {
  const s = live.status;
  const signal = s?.streamStatus === "active" ? `Receiving video · ${s.health}` : s ? "No video yet" : "—";
  const pill = live.isLive
    ? <span className="flex items-center gap-1 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />LIVE</span>
    : <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300">{live.phase === "ended" ? "ENDED" : "OFFLINE"}</span>;

  return (
    <section className="shrink-0 rounded-xl border border-slate-800 bg-slate-900" data-testid="stream-panel">
      <div className="flex items-center gap-2 border-b border-slate-800 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        <Radio className="h-4 w-4 text-red-500" />Live stream<span className="ml-auto normal-case tracking-normal">{pill}</span>
      </div>
      <div className="space-y-3 p-3 text-sm">
        {/* YouTube */}
        {!live.yt ? <Loader2 className="h-4 w-4 animate-spin text-slate-500" /> : !live.yt.connected ? (
          <p className="text-slate-400">YouTube not connected — <Link className="text-gold-300 underline" href="/settings">connect in Settings</Link>. You can still stream from OBS by hand.</p>
        ) : (
          <div className="space-y-1.5" data-testid="stream-youtube">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-slate-300">{live.yt.channel?.title}</span>
              {sermon.youtube && <a className="flex items-center gap-1 text-xs text-gold-300 underline" href={sermon.youtube.url} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3" />Watch</a>}
            </div>
            {!sermon.youtube ? (
              <p className="text-xs text-slate-500">No broadcast yet — “Go live” creates one from this sermon.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 text-xs">
                <Stat label="YouTube" value={s ? STATE_LABEL[s.lifeCycleStatus] ?? s.lifeCycleStatus : "…"} hot={live.ytLive} />
                <Stat label="Signal" value={signal} warn={!!s && s.streamStatus === "active" && s.health === "bad"} />
                <Stat label="Viewers" value={s?.viewers != null ? String(s.viewers) : "—"} icon={<Users className="h-3 w-3" />} />
              </div>
            )}
          </div>
        )}

        {/* OBS */}
        <div className="space-y-2 border-t border-slate-800 pt-3" data-testid="stream-obs">
          <div className="flex items-center gap-2 text-xs">
            <span className={`h-2 w-2 rounded-full ${obs.status === "connected" ? "bg-emerald-500" : obs.status === "connecting" ? "bg-amber-400" : "bg-slate-600"}`} />
            <span className="text-slate-300">OBS</span>
            {obs.status === "connected" ? (
              <span className="text-slate-500">{obs.stream.active ? `streaming · ${obs.stream.kbps} kbps · ${obs.stream.droppedPct.toFixed(1)}% dropped` : "ready"}</span>
            ) : (
              <button className="ml-auto flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-slate-200 hover:bg-slate-700" onClick={() => obs.connect()} data-testid="obs-connect">
                <Plug className="h-3 w-3" />{obs.status === "connecting" ? "Connecting…" : "Connect OBS"}
              </button>
            )}
          </div>
          {obs.status === "error" && <p className="text-xs text-red-400">{obs.error}</p>}
          {obs.status === "connected" && obs.scenes.length > 0 && (
            <div className="flex flex-wrap gap-1" role="group" aria-label="OBS scenes">
              {obs.scenes.map((sc) => (
                <button key={sc} onClick={() => obs.setScene(sc)} data-testid="obs-scene"
                  className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${sc === obs.currentScene ? "bg-red-600 font-semibold text-white" : "bg-slate-800 text-slate-200 hover:bg-slate-700"}`}>
                  <Video className="h-3 w-3" />{sc}
                </button>
              ))}
            </div>
          )}
          {obs.status === "connected" && obs.audio.length > 0 && (
            <div className="space-y-1" aria-label="Microphones">
              {obs.audio.map((a) => (
                <div key={a.name} className="flex items-center gap-2" data-testid="obs-audio">
                  <button onClick={() => obs.toggleMute(a.name)} className={`rounded p-1 ${a.muted ? "bg-red-900/60 text-red-300" : "bg-slate-800 text-slate-200"}`} aria-label={`${a.muted ? "Unmute" : "Mute"} ${a.name}`}>
                    {a.muted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                  </button>
                  <span className="w-28 truncate text-xs text-slate-300">{a.name}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                    <div className={`h-full rounded-full transition-[width] duration-100 ${a.muted ? "bg-slate-600" : (obs.levels[a.name] ?? 0) > 0.9 ? "bg-red-500" : (obs.levels[a.name] ?? 0) > 0.7 ? "bg-amber-400" : "bg-emerald-500"}`}
                      style={{ width: `${Math.round((obs.levels[a.name] ?? 0) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 border-t border-slate-800 pt-3">
          {live.isLive || live.phase === "ending" ? (
            <button className="btn flex-1 border border-red-700 text-red-300 hover:bg-red-950" onClick={() => confirm("End the live stream?") && live.endStream()} disabled={live.phase === "ending"} data-testid="end-stream">
              {live.phase === "ending" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}End stream
            </button>
          ) : (
            <button className="btn flex-1 bg-red-600 font-semibold text-white hover:bg-red-500" onClick={live.goLive} disabled={live.phase === "starting"} data-testid="go-live">
              {live.phase === "starting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}{live.phase === "starting" ? "Starting…" : "Go live"}
            </button>
          )}
          {live.phase === "starting" && <button className="btn text-slate-400 hover:bg-slate-800" onClick={live.cancelStart}>Cancel</button>}
        </div>
        {live.message && <p className="text-xs text-slate-300" role="status">{live.message}</p>}
        {live.error && <p className="text-xs text-red-400" role="alert">{live.error}</p>}
      </div>
    </section>
  );
}

function Stat({ label, value, hot, warn, icon }: { label: string; value: string; hot?: boolean; warn?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="rounded-md bg-slate-800/70 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`flex items-center gap-1 truncate font-semibold ${hot ? "text-red-400" : warn ? "text-amber-300" : "text-slate-100"}`}>{icon}{value}</div>
    </div>
  );
}
