"use client";

import { ChurchLogo } from "@/components/ChurchLogo";
import { formatReference } from "@/lib/bible/reference";
import { usePassage } from "@/lib/bible/usePassage";
import { translationLang } from "@/lib/bible/translations";
import { useNow } from "./BrandBoard";
import { MESSAGES, PRAYER_VERSES, quoted, rotatingIndex } from "./occasion";
import type { DisplayState, Scene } from "./protocol";

type PrayerSceneData = Extract<Scene, { kind: "prayer" }>;

/** A softly flickering candle — calm focal point for prayer. */
export function Candle({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 120" className={className} aria-hidden>
      <defs>
        <radialGradient id="flame" cx="50%" cy="65%" r="60%">
          <stop offset="0%" stopColor="#fffbe8" />
          <stop offset="45%" stopColor="#ffd76a" />
          <stop offset="100%" stopColor="#e08a1e" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="wax" x1="0" x2="1">
          <stop offset="0%" stopColor="#b8862b" />
          <stop offset="45%" stopColor="#f6e2a0" />
          <stop offset="100%" stopColor="#8a6212" />
        </linearGradient>
      </defs>
      <g className="origin-[30px_40px] animate-flicker">
        <path d="M30 6 C22 22 20 32 24 40 C27 46 33 46 36 40 C40 32 38 22 30 6 Z" fill="url(#flame)" />
        <path d="M30 22 C27 30 27 35 29 39 C30 41 31 41 32 39 C33 35 33 30 30 22 Z" fill="#fff6d0" opacity="0.9" />
      </g>
      <line x1="30" y1="40" x2="30" y2="47" stroke="#3b2a0b" strokeWidth="1.5" />
      <rect x="18" y="47" width="24" height="66" rx="3" fill="url(#wax)" />
      <ellipse cx="30" cy="47.5" rx="12" ry="2.5" fill="#fff3c4" opacity="0.8" />
    </svg>
  );
}

function usePrayerVerse(state: DisplayState) {
  const now = useNow(1000);
  const ref = now === null ? null : PRAYER_VERSES[rotatingIndex(now, PRAYER_VERSES.length, 5)];
  const showTe = state.languageMode !== "secondary";
  const showEn = state.languageMode !== "primary" && !!state.translations.secondary;
  const p = usePassage(showTe ? state.translations.primary : null, ref);
  const s = usePassage(showEn ? state.translations.secondary : null, ref);
  return { ref, now, showEn, pText: p.verses.map((v) => v.text).join(" "), sText: s.verses.map((v) => v.text).join(" ") };
}

export function PrayerScene({ state, scene, overlay }: { state: DisplayState; scene: PrayerSceneData; overlay: boolean }) {
  const { ref, now, showEn, pText, sText } = usePrayerVerse(state);
  const hasTopic = !!(scene.topicTe || scene.topicEn);
  const topic = [scene.topicTe, scene.topicEn].filter(Boolean).join(" · ");

  if (overlay) {
    // Lower third over the camera so people can see who is praying.
    return (
      <div className="absolute inset-x-[3cqw] bottom-[4cqh] flex items-center gap-[2cqw] rounded-[1.5cqh] bg-black/70 px-[2.5cqw] py-[2.2cqh] backdrop-blur-sm" data-testid="prayer-overlay">
        <Candle className="h-[14cqh] w-auto shrink-0" />
        <div className="min-w-0">
          <div className="text-[4.2cqh] font-bold leading-tight text-gold-gloss">{MESSAGES.prayerTitle.te} · {MESSAGES.prayerTitle.en}</div>
          {hasTopic && <div className="mt-[0.4cqh] text-[2.8cqh] font-semibold text-gold-100">{topic}</div>}
          <div className="mt-[0.6cqh] text-[2.2cqh] text-white/80">{MESSAGES.prayerInvite.te}</div>
          {scene.leader && <div className="mt-[0.4cqh] text-[2cqh] text-white/60">{MESSAGES.prayerLedBy.en}: <span className="font-semibold text-white">{scene.leader}</span></div>}
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center px-[6cqw] py-[3.5cqh] text-center" data-testid="prayer-scene">
      {/* breathing glow behind the candle */}
      <div className="pointer-events-none absolute left-1/2 top-[30%] h-[70cqh] w-[70cqh] -translate-x-1/2 -translate-y-1/2 animate-breathe rounded-full bg-[radial-gradient(circle,rgba(255,206,99,0.28)_0%,rgba(212,165,44,0.10)_40%,transparent_70%)]" />

      <div className="relative flex w-full items-center justify-between text-left">
        <div className="flex items-center gap-[1cqw]">
          <ChurchLogo className="h-[6cqh] w-[6cqh]" />
          <span className="font-[family-name:var(--font-display)] text-[2.6cqh] font-semibold uppercase tracking-[0.1em] text-gold-gloss">{state.church.name}</span>
        </div>
        {now !== null && (
          <span className="font-[family-name:var(--font-display)] text-[2.8cqh] tabular-nums text-white/70">
            {new Date(now).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })}
          </span>
        )}
      </div>

      <Candle className="relative mt-[1cqh] h-[24cqh] w-auto" />

      <div className="relative mt-[2cqh] text-[7.2cqh] font-bold leading-tight text-gold-gloss animate-shine">{MESSAGES.prayerTitle.te}</div>
      <div className="relative font-[family-name:var(--font-display)] text-[4cqh] tracking-[0.12em] text-gold-100">{MESSAGES.prayerTitle.en}</div>

      {hasTopic && (
        <div className="relative mt-[2cqh] rounded-full border border-gold-400/50 bg-gold-400/10 px-[2.4cqw] py-[1cqh] text-[3.2cqh] font-semibold text-white" data-testid="prayer-topic">
          {topic}
        </div>
      )}

      <div className="relative mt-[2.2cqh] max-w-[80cqw] text-[2.8cqh] leading-snug text-white/85">{MESSAGES.prayerInvite.te}</div>
      <div className="relative text-[2.4cqh] text-white/60">{MESSAGES.prayerInvite.en}</div>

      {scene.leader && (
        <div className="relative mt-[2cqh] text-[2.4cqh] text-gold-200">
          {MESSAGES.prayerLedBy.te} · {MESSAGES.prayerLedBy.en}{" "}
          <span className="font-[family-name:var(--font-display)] text-[3cqh] font-semibold text-white">{scene.leader}</span>
        </div>
      )}

      <div className="relative mt-auto w-full max-w-[86cqw]">
        {ref && (pText || sText) && (
          <div key={`${ref.book}${ref.chapter}${ref.start}`} className="animate-fade-in border-t border-gold-400/25 pt-[1.6cqh]" data-testid="prayer-verse">
            {pText && <p lang="te" className="font-[family-name:var(--font-telugu)] text-[2.5cqh] leading-[1.5] text-white/85">{quoted(pText)}</p>}
            {sText && <p className="mt-[0.6cqh] text-[2.1cqh] leading-snug text-white/60">{quoted(sText)}</p>}
            <div className="mt-[0.6cqh] text-[1.9cqh] font-semibold text-gold-300">
              — {formatReference(ref, translationLang(state.translations.primary))}{showEn ? ` · ${formatReference(ref, "en")}` : ""}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
