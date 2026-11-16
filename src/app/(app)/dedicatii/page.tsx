import { Suspense } from "react";
import { BlockSkeleton } from "@/components/loading-bar";
import { requireUser } from "@/lib/auth";
import { listCatalog, listRequests } from "@/lib/dedications";
import { Catalog } from "./catalog";
import { DedicationForm } from "./dedication-form";
import { VoteButton } from "./vote-button";

export const metadata = { title: "Dedicații · Maneldle" };

export default function DedicatiiPage() {
  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-xl font-black">🎶 Dedicații</h1>
        <p className="text-sm text-muted">
          Lipsește o manea? Cere-o aici. Dacă a cerut-o deja cineva, dă-i +1: cele mai votate intră primele.
        </p>
      </div>

      <DedicationForm />

      <Suspense fallback={<BlockSkeleton className="h-40" />}>
        <Requests />
      </Suspense>

      <Suspense fallback={<BlockSkeleton />}>
        <CatalogSection />
      </Suspense>
    </section>
  );
}

async function Requests() {
  const user = await requireUser();
  const requests = await listRequests(user.id);

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
        Cereri <span className="font-mono">({requests.length})</span>
      </h2>
      {requests.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
          Nicio dedicație încă. Fii primul!
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {requests.map((r) => (
            <li
              key={r.id}
              className={`flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 ${
                r.status === "added" ? "opacity-70" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {r.title}
                  {r.youtubeUrl && (
                    <a
                      href={r.youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="ml-2 text-xs font-normal text-accent hover:underline"
                    >
                      YouTube ↗
                    </a>
                  )}
                </p>
                <p className="truncate text-sm text-muted">
                  {r.artist} · cerută de <span className={r.mine ? "text-accent" : ""}>{r.mine ? "tine" : r.requestedBy}</span>
                </p>
              </div>
              {r.status === "added" ? (
                <span className="shrink-0 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
                  ✅ în joc
                </span>
              ) : (
                <VoteButton requestId={r.id} votes={r.votes} voted={r.votedByMe} mine={r.mine} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function CatalogSection() {
  await requireUser();
  return <Catalog songs={await listCatalog()} />;
}
