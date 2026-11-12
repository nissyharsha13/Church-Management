import { Suspense } from "react";
import PresentConsole from "./PresentConsole";

export default function Page({ params }: PageProps<"/present/[id]">) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <Console params={params} />
    </Suspense>
  );
}

async function Console({ params }: { params: PageProps<"/present/[id]">["params"] }) {
  const { id } = await params;
  return <PresentConsole id={id} />;
}
