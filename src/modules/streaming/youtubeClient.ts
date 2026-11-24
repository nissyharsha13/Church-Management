"use client";

/** Browser-side calls to our /api/youtube routes (all behind the admin login). */
export interface YouTubeStatus {
  configured: boolean;
  connected: boolean;
  channel: { id: string; title: string; thumbnail: string; url: string } | null;
}
export interface BroadcastStatus {
  id: string;
  title: string;
  lifeCycleStatus: string;
  privacy: string;
  scheduledStart: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  autoStart: boolean;
  streamStatus: string;
  health: string;
  viewers: number | null;
}
export interface Ingest {
  streamId: string;
  server: string;
  rtmpsServer: string;
  key: string;
}

export class ApiError extends Error {
  constructor(message: string, public code: string, public status: number) {
    super(message);
  }
}

async function call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(`/api/youtube/${path}`, {
    method: init?.method ?? "GET",
    headers: init?.body ? { "content-type": "application/json" } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.message || data.error || `HTTP ${res.status}`, data.error || "error", res.status);
  return data as T;
}

export const youtube = {
  status: () => call<YouTubeStatus>("status"),
  disconnect: () => call<{ ok: true }>("disconnect", { method: "POST" }),
  ingest: () => call<Ingest>("stream-key", { method: "POST" }),
  createBroadcast: (body: { title: string; description: string; scheduledStart: string; privacy: string; autoStart: boolean }) =>
    call<{ id: string; url: string; studioUrl: string; privacy: "public" | "unlisted" | "private"; scheduledStart: string }>("broadcasts", { method: "POST", body }),
  broadcast: (id: string) => call<BroadcastStatus>(`broadcasts/${encodeURIComponent(id)}`),
  transition: (id: string, to: "live" | "complete") => call<{ ok: true }>(`broadcasts/${encodeURIComponent(id)}/transition`, { method: "POST", body: { to } }),
  chapters: (id: string, lines: string[]) => call<{ ok: true }>(`broadcasts/${encodeURIComponent(id)}/chapters`, { method: "POST", body: { lines } }),
};

/** Human message for the codes our routes return. */
export function explain(e: unknown): string {
  const code = e instanceof ApiError ? e.code : "";
  switch (code) {
    case "not_configured": return "YouTube isn't set up on the server yet (Google client ID/secret). See the setup guide.";
    case "not_connected": return "Connect the church's YouTube channel in Settings first.";
    case "reconnect": return "YouTube sign-in expired — reconnect the channel in Settings.";
    case "live_not_enabled": return "Live streaming isn't enabled on this YouTube channel yet (YouTube Studio → Go live; it can take 24 hours).";
    case "quota": return "YouTube's daily API limit was reached. Try again tomorrow or manage the stream in YouTube Studio.";
    case "no_signal": return (e as Error).message;
    default: return (e as Error)?.message || "Something went wrong talking to YouTube.";
  }
}
