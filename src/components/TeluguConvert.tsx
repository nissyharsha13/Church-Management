"use client";

import { useState } from "react";
import { Languages, Loader2, Undo2 } from "lucide-react";
import { useT } from "@/lib/i18n";

/**
 * "Convert to Telugu" for a text field: sends Telugu written in English letters
 * to /api/transliterate and replaces the field value. Offers Undo afterwards.
 */
export function TeluguConvert({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [undo, setUndo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasLatin = /[A-Za-z]/.test(value);

  const convert = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/transliterate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          data.error === "too_long" ? t("convertTooLong")
            : data.error === "not_configured" || data.error === "no_credits" ? t("convertUnavailable")
            : t("convertFailed"),
        );
      } else if (typeof data.text === "string") {
        setUndo(value);
        onChange(data.text);
      }
    } catch {
      setError(t("convertOffline"));
    }
    setBusy(false);
  };

  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      {undo !== null ? (
        <button type="button" className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-slate-500 hover:bg-slate-100" onClick={() => { onChange(undo); setUndo(null); }}>
          <Undo2 className="h-3 w-3" />{t("undo")}
        </button>
      ) : null}
      <button
        type="button"
        onClick={convert}
        disabled={busy || !hasLatin}
        title={t("convertHint")}
        aria-label={`${t("convertToTelugu")}${label ? ` — ${label}` : ""}`}
        className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 font-medium text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Languages className="h-3 w-3" />}
        {t("convertToTelugu")}
      </button>
      {error && <span className="text-red-600" role="status">{error}</span>}
    </span>
  );
}

/** Label row: field label on the left, Telugu convert on the right. */
export function FieldLabel({ htmlFor, children, value, onChange }: { htmlFor: string; children: React.ReactNode; value: string; onChange: (v: string) => void }) {
  return (
    <div className="mb-1 flex items-center justify-between gap-2">
      <label className="label mb-0" htmlFor={htmlFor}>{children}</label>
      <TeluguConvert value={value} onChange={onChange} label={typeof children === "string" ? children : undefined} />
    </div>
  );
}
