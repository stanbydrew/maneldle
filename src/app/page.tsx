import { Suspense } from "react";
import { Game } from "@/components/game";
import { SoundToggle } from "@/components/sound-toggle";
import { requireUser } from "@/lib/auth";
import { GameError, getGameState, getTodayPuzzleDate, listSongOptions } from "@/lib/game";
import { logout } from "./(auth)/actions";

// Cu `cacheComponents` activ, tot ce depinde de request (cookie-uri, userul
// logat) trebuie pus în <Suspense>. Restul paginii e prerandat static.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-black tracking-tight">
          Manel<span className="text-accent">dle</span>
        </h1>
        <div className="flex items-center gap-3">
          <SoundToggle />
          <Suspense fallback={<span className="h-5 w-24 animate-pulse rounded bg-surface" />}>
            <UserMenu />
          </Suspense>
        </div>
      </header>

      <Suspense fallback={<GameSkeleton />}>
        <TodayGame />
      </Suspense>
    </main>
  );
}

async function UserMenu() {
  const user = await requireUser();
  return (
    <form action={logout} className="flex items-center gap-3 text-sm">
      <span className="text-muted">{user.username}</span>
      <button type="submit" className="text-accent underline-offset-4 hover:underline">
        Ieși
      </button>
    </form>
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

function GameSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-20 animate-pulse rounded-xl bg-surface" />
      ))}
    </div>
  );
}
