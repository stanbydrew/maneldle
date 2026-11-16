// Tipuri partajate între server și browser. Fără `server-only`.

export const MAX_GUESSES = 4;

/** Id-ul folosit pentru „Sari peste”: consumă o încercare și deblochează indiciul următor. */
export const SKIP_ID = 0;

export type SongOption = { id: number; title: string };

export type GuessResult = { songId: number; title: string; correct: boolean; skipped: boolean };

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
  answer?: { title: string; artist: string; youtubeUrl: string | null; chorusUrl: string | null };
};

export type GuessResponse = { ok: true; state: GameState } | { ok: false; error: string };
