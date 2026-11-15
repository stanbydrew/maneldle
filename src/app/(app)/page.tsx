import { Suspense } from "react";
import { Game } from "@/components/game";
import { GameSkeleton } from "@/components/game-skeleton";
import { requireUser } from "@/lib/auth";
import { GameError, getGameState, getTodayPuzzleDate, listSongOptions } from "@/lib/game";

export default function TodayPage() {
  return (
    <Suspense fallback={<GameSkeleton />}>
      <TodayGame />
    </Suspense>
  );
}

async function TodayGame() {
  const user = await requireUser();
  const data = await loadTodayGame(user.id);
  if ("error" in data) {
    return <p className="py-12 text-center text-muted">{data.error}</p>;
  }
  return <Game key={data.state.date} initialState={data.state} songs={data.songs} />;
}

async function loadTodayGame(userId: string) {
  try {
    const date = await getTodayPuzzleDate();
    const [state, songs] = await Promise.all([getGameState(userId, date), listSongOptions()]);
    return { state, songs };
  } catch (error) {
    if (error instanceof GameError) return { error: error.message };
    throw error;
  }
}
