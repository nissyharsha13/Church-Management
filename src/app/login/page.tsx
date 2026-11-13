"use client";

import { useState } from "react";
import { LogIn } from "lucide-react";
import { ChurchLogo, Wordmark } from "@/components/ChurchLogo";
import { useT } from "@/lib/i18n";

export default function LoginPage() {
  const t = useT();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        const next = new URLSearchParams(window.location.search).get("next");
        // Only allow same-site relative paths (no open redirect).
        window.location.assign(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
        return;
      }
      const code = (await res.json().catch(() => ({}))).error;
      setError(code === "too_many_attempts" ? t("tooManyAttempts") : code === "not_configured" ? t("loginNotConfigured") : t("invalidCredentials"));
    } catch {
      setError("Network error");
    }
    setBusy(false);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,#fbf3dc_0%,#fbfaf7_60%)] px-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-6">
        <div className="flex flex-col items-center gap-2 pb-2 text-center">
          <ChurchLogo className="h-24 w-24" shine onLight />
          <Wordmark className="text-2xl" onLight />
        </div>
        <div>
          <label className="label" htmlFor="username">{t("username")}</label>
          <input id="username" className="input" autoComplete="username" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="password">{t("password")}</label>
          <input id="password" type="password" className="input" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}><LogIn className="h-4 w-4" />{busy ? "…" : t("signIn")}</button>
      </form>
    </main>
  );
}
