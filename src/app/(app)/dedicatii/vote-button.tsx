"use client";

import { useOptimistic, useState, useTransition } from "react";
import { voteAction } from "./actions";

type Props = { requestId: number; votes: number; voted: boolean; mine: boolean };

export function VoteButton({ requestId, votes, voted, mine }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Butonul se schimbă imediat; serverul confirmă după (sau revine dacă dă eroare).
  const [optimistic, setOptimistic] = useOptimistic({ votes, voted });

  function toggle() {
    const on = !optimistic.voted;
    setError(null);
    startTransition(async () => {
      setOptimistic({ votes: optimistic.votes + (on ? 1 : -1), voted: on });
      const result = await voteAction(requestId, on);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={mine || pending}
        aria-pressed={optimistic.voted}
        title={mine ? "Dedicația ta: votul tău e inclus" : optimistic.voted ? "Retrage +1" : "O vreau și eu"}
        className={`rounded-full border px-3 py-1 font-mono text-sm font-semibold transition disabled:cursor-default ${
          optimistic.voted
            ? "border-accent bg-accent text-accent-foreground"
            : "border-border text-muted hover:border-accent/60 hover:text-foreground"
        }`}
      >
        +1 · {optimistic.votes}
      </button>
      {error && <p className="max-w-40 text-right text-xs text-danger">{error}</p>}
    </div>
  );
}
