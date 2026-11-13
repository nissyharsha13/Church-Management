"use client";

import { DEFAULT_EMBLEM, useChurch } from "@/lib/church/useChurch";

/**
 * The church emblem. In "gold" mode the logo is used as a mask over a metallic
 * gold gradient (works for transparent logos); otherwise it is shown as-is.
 * Size it with className (width + height).
 */
export function ChurchLogo({ className = "h-10 w-10", shine = false, title, onLight = false }: { className?: string; shine?: boolean; title?: string; /** deeper gold for white backgrounds */ onLight?: boolean }) {
  const church = useChurch();
  const src = church.logoDataUrl || DEFAULT_EMBLEM;
  if (!church.logoGold) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={title ?? church.name} className={`${className} object-contain`} />;
  }
  const mask = `url("${src}") center / contain no-repeat`;
  return (
    <div
      role="img"
      aria-label={title ?? church.name}
      className={`${className} ${shine ? "animate-shine" : ""}`}
      style={{ WebkitMask: mask, mask, backgroundImage: onLight ? "var(--gold-gloss-deep)" : "var(--gold-gloss)", backgroundSize: "220% 220%" }}
    />
  );
}

/** Church name set in Cinzel with a glossy gold finish. */
export function Wordmark({ className = "", shine = false, onLight = false }: { className?: string; shine?: boolean; onLight?: boolean }) {
  const church = useChurch();
  return <span className={`font-[family-name:var(--font-display)] font-semibold uppercase tracking-[0.08em] ${onLight ? "text-gold-gloss-deep" : "text-gold-gloss"} ${shine ? "animate-shine" : ""} ${className}`}>{church.name}</span>;
}
