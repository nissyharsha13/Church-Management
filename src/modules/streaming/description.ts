import type { ChurchSettings } from "@/lib/db";
import { formatReference } from "@/lib/bible/reference";
import type { Sermon } from "@/modules/sermons/types";

/** Broadcast title + description from the sermon and church profile. */
export function broadcastTitle(sermon: Sermon, church: Pick<ChurchSettings, "name">): string {
  const t = sermon.title.trim() || "Sunday Service";
  return `${t} | ${church.name}`.slice(0, 100);
}

export function broadcastDescription(sermon: Sermon, church: ChurchSettings): string {
  const refs = sermon.verses.map((v) => `${formatReference(v.ref, "te")} · ${formatReference(v.ref, "en")}`);
  const lines = [
    sermon.title,
    sermon.gist && `\n${sermon.gist}`,
    sermon.speaker && `\nSpeaker · ప్రసంగీకుడు: ${sermon.speaker}`,
    refs.length ? `\nScripture · వాక్య భాగాలు:\n${refs.map((r) => `• ${r}`).join("\n")}` : "",
    `\n${church.name}${church.nameTe ? ` · ${church.nameTe}` : ""}`,
    church.tagline,
    church.address && `📍 ${church.address}`,
    church.serviceTimes && `🕙 ${church.serviceTimes}`,
  ];
  return lines.filter(Boolean).join("\n").replace(/[<>]/g, "");
}

/** Service start as ISO, from the sermon date + the first time found in "Sunday · 10:30 AM". */
export function scheduledStartFor(sermon: Sermon, church: Pick<ChurchSettings, "serviceTimes">): string {
  const m = church.serviceTimes.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  let h = m ? +m[1] : 10;
  const min = m ? +m[2] : 0;
  if (m?.[3]) {
    const pm = m[3].toLowerCase() === "pm";
    if (pm && h < 12) h += 12;
    if (!pm && h === 12) h = 0;
  }
  const [y, mo, d] = sermon.date.split("-").map(Number);
  return new Date(y, mo - 1, d, h, min).toISOString();
}
