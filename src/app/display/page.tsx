"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Stage } from "@/modules/presenter/Stage";
import { MediaPlayer, type MediaCommand } from "@/modules/presenter/MediaPlayer";
import { INITIAL_STATE, type DisplayState, type MediaStatus } from "@/modules/presenter/protocol";
import { createTransport, type PresenterTransport } from "@/modules/presenter/transport";
import { useCameraStream } from "@/modules/presenter/useCamera";
import { churchInfo } from "@/modules/presenter/useController";
import { useChurch } from "@/lib/church/useChurch";

const STORE_KEY = "display:last-state";

/**
 * The congregation screen. Opened by the console in its own window and moved
 * to the projector/TV. It only renders what the controller tells it, and
 * re-asks for state whenever it (re)loads — so closing or reloading it is safe.
 */
export default function DisplayPage() {
  const [state, setState] = useState<DisplayState | null>(null);
  const [command, setCommand] = useState<MediaCommand | null>(null);
  const [started, setStarted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [idle, setIdle] = useState(false);
  const transport = useRef<PresenterTransport | null>(null);

  // Restore last frame immediately after a reload, before the console answers.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- must run after hydration (sessionStorage is client-only)
      if (raw) setState(JSON.parse(raw));
    } catch { /* storage unavailable */ }
  }, []);

  useEffect(() => {
    const tr = createTransport();
    transport.current = tr;
    const screenId = Math.random().toString(36).slice(2);
    let seq = 0;
    const off = tr.subscribe((msg) => {
      if (msg.type === "state") {
        setState(msg.state);
        try { sessionStorage.setItem(STORE_KEY, JSON.stringify(msg.state)); } catch { /* ignore */ }
      } else if (msg.type === "media") {
        setCommand({ action: msg.action, nonce: msg.nonce, seq: ++seq });
      }
    });
    tr.send({ type: "hello" });
    const ping = setInterval(() => tr.send({ type: "ping", screenId, fullscreen: !!document.fullscreenElement }), 1500);
    return () => { off(); clearInterval(ping); tr.close(); };
  }, []);

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    const onKey = (e: KeyboardEvent) => { if (e.key === "f" || e.key === "F") toggleFullscreen(); };
    window.addEventListener("keydown", onKey);
    let timer: ReturnType<typeof setTimeout>;
    const onMove = () => { setIdle(false); clearTimeout(timer); timer = setTimeout(() => setIdle(true), 2500); };
    window.addEventListener("mousemove", onMove);
    onMove();
    return () => { document.removeEventListener("fullscreenchange", onFs); window.removeEventListener("keydown", onKey); window.removeEventListener("mousemove", onMove); clearTimeout(timer); };
  }, []);

  const church = useChurch();
  // Before the console connects, show the welcome board with the saved church profile.
  const s = state ?? { ...INITIAL_STATE, scene: { kind: "welcome" as const }, church: churchInfo(church), translations: { primary: church.defaultPrimaryTranslation, secondary: church.defaultSecondaryTranslation } };
  const needCamera = s.cameraOn || s.scene.kind === "camera";
  const { stream } = useCameraStream(started && needCamera, s.cameraDeviceId);

  const onStatus = useCallback((status: MediaStatus) => transport.current?.send({ type: "media-status", status }), []);

  const start = async () => {
    setStarted(true);
    await toggleFullscreen(true);
  };

  return (
    <div className={`fixed inset-0 bg-black ${idle && started ? "cursor-none" : ""}`} onDoubleClick={() => toggleFullscreen()}>
      <Stage state={s} cameraStream={stream} renderMedia={(scene) => started && <MediaPlayer key={scene.nonce} scene={scene} command={command} onStatus={onStatus} />} />
      {!state && <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white/40">Waiting for the console…</div>}
      {!started && (
        <button onClick={start} className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 text-white" data-testid="start-screen">
          <span className="rounded-2xl border border-white/30 px-8 py-5 text-2xl font-semibold">Click to start the screen</span>
          <span className="max-w-md text-center text-sm text-white/60">
            Move this window to the projector / TV first. Clicking enables full screen, video sound and the camera. Press F or double-click to toggle full screen.
          </span>
        </button>
      )}
      {started && !fullscreen && !idle && (
        <div className="absolute right-3 top-3 rounded bg-white/10 px-2 py-1 text-xs text-white/70">Press F for full screen</div>
      )}
    </div>
  );
}

async function toggleFullscreen(force?: boolean) {
  try {
    if (force || !document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  } catch { /* user gesture required or not allowed — window still works */ }
}
