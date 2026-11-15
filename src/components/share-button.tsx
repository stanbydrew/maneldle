"use client";

import { useState } from "react";
import { MAX_GUESSES, type GameState } from "@/lib/game-types";

/**
 * Textul de share, fără spoilere:
 *
 *   Maneldle 15 nov. 🎶 2/4
 *   🟥🟩⬛⬛
 *   https://…
 */
export function buildShareText(state: GameState, url: string): string {
  const won = state.status === "won";
  const score = won ? `${state.guesses.length}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`;
  const squares = Array.from({ length: MAX_GUESSES }, (_, i) => {
    const guess = state.guesses[i];
    return !guess ? "⬛" : guess.correct ? "🟩" : guess.skipped ? "⬜" : "🟥";
  }).join("");
  const day = new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${state.date}T00:00:00Z`),
  );

  return [`Maneldle ${day} 🎶 ${score}${state.isLate ? " (arhivă)" : ""}`, squares, url].join("\n");
}

export function ShareButton({ state }: { state: GameState }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const text = buildShareText(state, window.location.origin);

    // Pe telefon: meniul nativ de share (WhatsApp etc.). Pe desktop: clipboard.
    if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ text });
        return;
      } catch (error) {
        if ((error as Error).name === "AbortError") return; // userul a închis meniul
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copiază rezultatul:", text);
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className="rounded-lg border border-accent/60 px-4 py-2 font-semibold text-accent transition hover:bg-accent/10"
    >
      {copied ? "Copiat! ✓" : "Distribuie rezultatul"}
    </button>
  );
}
