"use client";

import { useEffect, useState } from "react";
import { Clock, MapPin, UserRound } from "lucide-react";
import QRCode from "qrcode";
import { ChurchLogo } from "@/components/ChurchLogo";
import { formatReference } from "@/lib/bible/reference";
import { usePassage } from "@/lib/bible/usePassage";
import { translationLang } from "@/lib/bible/translations";
import { ENDED_VERSES, greetingFor, MESSAGES, quoted, rotatingIndex, VERSE_ROTATE_MS, WELCOME_VERSES } from "./occasion";
import type { ChurchInfo, DisplayState } from "./protocol";

/** Current time, ticking. null until mounted (never read the clock during prerender). */
export function useNow(intervalMs = 1000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, intervalMs);
    return () => { clearTimeout(first); clearInterval(id); };
  }, [intervalMs]);
  return now;
}

/** Warm black-and-gold backdrop used behind every non-camera scene. */
export function ThemeBackground() {
  return (
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-10%,#3b2a0b_0%,#16100a_45%,#050403_100%)]">
      <div className="absolute inset-x-0 top-0 h-[0.5cqh] bg-[linear-gradient(90deg,transparent,#d4a52c,transparent)] opacity-70" />
      <div className="absolute inset-x-0 bottom-0 h-[0.5cqh] bg-[linear-gradient(90deg,transparent,#d4a52c,transparent)] opacity-70" />
    </div>
  );
}

/** Logo screen during the sermon: emblem, name, tagline, pastor. */
export function LogoScene({ church }: { church: ChurchInfo }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-[2.2cqh] text-center">
      <ChurchLogo className="h-[34cqh] w-[34cqh]" shine />
      <div className="px-[6cqw] font-[family-name:var(--font-display)] text-[8cqh] font-semibold uppercase leading-none tracking-[0.08em] text-gold-gloss">{church.name}</div>
      {church.nameTe && <div className="text-[4cqh] font-semibold text-gold-200">{church.nameTe}</div>}
      {church.tagline && <div className="px-[6cqw] text-[2.8cqh] tracking-wide text-white/70">{church.tagline}</div>}
      {church.pastorName && <div className="mt-[1cqh] text-[3cqh] text-gold-100">{church.pastorName}</div>}
    </div>
  );
}

/**
 * Before/after the sermon: greeting, live date & time, a rotating verse,
 * a gentle status message and the church's details.
 */
