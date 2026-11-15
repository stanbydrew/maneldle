"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { guessAction } from "@/app/(app)/game-actions";
import { celebrate, lossFeedback, preloadEndSounds, wrongGuessFeedback } from "@/lib/celebrate";
import { MAX_GUESSES, SKIP_ID, type GameState, type SongOption } from "@/lib/game-types";
import { Hints } from "./hints";
import { ShareButton } from "./share-button";
import { SongAutocomplete } from "./song-autocomplete";

type Props = { initialState: GameState; songs: SongOption[] };

export function Game({ initialState, songs }: Props) {
  const [state, setState] = useState(initialState);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const resultRef = useRef<HTMLDivElement>(null);
  const [justFinished, setJustFinished] = useState(false);
  // Indiciul tocmai deblocat (după o greșeală sau un skip), ca să-l aducem în vizor.
  const [revealed, setRevealed] = useState<{ index: number; seq: number } | null>(null);

  // Sunetele de final se încarcă din timp doar dacă jocul e încă în curs.
  const playing = initialState.status === "playing";
  useEffect(() => {
    if (playing) preloadEndSounds();
  }, [playing]);

  // Când jocul tocmai s-a terminat, derulăm până la ecranul de final.
  useEffect(() => {
    if (justFinished) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [justFinished]);

  function sendGuess(songId: number) {
    setError(null);
    startTransition(async () => {
      const result = await guessAction(state.date, songId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setState(result.state);

      // Efectele apar doar în momentul răspunsului, nu când reîncarci o zi terminată.
      const { status } = result.state;
      if (status === "won") celebrate();
      else if (status === "lost") lossFeedback();
      else if (songId !== SKIP_ID) wrongGuessFeedback();
      if (status !== "playing") setJustFinished(true);
      else setRevealed((r) => ({ index: result.state.guesses.length, seq: (r?.seq ?? 0) + 1 }));
    });
  }

  const finished = state.status !== "playing";
  const lastAttempt = state.guesses.length === MAX_GUESSES - 1;

  function skip() {
    // Pe ultima încercare, „sari peste” înseamnă că pierzi: cerem confirmare.
    if (lastAttempt && !window.confirm("E ultima încercare. Sigur vrei să vezi răspunsul?")) return;
    sendGuess(SKIP_ID);
  }

  return (
    <div className="flex flex-col gap-6">
      {state.isLate && (
        <p className="rounded-lg bg-surface px-3 py-2 text-center text-sm text-muted">
          Puzzle din arhivă ({state.date}): nu aduce puncte.
        </p>
      )}

      {finished && state.answer ? (
        <div ref={resultRef} className="scroll-mt-6">
          <Result state={state} />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <SongAutocomplete
            songs={songs}
            excludeIds={state.guesses.map((g) => g.songId)}
            disabled={pending}
            onSubmit={(song) => sendGuess(song.id)}
            onSkip={skip}
            lastAttempt={lastAttempt}
          />
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
        </div>
      )}

      <Hints hints={state.hints} revealed={revealed} />

      <GuessSlots guesses={state.guesses} />
    </div>
  );
}

function GuessSlots({ guesses }: { guesses: GameState["guesses"] }) {
  return (
    <ul className="grid grid-cols-1 gap-2" aria-label="Încercări">
      {Array.from({ length: MAX_GUESSES }, (_, i) => {
        const guess = guesses[i];
        const base = "flex h-11 items-center gap-2 rounded-lg border px-3 text-sm";
        if (!guess) {
          return <li key={i} className={`${base} border-border/60 text-muted`}>{i + 1}.</li>;
        }
        if (guess.skipped) {
          return (
            <li key={i} className={`${base} border-border bg-surface text-muted`}>
              <span aria-hidden>⏭️</span>
              <span>Sărit</span>
            </li>
          );
        }
        return (
          <li
            key={i}
            className={`${base} ${
              guess.correct
                ? "border-success/50 bg-success/15 text-success"
                : "border-danger/40 bg-danger/10 text-danger"
            }`}
          >
            <span aria-hidden>{guess.correct ? "✅" : "❌"}</span>
            <span className="truncate">{guess.title}</span>
          </li>
        );
      })}
    </ul>
  );
}

function Result({ state }: { state: GameState }) {
  const won = state.status === "won";
  const answer = state.answer!;

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-accent/40 bg-accent/10 p-5 text-center">
      <p className="text-2xl font-black">
        {won ? (state.guesses.length === 1 ? "Din prima! 🔥" : "Bravo, frate! 🎉") : "Nu de data asta 😔"}
      </p>
      <p className="text-muted">
        {won
          ? `Ai ghicit din ${state.guesses.length} ${state.guesses.length === 1 ? "încercare" : "încercări"}.`
          : "Piesa era:"}
      </p>
      <p>
        <span className="block text-lg font-semibold">{answer.title}</span>
        <span className="text-muted">{answer.artist}</span>
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {answer.youtubeUrl && (
          <a
            href={answer.youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-accent px-4 py-2 font-semibold text-accent-foreground transition hover:brightness-110"
          >
            Ascult-o pe YouTube ↗
          </a>
        )}
        <ShareButton state={state} />
      </div>
      {!state.isLate && <p className="text-sm text-muted">Revino mâine pentru o piesă nouă.</p>}
    </div>
  );
}
