"use client";

import { useEffect, useRef, useState } from "react";
import { db } from "@/lib/db";
import type { MediaStatus, Scene } from "./protocol";

type MediaScene = Extract<Scene, { kind: "media" }>;
export type MediaCommand = { action: "play" | "pause" | "restart"; nonce: string; seq: number };

interface Props {
  scene: MediaScene;
  command: MediaCommand | null;
  onStatus: (s: MediaStatus) => void;
}

/** Full-screen media on the display: local files (offline) or YouTube (online). */
export function MediaPlayer(props: Props) {
  if (props.scene.source === "youtube") return <YouTubePlayer {...props} />;
  return <FilePlayer {...props} />;
}

function useObjectUrl(fileId?: string) {
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    if (!fileId) return;
    let u = "";
    db.mediaFiles.get(fileId).then((f) => {
      if (!f) { setMissing(true); return; }
      u = URL.createObjectURL(f.blob);
      setUrl(u);
    });
    return () => { if (u) URL.revokeObjectURL(u); };
  }, [fileId]);
  return { url, missing };
}

function FilePlayer({ scene, command, onStatus }: Props) {
  const { url, missing } = useObjectUrl(scene.fileId);
  const ref = useRef<HTMLVideoElement>(null);
  const start = scene.startSec ?? 0;

  useEffect(() => {
    const v = ref.current;
    if (!v || !command || command.nonce !== scene.nonce) return;
    if (command.action === "pause") v.pause();
    if (command.action === "play") void v.play();
    if (command.action === "restart") { v.currentTime = start; void v.play(); }
  }, [command, scene.nonce, start]);

  if (missing) return <Centered>Media file missing on this computer</Centered>;
  if (!url) return null;
  if (scene.mediaKind === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="absolute inset-0 h-full w-full object-contain" />;
  }
  const report = (ended = false) => {
    const v = ref.current;
    if (!v) return;
    onStatus({ nonce: scene.nonce, currentTime: v.currentTime, duration: scene.endSec ?? v.duration, paused: v.paused, ended: ended || v.ended });
  };
  return (
    <video
      ref={ref}
      src={url}
      autoPlay
      playsInline
      className="absolute inset-0 h-full w-full bg-black object-contain"
      onLoadedMetadata={(e) => { if (start) e.currentTarget.currentTime = start; }}
      onTimeUpdate={(e) => {
        if (scene.endSec && e.currentTarget.currentTime >= scene.endSec) { e.currentTarget.pause(); report(true); return; }
        report();
      }}
      onPause={() => report()}
      onPlay={() => report()}
      onEnded={() => report(true)}
    />
  );
}

/**
 * YouTube via the IFrame embed + postMessage (no external script).
 * Needs internet; ads/branding are controlled by YouTube.
 */
function YouTubePlayer({ scene, command, onStatus }: Props) {
  const ref = useRef<HTMLIFrameElement>(null);
  const params = new URLSearchParams({ autoplay: "1", controls: "0", rel: "0", modestbranding: "1", enablejsapi: "1", playsinline: "1", iv_load_policy: "3" });
  if (scene.startSec) params.set("start", String(Math.floor(scene.startSec)));
  if (scene.endSec) params.set("end", String(Math.floor(scene.endSec)));
  const src = `https://www.youtube-nocookie.com/embed/${scene.youtubeId}?${params}`;

  const post = (func: string, args: unknown[] = []) =>
    ref.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "*");

  useEffect(() => {
    if (!command || command.nonce !== scene.nonce) return;
    if (command.action === "pause") post("pauseVideo");
    if (command.action === "play") post("playVideo");
    if (command.action === "restart") { post("seekTo", [scene.startSec ?? 0, true]); post("playVideo"); }
  }, [command, scene.nonce, scene.startSec]);

  useEffect(() => {
    let last = { t: 0, d: 0, state: -1 };
    const onMsg = (e: MessageEvent) => {
      if (typeof e.data !== "string" || !e.origin.includes("youtube")) return;
      try {
        const msg = JSON.parse(e.data);
        const info = msg.info ?? {};
        if (typeof info.currentTime === "number") last.t = info.currentTime;
        if (typeof info.duration === "number") last.d = info.duration;
        if (typeof info.playerState === "number") last.state = info.playerState;
        onStatus({ nonce: scene.nonce, currentTime: last.t, duration: scene.endSec ?? last.d, paused: last.state !== 1, ended: last.state === 0 });
      } catch { /* not a player message */ }
    };
    window.addEventListener("message", onMsg);
    return () => { window.removeEventListener("message", onMsg); last = { t: 0, d: 0, state: -1 }; };
  }, [scene.nonce, scene.endSec, onStatus]);

  return (
    <iframe
      ref={ref}
      key={scene.nonce}
      src={src}
      title={scene.title}
      allow="autoplay; encrypted-media; fullscreen"
      className="absolute inset-0 h-full w-full border-0 bg-black"
      onLoad={() => ref.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: scene.nonce, channel: "widget" }), "*")}
    />
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="absolute inset-0 flex items-center justify-center text-[3cqh] text-white/60">{children}</div>;
}
