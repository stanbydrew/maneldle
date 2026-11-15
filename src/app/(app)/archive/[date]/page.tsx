import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Game } from "@/components/game";
import { GameSkeleton } from "@/components/game-skeleton";
import { requireUser } from "@/lib/auth";
import { GameError, getGameState, listSongOptions, todayRo } from "@/lib/game";

export const metadata = { title: "Arhivă · Maneldle" };

export default function ArchiveDayPage({ params }: PageProps<"/archive/[date]">) {
  return (
    <div className="flex flex-col gap-4">
      <Link href="/archive" className="text-sm text-muted transition hover:text-foreground">
        ← Înapoi la arhivă
      </Link>
      <Suspense fallback={<GameSkeleton />}>
        <ArchiveGame params={params} />
      </Suspense>
    </div>
  );
}

async function ArchiveGame({ params }: { params: PageProps<"/archive/[date]">["params"] }) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const user = await requireUser();
  if (date >= todayRo()) redirect("/"); // ziua de azi se joacă pe pagina principală

  const data = await loadGame(user.id, date);
  if ("error" in data) {
    return <p className="py-12 text-center text-muted">{data.error}</p>;
  }
  return <Game key={date} initialState={data.state} songs={data.songs} />;
}

async function loadGame(userId: string, date: string) {
  try {
    const [state, songs] = await Promise.all([getGameState(userId, date), listSongOptions()]);
    return { state, songs };
  } catch (error) {
    if (error instanceof GameError) return { error: error.message };
    throw error;
  }
}
