import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export const LEADERBOARD_TAG = "leaderboard";

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
 * Cache-uit pe server: se schimbă doar când cineva termină o zi (atunci
 * `guessAction` șterge tag-ul `leaderboard`) sau când începe o zi nouă
 * (`today` face parte din cheia de cache).
 */
export async function getLeaderboard(today: string): Promise<LeaderboardRow[]> {
  "use cache";
  cacheTag(LEADERBOARD_TAG, `leaderboard-${today}`);
  cacheLife("hours");

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
  return (data as Row[]).map((row, index) => {
    const tied = previous && previous.solved === row.solved && previous.points === row.points;
    if (!tied) rank = index + 1;
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
