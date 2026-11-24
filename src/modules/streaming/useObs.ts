"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type OBSWebSocketType from "obs-websocket-js/json";

/**
 * Remote control for OBS Studio (obs-websocket v5, built into OBS 28+).
 * OBS stays the video engine (cameras, mics, encoding, sending to YouTube);
 * the console drives it. Connection details are per computer (localStorage).
 */
export interface ObsConnection {
  url: string;
  password: string;
}
export type ObsStatus = "disconnected" | "connecting" | "connected" | "error";
export interface ObsStream {
  active: boolean;
  kbps: number;
  droppedPct: number;
  congestion: number;
  durationMs: number;
}
export interface ObsAudio {
  name: string;
  muted: boolean;
}

const KEY = "obs:connection";
export const DEFAULT_OBS: ObsConnection = { url: "ws://127.0.0.1:4455", password: "" };

export function loadObsConnection(): ObsConnection {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_OBS, ...JSON.parse(raw) } : DEFAULT_OBS;
  } catch {
    return DEFAULT_OBS;
  }
}
export function saveObsConnection(c: ObsConnection) {
  try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* storage blocked */ }
}

/** Peak (0..1 linear) -> meter position (0..1) over a -60..0 dB scale. */
export function meterLevel(peak: number): number {
  if (!(peak > 0)) return 0;
  return Math.max(0, Math.min(1, (20 * Math.log10(peak) + 60) / 60));
}

