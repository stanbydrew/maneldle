import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { listArchive, todayRo, type ArchiveEntry } from "@/lib/game";
import { MAX_GUESSES } from "@/lib/game-types";

export const metadata = { title: "Arhivă · Maneldle" };

export default function ArchivePage() {
  return (
    <section className="flex flex-col gap-4">
      <p className="text-center text-sm text-muted">
        Ai ratat o zi? O poți juca aici, dar nu aduce puncte.
      </p>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-surface" aria-hidden />}>
        <ArchiveList />
      </Suspense>
    </section>
  );
}

async function ArchiveList() {
  const user = await requireUser();
  const entries = await listArchive(user.id, todayRo());

  if (entries.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-surface p-6 text-center text-muted">
        Arhiva e goală deocamdată. Revino mâine.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {entries.map((entry) => (
        <li key={entry.date}>
          <Link
            href={`/archive/${entry.date}`}
            className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 transition hover:border-accent/60"
          >
            <span className="font-medium capitalize">{formatDate(entry.date)}</span>
            <StatusBadge entry={entry} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function StatusBadge({ entry }: { entry: ArchiveEntry }) {
  const late = entry.isLate ? " · arhivă" : "";
  switch (entry.status) {
    case "won":
      return <span className="text-sm text-success">✅ {entry.guesses}/{MAX_GUESSES}{late}</span>;
    case "lost":
      return <span className="text-sm text-danger">❌ X/{MAX_GUESSES}{late}</span>;
    case "playing":
      return <span className="text-sm text-accent">În curs ({entry.guesses}/{MAX_GUESSES})</span>;
    default:
      return <span className="text-sm text-muted">Joacă →</span>;
  }
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("ro-RO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}
