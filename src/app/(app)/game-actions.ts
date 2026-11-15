"use server";

import { updateTag } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { GameError, playsTag, submitGuess } from "@/lib/game";
import { LEADERBOARD_TAG } from "@/lib/leaderboard";
import { LIMITS, TOO_MANY_REQUESTS, withinLimit } from "@/lib/rate-limit";
import type { GuessResponse } from "@/lib/game-types";

export async function guessAction(date: unknown, songId: unknown): Promise<GuessResponse> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sesiunea a expirat. Intră din nou în cont." };
  if (!(await withinLimit(`guess:user:${user.id}`, LIMITS.guessPerUser))) {
    return { ok: false, error: TOO_MANY_REQUESTS };
  }

  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: "Dată invalidă." };
  }
  const id = Number(songId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return { ok: false, error: "Alege o piesă din listă." };
  }

  try {
    const state = await submitGuess(user.id, date, id);
    // Progresul userului s-a schimbat: invalidăm arhiva lui (și, odată cu ea,
    // paginile ținute în memorie de browser). Clasamentul se schimbă doar
    // când se termină o zi jucată la timp.
    updateTag(playsTag(user.id));
    if (state.status !== "playing" && !state.isLate) updateTag(LEADERBOARD_TAG);
    return { ok: true, state };
  } catch (error) {
    if (error instanceof GameError) return { ok: false, error: error.message };
    console.error("guessAction a eșuat", error);
    return { ok: false, error: "Ceva n-a mers. Încearcă din nou." };
  }
}
