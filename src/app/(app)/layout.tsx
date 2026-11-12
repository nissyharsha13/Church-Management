import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Suspense fallback={<div className="h-[57px] border-b border-slate-200 bg-white" />}>
        <AppHeader />
      </Suspense>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </>
  );
}
