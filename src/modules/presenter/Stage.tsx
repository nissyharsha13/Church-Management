"use client";

import { useEffect, useRef } from "react";
import type { SlideVerse } from "@/lib/bible/slides";
import type { DisplayState, Scene } from "./protocol";

/**
 * Renders what the congregation sees. Used by the display window AND the
 * console's live monitor, so they always match. All sizes are in container
 * units (cqh/cqw), so the same layout scales from a thumbnail to a projector.
 */
interface StageProps {
  state: DisplayState;
  cameraStream: MediaStream | null;
  /** Renders the media scene. The display passes a real player; the monitor a lightweight preview. */
  renderMedia: (scene: Extract<Scene, { kind: "media" }>) => React.ReactNode;
}

export function Stage({ state, cameraStream, renderMedia }: StageProps) {
  const { scene } = state;
  const showCameraBg = state.cameraOn && (scene.kind === "camera" || (scene.kind === "verse" && state.overlayOnCamera));
  return (
    <div className="relative h-full w-full overflow-hidden bg-black text-white select-none" style={{ containerType: "size" }}>
      {/* Background layer */}
      {showCameraBg ? <CameraView stream={cameraStream} /> : scene.kind !== "blank" && scene.kind !== "media" && <ThemeBackground />}

      {scene.kind === "logo" && <LogoScene name={state.church.name} tagline={state.church.tagline} />}
      {scene.kind === "title" && <TitleScene title={scene.title} subtitle={scene.subtitle} />}
      {scene.kind === "verse" && <VerseScene scene={scene} state={state} overlay={showCameraBg} />}
      {scene.kind === "media" && renderMedia(scene)}
      {scene.kind === "camera" && !state.cameraOn && <LogoScene name={state.church.name} tagline={state.church.tagline} />}
    </div>
  );
}

function ThemeBackground() {
  return <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#1e3a8a_0%,#0b1229_55%,#05070f_100%)]" />;
}

export function CameraView({ stream }: { stream: MediaStream | null }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  if (!stream) return <div className="absolute inset-0 flex items-center justify-center bg-neutral-900 text-[3cqh] text-neutral-500">📷</div>;
  return <video ref={ref} autoPlay muted playsInline className="absolute inset-0 h-full w-full object-cover" />;
}

function LogoScene({ name, tagline }: { name: string; tagline: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-[2cqh] text-center">
      <div className="text-[9cqh] leading-none opacity-90">✝</div>
      <div className="px-[6cqw] text-[7cqh] font-bold tracking-wide">{name}</div>
      {tagline && <div className="px-[6cqw] text-[3.5cqh] opacity-75">{tagline}</div>}
    </div>
  );
}

function TitleScene({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-[3cqh] px-[8cqw] text-center">
      <div className="text-[8cqh] font-bold leading-tight" style={{ textWrap: "balance" }}>{title}</div>
      {subtitle && <div className="text-[3.6cqh] opacity-80">{subtitle}</div>}
    </div>
  );
}

/** Font size (cqh) that keeps the text on screen: longer text => smaller font. */
function fit(chars: number, k: number, min: number, max: number) {
  return Math.max(min, Math.min(max, k / Math.sqrt(chars + 20)));
}

function VerseScene({ scene, state, overlay }: { scene: Extract<Scene, { kind: "verse" }>; state: DisplayState; overlay: boolean }) {
  const mode = state.languageMode;
  const showP = mode !== "secondary";
  const showS = mode !== "primary" && scene.verses.some((v) => v.secondary);
  const pText = showP ? scene.verses.map((v) => v.primary ?? "").join(" ") : "";
  const sText = showS ? scene.verses.map((v) => v.secondary ?? "").join(" ") : "";
  const scale = state.fontScale * (overlay ? 0.62 : 1);
  const single = !(showP && showS);
  const pSize = fit(pText.length, single ? 82 : 72, 2.4, single ? 8 : 7) * scale;
  const sSize = fit(sText.length, single ? 82 : 60, 2.2, single ? 8 : 5.5) * scale;
  const ref = [showP && scene.refPrimary, showS && `${scene.refSecondary} (${scene.secondaryAbbr})`].filter(Boolean).join("  ·  ");
  const multi = scene.verses.length > 1;

  const body = (
    <>
      {showP && <VerseBlock verses={scene.verses} pick="primary" size={pSize} multi={multi} lang="te" />}
      {showP && showS && <div className="my-[1.6cqh] h-px w-full bg-white/25" />}
      {showS && <VerseBlock verses={scene.verses} pick="secondary" size={sSize} multi={multi} lang="en" dim={showP} />}
      <div className="mt-[2cqh] flex items-center justify-between text-[2.8cqh] font-semibold text-amber-200" style={{ fontSize: `${2.8 * Math.max(0.75, scale)}cqh` }}>
        <span>{ref}</span>
        {scene.slideCount > 1 && <span className="text-white/50">{scene.slideIndex + 1}/{scene.slideCount}</span>}
      </div>
    </>
  );

  if (overlay) {
    return (
      <div className="absolute inset-x-[3cqw] bottom-[4cqh] max-h-[52cqh] overflow-hidden rounded-[1.5cqh] bg-black/70 px-[3cqw] py-[2.5cqh] backdrop-blur-sm">
        {body}
      </div>
    );
  }
  return <div className="absolute inset-0 flex flex-col justify-center px-[6cqw] py-[5cqh]">{body}</div>;
}

function VerseBlock({ verses, pick, size, multi, lang, dim }: { verses: SlideVerse[]; pick: "primary" | "secondary"; size: number; multi: boolean; lang: string; dim?: boolean }) {
  return (
    <p lang={lang} className={`leading-[1.45] ${dim ? "text-white/85" : ""} ${lang === "te" ? "font-[family-name:var(--font-telugu)]" : ""}`} style={{ fontSize: `${size}cqh`, textWrap: "pretty" }}>
      {verses.map((v) => v[pick] && (
        <span key={v.n}>
          {multi && <sup className="mr-[0.4em] text-[0.55em] font-bold text-amber-200/80">{v.label ?? v.n}</sup>}
          {v[pick]}{" "}
        </span>
      ))}
    </p>
  );
}

