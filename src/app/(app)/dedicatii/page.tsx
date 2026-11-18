import { Suspense } from "react";
import { BlockSkeleton } from "@/components/loading-bar";
import { requireUser } from "@/lib/auth";
import { listCatalog, listRequests, type SongRequest } from "@/lib/dedications";
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

      <Suspense fallback={<BlockSkeleton />}>
        <Dedications />
      </Suspense>
    </section>
  );
}

async function Dedications() {
  const user = await requireUser();
  const [requests, catalog] = await Promise.all([listRequests(user.id), listCatalog()]);
  return (
    <>
      <DedicationForm />
      <Requests requests={requests} />
      <Catalog songs={catalog} />
    </>
  );
}

function Requests({ requests }: { requests: SongRequest[] }) {
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
              {/* Fiecare rând se taie cu „…” separat, deci nimic nu împinge restul afară. */}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{r.title}</p>
                <p className="truncate text-sm text-muted">{r.artist}</p>
                <p className="truncate text-xs text-muted">
                  cerută de{" "}
                  <span className={r.mine ? "font-semibold text-accent" : "text-foreground/80"}>
                    {r.mine ? "tine" : r.requestedBy}
                  </span>
                </p>
              </div>
              {r.youtubeUrl && <YouTubeButton href={r.youtubeUrl} title={r.title} />}
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

function YouTubeButton({ href, title }: { href: string; title: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      aria-label={`Ascultă „${title}” pe YouTube`}
      title="Ascultă pe YouTube"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-muted transition hover:border-accent/60 hover:text-accent"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
      </svg>
    </a>
  );
}
