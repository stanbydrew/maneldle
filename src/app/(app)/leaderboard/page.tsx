import { Suspense } from "react";
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
      <p className="text-center text-xs leading-relaxed text-muted">
        Ordonat după piese ghicite, apoi după puncte: 4 din prima, 3 din a doua, 2 din a treia, 1 din a patra.
        <br />
        Zilele ratate contează. Arhiva nu aduce puncte.
      </p>
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

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-surface text-xs uppercase tracking-wider text-muted">
          <tr>
            <th scope="col" className="w-10 py-3 pl-3 text-left">#</th>
            <th scope="col" className="py-3 text-left">Jucător</th>
            <th scope="col" className="py-3 text-right" title="Ghicite / zile totale">Ghicite</th>
            <th scope="col" className="py-3 text-right" title="Puncte">Pct</th>
            <th scope="col" className="py-3 pr-3 text-right" title="Ghicite din prima încercare">🔥</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isMe = row.userId === user.id;
            return (
              <tr
                key={row.userId}
                className={`border-t border-border ${isMe ? "bg-accent/10" : ""}`}
              >
                <td className="py-3 pl-3 font-mono text-muted">{medal(row.rank)}</td>
                <td className={`py-3 ${isMe ? "font-semibold text-accent" : ""}`}>
                  {row.username}
                </td>
                <td className="py-3 text-right font-mono">
                  {row.solved}
                  <span className="text-muted">/{row.totalDays}</span>
                </td>
                <td className="py-3 text-right font-mono font-semibold">{row.points}</td>
                <td className="py-3 pr-3 text-right font-mono text-muted">{row.firstTry}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function medal(rank: number) {
  return ["🥇", "🥈", "🥉"][rank - 1] ?? rank;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  );
}
