// Tipuri partajate între server și browser. Fără `server-only`.

export const MAX_GUESSES = 4;

export type SongOption = { id: number; title: string };

export type GuessResult = { songId: number; title: string; correct: boolean };

export type GameState = {
  date: string; // YYYY-MM-DD
  isLate: boolean; // jucat din arhivă: nu dă puncte
  status: "playing" | "won" | "lost";
  guesses: GuessResult[];
  /** Doar indiciile deblocate. Restul nu pleacă de pe server. */
  hints: {
    lyric: string;
    artist?: string;
    comment?: string;
    audioUrl?: string | null; // null = deblocat, dar fragmentul nu există încă
  };
  /** Doar după finalul jocului. */
  answer?: { title: string; artist: string; youtubeUrl: string | null };
};

export type GuessResponse = { ok: true; state: GameState } | { ok: false; error: string };