export function BrandBoard({ state, variant }: { state: DisplayState; variant: "welcome" | "ended" }) {
  const now = useNow();
  const { church, translations, languageMode } = state;
  const verses = variant === "welcome" ? WELCOME_VERSES : ENDED_VERSES;
  const ref = now === null ? null : verses[rotatingIndex(now, verses.length, variant === "ended" ? 3 : 0)];
  const showTe = languageMode !== "secondary";
  const showEn = languageMode !== "primary" && !!translations.secondary;
  const primary = usePassage(showTe ? translations.primary : null, ref);
  const secondary = usePassage(showEn ? translations.secondary : null, ref);
  const d = now === null ? null : new Date(now);
  const g = d ? greetingFor(d) : null;
  const msg = variant === "welcome" ? MESSAGES.welcome : MESSAGES.ended;
  const pText = primary.verses.map((v) => v.text).join(" ");
  const sText = secondary.verses.map((v) => v.text).join(" ");
  const verseSize = Math.max(2.4, Math.min(3.6, 62 / Math.sqrt(Math.max(pText.length, sText.length) + 40)));

  return (
    <div className="absolute inset-0 flex flex-col px-[4cqw] py-[3.5cqh]">
      {/* Top: greeting + clock */}
      <div className="flex items-start justify-between gap-[3cqw]">
        <div className="min-w-0">
          {g && (
            <>
              <div className="text-[5.2cqh] font-bold leading-tight text-gold-gloss animate-shine">
                {variant === "welcome" ? `${g.te} · ${g.en}` : `${MESSAGES.thanks.te} · ${MESSAGES.thanks.en}`}
              </div>
              <div className="mt-[0.6cqh] text-[2.8cqh] text-gold-100/90">
                {variant === "welcome" ? `${g.subTe} · ${g.subEn}` : `${MESSAGES.blessing.te} · ${MESSAGES.blessing.en}`}
              </div>
            </>
          )}
        </div>
        {d && (
          <div className="shrink-0 text-right">
            <div className="font-[family-name:var(--font-display)] text-[6.5cqh] font-semibold leading-none tabular-nums text-white" data-testid="board-clock">
              {d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })}
            </div>
            <div className="mt-[0.8cqh] text-[2.4cqh] text-gold-200">{d.toLocaleDateString("te-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
            <div className="text-[2.2cqh] text-white/60">{d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
          </div>
        )}
      </div>

      {/* Middle: identity (left) + message & verse (right) */}
      <div className="flex min-h-0 flex-1 items-center gap-[4cqw] py-[2.5cqh]">
        <div className="flex w-[34cqw] shrink-0 flex-col items-center text-center">
          <ChurchLogo className="h-[30cqh] w-[30cqh]" shine />
          <div className="mt-[2cqh] font-[family-name:var(--font-display)] text-[5.6cqh] font-semibold uppercase leading-none tracking-[0.08em] text-gold-gloss">{church.name}</div>
          {church.nameTe && <div className="mt-[1cqh] text-[3cqh] font-semibold text-gold-200">{church.nameTe}</div>}
          {church.tagline && <div className="mt-[1.2cqh] text-[2cqh] tracking-wide text-white/65">{church.tagline}</div>}
          {church.pastorName && (
            <div className="mt-[2.4cqh] rounded-full border border-gold-400/40 bg-gold-400/10 px-[2cqw] py-[0.9cqh]">
              <div className="text-[1.6cqh] uppercase tracking-[0.25em] text-gold-300">Pastor · పాస్టర్</div>
              <div className="font-[family-name:var(--font-display)] text-[3.2cqh] font-semibold text-white">{church.pastorName}</div>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-[2.5cqh]">
          <div className="rounded-[1.4cqh] border border-gold-400/35 bg-black/30 px-[2.4cqw] py-[2cqh]" data-testid="board-message">
            <div className="text-[3.4cqh] font-semibold leading-snug text-white">
              {msg.te}
              {variant === "welcome" && <Dots />}
            </div>
            <div className="mt-[0.5cqh] text-[2.6cqh] text-gold-100/85">{msg.en}</div>
          </div>
          {ref && (pText || sText) && (
            <div key={`${ref.book}${ref.chapter}${ref.start}`} className="animate-fade-in rounded-[1.4cqh] bg-white/[0.04] px-[2.4cqw] py-[2.2cqh] ring-1 ring-white/10" data-testid="board-verse">
              {pText && <p lang="te" className="font-[family-name:var(--font-telugu)] leading-[1.5] text-white" style={{ fontSize: `${verseSize}cqh` }}>{quoted(pText)}</p>}
              {sText && <p className={`leading-[1.45] text-white/80 ${pText ? "mt-[1.4cqh]" : ""}`} style={{ fontSize: `${verseSize * 0.82}cqh` }}>{quoted(sText)}</p>}
              <div className="mt-[1.4cqh] text-[2.2cqh] font-semibold text-gold-300">
                — {formatReference(ref, translationLang(translations.primary))}{showEn ? ` · ${formatReference(ref, "en")}` : ""}
              </div>
              <RotateBar now={now ?? 0} />
            </div>
          )}
        </div>
      </div>

      {/* Bottom: details */}
      <div className="flex items-center gap-[2.5cqw] border-t border-gold-400/25 pt-[2cqh] text-[2.1cqh] text-white/80">
        {church.address && (
          <Detail icon={<MapPin className="h-[2.6cqh] w-[2.6cqh]" />}>{church.address}</Detail>
        )}
        {church.serviceTimes && <Detail icon={<Clock className="h-[2.6cqh] w-[2.6cqh]" />}>{church.serviceTimes}</Detail>}
        {church.pastorName && !church.address && <Detail icon={<UserRound className="h-[2.6cqh] w-[2.6cqh]" />}>{church.pastorName}</Detail>}
        {(church.youtubeName || church.youtubeUrl) && (
          <div className="ml-auto flex shrink-0 items-center gap-[1.2cqw]" data-testid="board-youtube">
            <div className="text-right">
              <div className="flex items-center justify-end gap-[0.6cqw] text-[2.2cqh] font-semibold text-white"><YouTubeMark />{church.youtubeName || "YouTube"}</div>
              <div className="text-[1.7cqh] text-white/60">Subscribe · సబ్‌స్క్రైబ్ చేయండి</div>
            </div>
            {church.youtubeUrl && <QR url={church.youtubeUrl} />}
          </div>
        )}
      </div>
    </div>
  );
}

function Detail({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-[0.8cqw]">
      <span className="shrink-0 text-gold-300">{icon}</span>
      <span className="min-w-0 leading-snug">{children}</span>
    </div>
  );
}

function Dots() {
  return (
    <span className="ml-[0.4cqw] inline-flex gap-[0.4cqw] align-middle" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span key={i} className="inline-block h-[0.9cqh] w-[0.9cqh] animate-pulse rounded-full bg-gold-300" style={{ animationDelay: `${i * 0.3}s` }} />
      ))}
    </span>
  );
}

/** Thin progress line showing when the next verse will appear. */
function RotateBar({ now }: { now: number }) {
  const pct = ((now % VERSE_ROTATE_MS) / VERSE_ROTATE_MS) * 100;
  return (
    <div className="mt-[1.2cqh] h-[0.35cqh] overflow-hidden rounded-full bg-white/10">
      <div className="h-full bg-gold-400/70 transition-[width] duration-1000 ease-linear" style={{ width: `${pct}%` }} />
    </div>
  );
}

function YouTubeMark() {
  return (
    <svg viewBox="0 0 28 20" className="h-[2.4cqh] w-auto" aria-hidden>
      <rect width="28" height="20" rx="5" fill="#FF0000" />
      <path d="M11 5.5v9l8-4.5z" fill="#fff" />
    </svg>
  );
}

function QR({ url }: { url: string }) {
  const [svg, setSvg] = useState<string>("");
  useEffect(() => {
    let alive = true;
    QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } })
      .then((s) => alive && setSvg(s))
      .catch(() => alive && setSvg(""));
    return () => { alive = false; };
  }, [url]);
  if (!svg) return null;
  // SVG is generated locally by the qrcode library from the admin-configured URL.
  return <div className="h-[11cqh] w-[11cqh] overflow-hidden rounded-[0.8cqh] bg-white p-[0.4cqh] [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />;
}