export function useObs({ autoConnect = false }: { autoConnect?: boolean } = {}) {
  const [status, setStatus] = useState<ObsStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [scenes, setScenes] = useState<string[]>([]);
  const [currentScene, setCurrentScene] = useState<string | null>(null);
  const [audio, setAudio] = useState<ObsAudio[]>([]);
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [stream, setStream] = useState<ObsStream>({ active: false, kbps: 0, droppedPct: 0, congestion: 0, durationMs: 0 });

  const obs = useRef<OBSWebSocketType | null>(null);
  const wanted = useRef(false);
  const levelBuf = useRef<Record<string, number>>({});
  const lastBytes = useRef<{ bytes: number; at: number } | null>(null);
  /** Latest connect(), for the auto-reconnect timer. */
  const reconnectRef = useRef<((c: ObsConnection) => void) | null>(null);

  const refreshAudio = useCallback(async () => {
    const o = obs.current;
    if (!o) return;
    const { inputs } = await o.call("GetInputList");
    const names = inputs.map((i) => String(i.inputName));
    // An input has audio if OBS can report its mute state.
    const results = await Promise.allSettled(names.map((n) => o.call("GetInputMute", { inputName: n })));
    setAudio(names.flatMap((name, i) => {
      const r = results[i];
      return r.status === "fulfilled" ? [{ name, muted: r.value.inputMuted }] : [];
    }));
  }, []);

  const refreshScenes = useCallback(async () => {
    const o = obs.current;
    if (!o) return;
    const r = await o.call("GetSceneList");
    // OBS lists scenes bottom-to-top; show them in the order the user sees in OBS.
    setScenes(r.scenes.map((s) => String(s.sceneName)).reverse());
    setCurrentScene(r.currentProgramSceneName ?? null);
  }, []);

  const disconnect = useCallback(async () => {
    wanted.current = false;
    const o = obs.current;
    obs.current = null;
    await o?.disconnect().catch(() => {});
    setStatus("disconnected");
  }, []);

  const connect = useCallback(async (conn?: ObsConnection) => {
    const c = conn ?? loadObsConnection();
    wanted.current = true;
    setStatus("connecting");
    setError(null);
    try {
      const { default: OBSWebSocket, EventSubscription } = await import("obs-websocket-js/json");
      await obs.current?.disconnect().catch(() => {});
      const o = new OBSWebSocket();
      obs.current = o;
      o.on("ConnectionClosed", () => {
        if (obs.current !== o) return;
        obs.current = null;
        setStatus(wanted.current ? "error" : "disconnected");
        if (wanted.current) {
          setError("Lost connection to OBS — retrying…");
          setTimeout(() => { if (wanted.current && !obs.current) reconnectRef.current?.(c); }, 5000);
        }
      });
      o.on("CurrentProgramSceneChanged", (e) => setCurrentScene(e.sceneName));
      o.on("SceneListChanged", () => { void refreshScenes(); });
      o.on("InputMuteStateChanged", (e) => setAudio((a) => a.map((x) => (x.name === e.inputName ? { ...x, muted: e.inputMuted } : x))));
      o.on("InputCreated", () => { void refreshAudio(); });
      o.on("InputRemoved", () => { void refreshAudio(); });
      o.on("InputNameChanged", () => { void refreshAudio(); });
      o.on("StreamStateChanged", (e) => setStream((s) => ({ ...s, active: e.outputActive })));
      o.on("InputVolumeMeters", (e) => {
        for (const input of e.inputs) {
          const channels = (input.inputLevelsMul as number[][] | undefined) ?? [];
          const peak = Math.max(0, ...channels.map((ch) => ch[1] ?? 0));
          levelBuf.current[String(input.inputName)] = meterLevel(peak);
        }
      });
      await o.connect(c.url, c.password || undefined, { eventSubscriptions: EventSubscription.All | EventSubscription.InputVolumeMeters });
      setStatus("connected");
      await Promise.all([refreshScenes(), refreshAudio()]);
    } catch (e) {
      obs.current = null;
      setStatus("error");
      const msg = (e as Error)?.message || String(e);
      setError(/auth/i.test(msg) ? "Wrong OBS password" : `Can't reach OBS at ${c.url}. Is OBS open with WebSocket server enabled?`);
    }
  }, [refreshAudio, refreshScenes]);

  useEffect(() => { reconnectRef.current = (c) => { void connect(c); }; }, [connect]);

  // Meter repaint ~10x/second, and stream stats every 2 s.
  useEffect(() => {
    if (status !== "connected") return;
    const meters = setInterval(() => setLevels({ ...levelBuf.current }), 100);
    const stats = setInterval(async () => {
      const o = obs.current;
      if (!o) return;
      try {
        const s = await o.call("GetStreamStatus");
        const now = Date.now();
        const prev = lastBytes.current;
        const kbps = prev && s.outputActive && s.outputBytes >= prev.bytes ? ((s.outputBytes - prev.bytes) * 8) / (now - prev.at) : 0;
        lastBytes.current = { bytes: s.outputBytes, at: now };
        setStream({
          active: s.outputActive,
          kbps: Math.round(kbps),
          droppedPct: s.outputTotalFrames ? (100 * s.outputSkippedFrames) / s.outputTotalFrames : 0,
          congestion: s.outputCongestion ?? 0,
          durationMs: s.outputDuration ?? 0,
        });
      } catch { /* transient */ }
    }, 2000);
    return () => { clearInterval(meters); clearInterval(stats); };
  }, [status]);

  useEffect(() => {
    if (autoConnect) {
      const id = setTimeout(() => { void connect(); }, 0);
      return () => clearTimeout(id);
    }
  }, [autoConnect, connect]);
  useEffect(() => () => { wanted.current = false; void obs.current?.disconnect().catch(() => {}); }, []);

  const call = useCallback(async <T,>(fn: (o: OBSWebSocketType) => Promise<T>) => {
    if (!obs.current) throw new Error("OBS is not connected");
    return fn(obs.current);
  }, []);

  return {
    status, error, scenes, currentScene, audio, levels, stream,
    connect, disconnect,
    setScene: (sceneName: string) => call((o) => o.call("SetCurrentProgramScene", { sceneName })),
    toggleMute: (inputName: string) => call((o) => o.call("ToggleInputMute", { inputName })),
    startStream: () => call((o) => o.call("StartStream")),
    stopStream: () => call((o) => o.call("StopStream")),
    /** Point OBS at YouTube's permanent stream key (only writes when it changed). */
    setYouTubeTarget: (server: string, key: string) => call(async (o) => {
      const cur = await o.call("GetStreamServiceSettings").catch(() => null);
      const s = cur?.streamServiceSettings as { server?: string; key?: string } | undefined;
      if (cur?.streamServiceType === "rtmp_custom" && s?.server === server && s?.key === key) return false;
      await o.call("SetStreamServiceSettings", { streamServiceType: "rtmp_custom", streamServiceSettings: { server, key } });
      return true;
    }),
  };
}

export type Obs = ReturnType<typeof useObs>;
