"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, Radio, Unlink } from "lucide-react";
import { getSettings } from "@/lib/db";
import type { Sermon, StreamPrivacy } from "@/modules/sermons/types";
import { broadcastDescription, broadcastTitle, scheduledStartFor } from "./description";
import { explain, youtube, type YouTubeStatus } from "./youtubeClient";
import { YouTubeLogo } from "./StreamingSettings";

/** Sermon editor: schedule this sermon's YouTube live broadcast. */
export function SermonStreamCard({ sermon, update }: { sermon: Sermon; update: (fn: (s: Sermon) => Sermon) => void }) {
  const [st, setSt] = useState<YouTubeStatus | null>(null);
  const [privacy, setPrivacy] = useState<StreamPrivacy>("public");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    youtube.status().then(setSt).catch(() => setSt({ configured: false, connected: false, channel: null }));
    getSettings().then((s) => setPrivacy(s.streamPrivacy));
  }, []);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const church = await getSettings();
      const b = await youtube.createBroadcast({
        title: broadcastTitle(sermon, church),
        description: broadcastDescription(sermon, church),
        scheduledStart: scheduledStartFor(sermon, church),
        privacy,
        autoStart: church.streamAutoStart,
      });
      update((s) => ({ ...s, youtube: { broadcastId: b.id, url: b.url, studioUrl: b.studioUrl, privacy: b.privacy, scheduledStart: b.scheduledStart } }));
    } catch (e) {
      setError(explain(e));
    }
    setBusy(false);
  };

  return (
    <section className="card p-5" data-testid="sermon-stream">
      <h2 className="mb-1 flex items-center gap-2 font-semibold"><Radio className="h-4 w-4 text-red-600" />Live stream</h2>
      {!st ? (
        <Loader2 className="h-4 w-4 animate-spin text-stone-400" />
      ) : !st.connected ? (
        <p className="text-sm text-stone-500">Connect the church YouTube channel in <Link className="text-gold-700 underline" href="/settings">Settings → Live streaming</Link> to schedule this sermon&apos;s broadcast.</p>
      ) : sermon.youtube ? (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <YouTubeLogo className="h-5 w-auto" />
          <span>
            Scheduled · <span className="capitalize">{sermon.youtube.privacy}</span> ·{" "}
            {new Date(sermon.youtube.scheduledStart).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
          </span>
          <a className="btn-secondary" href={sermon.youtube.url} target="_blank" rel="noreferrer" data-testid="broadcast-link"><ExternalLink className="h-4 w-4" />Watch link</a>
          <a className="btn-ghost" href={sermon.youtube.studioUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" />YouTube Studio</a>
          <button
            className="btn-ghost ml-auto"
            title="Forget this broadcast here (it stays on YouTube; delete it in YouTube Studio if needed)"
            onClick={() => confirm("Unlink this YouTube broadcast from the sermon?") && update((s) => ({ ...s, youtube: undefined }))}
          >
            <Unlink className="h-4 w-4" />Unlink
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-stone-500">
            Creates a scheduled broadcast on <span className="font-medium">{st.channel?.title}</span> using this sermon&apos;s title, gist and verses, at the service time.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <select className="input w-auto" value={privacy} onChange={(e) => setPrivacy(e.target.value as StreamPrivacy)} aria-label="Broadcast privacy">
              <option value="public">Public</option>
              <option value="unlisted">Unlisted</option>
              <option value="private">Private</option>
            </select>
            <button className="btn-primary" onClick={create} disabled={busy} data-testid="create-broadcast">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <YouTubeLogo />}Schedule YouTube broadcast
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600" role="alert">{error}</p>}
    </section>
  );
}
