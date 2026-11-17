import "server-only";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export type LeaderboardRow = {
  rank: number;
  userId: string;
  username: string;
  solved: number;
  totalDays: number;
  points: number;
  firstTry: number;
};

/**
 * Clasamentul, ordonat după ghicite ↓, apoi puncte ↓ (calculat în Postgres,
 * vezi funcția `leaderboard` din migrare). Cei egali la ambele au același loc.
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
    total_days: number;
    points: number;
    first_try: number;
  };

  let rank = 0;
  let previous: Row | null = null;
  return (data as Row[]).map((row) => {
    const tied = previous && previous.solved === row.solved && previous.points === row.points;
    if (!tied) rank += 1; // egalii împart locul, următorul ia locul imediat următor (1 2 3 4 4 4 5)
    previous = row;
    return {
      rank,
      userId: row.user_id,
      username: row.username,
      solved: row.solved,
      totalDays: row.total_days,
      points: row.points,
      firstTry: row.first_try,
    };
  });
}
