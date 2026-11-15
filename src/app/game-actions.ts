"use server";

import { getCurrentUser } from "@/lib/auth";
import { GameError, submitGuess } from "@/lib/game";
import type { GuessResponse } from "@/lib/game-types";

export async function guessAction(date: unknown, songId: unknown): Promise<GuessResponse> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sesiunea a expirat. Intră din nou în cont." };

  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: "Dată invalidă." };
  }
  const id = Number(songId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return { ok: false, error: "Alege o piesă din listă." };
  }

  try {
    return { ok: true, state: await submitGuess(user.id, date, id) };
  } catch (error) {
    if (error instanceof GameError) return { ok: false, error: error.message };
    console.error("guessAction a eșuat", error);
    return { ok: false, error: "Ceva n-a mers. Încearcă din nou." };
  }
}
