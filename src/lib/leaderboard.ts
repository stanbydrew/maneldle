import "server-only";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export type TodayStatus = "solved" | "failed" | "pending";

export type LeaderboardRow = {
  rank: number;
  /** Câte locuri a urcat (+) sau coborât (−) față de clasamentul de ieri. */
  rankChange: number;
  /** N-avea niciun punct ieri, acum are. */
  isNew: boolean;
  userId: string;
  username: string;
  points: number;
  firstTry: number;
  solved: number;
  streak: number;
  today: TodayStatus;
};

type Stats = { username: string; points: number; firstTry: number; solved: number };

/** Puncte ↓, apoi ghicite din prima ↓, apoi ghicite ↓. */
function compare(a: Stats, b: Stats) {
  return b.points - a.points || b.firstTry - a.firstTry || b.solved - a.solved;
}

/**
 * Locul fiecăruia, după `compare`. Egalii la toate trei împart locul, următorul
 * ia locul imediat următor (1 2 3 4 4 5).
 */
function rankAll<T extends Stats>(rows: T[]): Map<T, number> {
  const sorted = rows.toSorted((a, b) => compare(a, b) || a.username.localeCompare(b.username, "ro"));
  const ranks = new Map<T, number>();
  let rank = 0;
  sorted.forEach((row, i) => {
    if (i === 0 || compare(sorted[i - 1], row) !== 0) rank += 1;
    ranks.set(row, rank);
  });
  return ranks;
}

/**
 * Clasamentul, ordonat. Cifrele vin din Postgres (funcția `leaderboard` din
 * migrări), ordinea și locurile se stabilesc aici. Locul de ieri se socotește
 * la fel, din cifrele de până ieri inclusiv.
 *
 * Fără cache pe server: pe Vercel fiecare instanță are memoria ei și golirea
 * cache-ului ajunge doar la una. Interogarea durează câteva milisecunde.
 */
export async function getLeaderboard(): Promise<LeaderboardRow[]> {
  const { data, error } = await createAdminClient().rpc("leaderboard", {
    p_launch: serverEnv.launchDate,
  });
  if (error) throw error;

  type Row = {
    user_id: string;
    username: string;
    solved: number;
    points: number;
    first_try: number;
    today_status: TodayStatus;
    streak: number;
    prev_solved: number;
    prev_points: number;
    prev_first_try: number;
  };

  const now = (data as Row[]).map((r) => ({
    row: r,
    username: r.username,
    points: r.points,
    firstTry: r.first_try,
    solved: r.solved,
  }));
  const yesterday = now.map((n) => ({
    ...n,
    points: n.row.prev_points,
    firstTry: n.row.prev_first_try,
    solved: n.row.prev_solved,
  }));

  const ranks = rankAll(now);
  const prevRanks = rankAll(yesterday);

  return now
    .map((n, i): LeaderboardRow => {
      const hasPoints = n.points > 0;
      const hadPoints = n.row.prev_points > 0;
      const rank = ranks.get(n)!;
      return {
        rank,
        // Cine n-are puncte stă jos, la grămadă: săgeata lui n-ar spune nimic.
        rankChange: hasPoints && hadPoints ? prevRanks.get(yesterday[i])! - rank : 0,
        isNew: hasPoints && !hadPoints,
        userId: n.row.user_id,
        username: n.username,
        points: n.points,
        firstTry: n.firstTry,
        solved: n.solved,
        streak: n.row.streak,
        today: n.row.today_status,
      };
    })
    .sort((a, b) => a.rank - b.rank || a.username.localeCompare(b.username, "ro"));
}
