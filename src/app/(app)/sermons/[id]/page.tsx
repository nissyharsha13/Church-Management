import { Suspense } from "react";
import SermonEditor from "./SermonEditor";

export default function Page({ params }: PageProps<"/sermons/[id]">) {
  return (
    <Suspense fallback={null}>
      <Editor params={params} />
    </Suspense>
  );
}

async function Editor({ params }: { params: PageProps<"/sermons/[id]">["params"] }) {
  const { id } = await params;
  return <SermonEditor id={id} />;
}
