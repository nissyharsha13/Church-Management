"use client";

import { useEffect, useState } from "react";

/** Acquire a camera stream for a device (null = default camera). Stops when disabled/unmounted. */
export function useCameraStream(enabled: boolean, deviceId: string | null) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled || typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return;
    let alive = true;
    let s: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ video: deviceId ? { deviceId: { exact: deviceId }, width: 1920, height: 1080 } : { width: 1920, height: 1080 }, audio: false })
      .then((st) => {
        if (!alive) { st.getTracks().forEach((t) => t.stop()); return; }
        s = st;
        setStream(st);
        setError(null);
      })
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
      s?.getTracks().forEach((t) => t.stop());
      setStream(null);
    };
  }, [enabled, deviceId]);
  return { stream: enabled ? stream : null, error };
}

export async function listCameras(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  return (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
}
