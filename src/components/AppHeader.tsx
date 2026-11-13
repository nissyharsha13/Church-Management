"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Film, LogOut, Settings } from "lucide-react";
import { db } from "@/lib/db";
import { useChurch } from "@/lib/church/useChurch";
import { ChurchLogo, Wordmark } from "@/components/ChurchLogo";
import { useT, useUILang } from "@/lib/i18n";

export function AppHeader() {
  const t = useT();
  const lang = useUILang();
  const path = usePathname();
  const settings = useChurch();
  const nav = [
    { href: "/", label: t("sermons"), icon: BookOpen, active: path === "/" || path.startsWith("/sermons") },
    { href: "/library", label: t("library"), icon: Film, active: path.startsWith("/library") },
    { href: "/settings", label: t("settings"), icon: Settings, active: path.startsWith("/settings") },
  ];
  const toggleLang = async () => {
    await db.churches.put({ ...settings, uiLanguage: lang === "en" ? "te" : "en" });
  };
  return (
    <header className="sticky top-0 z-20 border-b border-gold-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5">
        <Link href="/" className="mr-3 flex items-center gap-2.5">
          <ChurchLogo className="h-9 w-9" onLight />
          <span className="hidden flex-col leading-none sm:flex">
            <Wordmark className="text-lg" onLight />
            {settings.nameTe && <span className="mt-0.5 text-[11px] font-medium text-gold-700">{settings.nameTe}</span>}
          </span>
        </Link>
        <nav className="flex flex-1 gap-1">
          {nav.map(({ href, label, icon: Icon, active }) => (
            <Link key={href} href={href} className={`btn ${active ? "bg-gold-50 text-gold-700" : "text-stone-600 hover:bg-stone-100"}`}>
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ))}
        </nav>
        <button onClick={toggleLang} className="btn-secondary" title={t("uiLanguage")}>
          {lang === "en" ? "తెలుగు" : "English"}
        </button>
        <button
          className="btn-ghost"
          title={t("signOut")}
          // Full reload on purpose: drops any cached pages after sign-out.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.assign("/login"); }}
        >
          <LogOut className="h-4 w-4" /><span className="hidden md:inline">{t("signOut")}</span>
        </button>
      </div>
      <div className="h-px bg-[linear-gradient(90deg,transparent,#d4a52c,transparent)]" />
    </header>
  );
}
