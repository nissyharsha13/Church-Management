"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { BookOpen, Church, Film, LogOut, Settings } from "lucide-react";
import { db, DEFAULT_CHURCH_ID, DEFAULT_SETTINGS } from "@/lib/db";
import { useT, useUILang } from "@/lib/i18n";

export function AppHeader() {
  const t = useT();
  const lang = useUILang();
  const path = usePathname();
  const settings = useLiveQuery(() => db.churches.get(DEFAULT_CHURCH_ID), []);
  const nav = [
    { href: "/", label: t("sermons"), icon: BookOpen, active: path === "/" || path.startsWith("/sermons") },
    { href: "/library", label: t("library"), icon: Film, active: path.startsWith("/library") },
    { href: "/settings", label: t("settings"), icon: Settings, active: path.startsWith("/settings") },
  ];
  const toggleLang = async () => {
    const s = settings ?? DEFAULT_SETTINGS;
    await db.churches.put({ ...s, uiLanguage: lang === "en" ? "te" : "en" });
  };
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5">
        <Link href="/" className="mr-3 flex items-center gap-2 font-semibold text-slate-900">
          <Church className="h-5 w-5 text-indigo-600" />
          <span className="hidden sm:inline">{settings?.name ?? t("appName")}</span>
        </Link>
        <nav className="flex flex-1 gap-1">
          {nav.map(({ href, label, icon: Icon, active }) => (
            <Link key={href} href={href} className={`btn ${active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100"}`}>
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
    </header>
  );
}
