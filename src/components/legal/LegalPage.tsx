import Link from "next/link";

/** Simple public page shell for Privacy / Terms (readable without signing in). */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-5 py-12 text-stone-800">
      <Link href="/" className="text-sm text-gold-700 underline">Divine Church</Link>
      <h1 className="mt-4 text-3xl font-bold">{title}</h1>
      <p className="mt-1 text-sm text-stone-500">Last updated: {updated}</p>
      <div className="mt-8 space-y-5 leading-relaxed [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc">{children}</div>
    </main>
  );
}
