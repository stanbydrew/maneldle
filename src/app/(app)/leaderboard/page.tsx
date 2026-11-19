import { Suspense } from "react";
import { LeaderboardBoard } from "@/components/leaderboard-board";
import { BlockSkeleton } from "@/components/loading-bar";
import { requireUser } from "@/lib/auth";
import { serverEnv } from "@/lib/env";
import { todayRo } from "@/lib/game";
import { getLeaderboard } from "@/lib/leaderboard";

export const metadata = { title: "Clasament · Maneldle" };

export default function LeaderboardPage() {
  return (
    <section className="flex flex-col gap-4">
      <Suspense fallback={<BlockSkeleton />}>
        <Leaderboard />
      </Suspense>
    </section>
  );
}

async function Leaderboard() {
  const user = await requireUser();
  const launch = serverEnv.launchDate;

  const today = todayRo();
  if (today < launch) {
    return (
      <p className="rounded-xl border border-border bg-surface p-6 text-center text-muted">
        Clasamentul pornește pe <span className="font-semibold text-foreground">{formatDate(launch)}</span>.
        <br />
        Până atunci, încălzește-te. 🎶
      </p>
    );
  }

  const rows = await getLeaderboard();
  return <LeaderboardBoard rows={rows} meId={user.id} />;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  );
}
