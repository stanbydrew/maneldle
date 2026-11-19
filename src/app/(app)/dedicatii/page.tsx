import { Suspense } from "react";
import { BlockSkeleton } from "@/components/loading-bar";
import { requireUser } from "@/lib/auth";
import { getDedicationsPage } from "@/lib/dedications";
import { DedicationsBoard } from "./board";

export const metadata = { title: "Dedicații · Maneldle" };

export default function DedicatiiPage() {
  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-xl font-black">🎶 Dedicații</h1>
        <p className="text-sm text-muted">
          Caută maneaua. Dacă nu e în joc, cere-o. Dacă a cerut-o deja cineva, dă-i +1: cele mai votate intră primele.
        </p>
      </div>

      <Suspense fallback={<BlockSkeleton />}>
        <Dedications />
      </Suspense>
    </section>
  );
}

async function Dedications() {
  const user = await requireUser();
  const { requests, songs } = await getDedicationsPage(user.id);
  return <DedicationsBoard requests={requests} songs={songs} />;
}
