// Tipuri partajate între server și browser. Fără `server-only`.

export const MAX_GUESSES = 5;

/** Id-ul folosit pentru „Sari peste”: consumă o încercare și deblochează indiciul următor. */
export const SKIP_ID = 0;

export type SongOption = { id: number; title: string; artist: string };

export type GuessResult = { songId: number; title: string; correct: boolean; skipped: boolean };

export type GameState = {
  date: string; // YYYY-MM-DD
  isLate: boolean; // jucat din arhivă: nu dă puncte
  status: "playing" | "won" | "lost";
  guesses: GuessResult[];
  /** Doar indiciile deblocate. Restul nu pleacă de pe server. */
  hints: {
    lyric: string;
    comment?: string; // 2
    emoji?: string | null; // 3 (null = deblocat, dar încă necompletat)
    audioUrl?: string | null; // 4 (null = deblocat, dar fragmentul nu există încă)
    chorusLyric?: string | null; // 5
  };
  /** Doar după finalul jocului. */
  answer?: { title: string; artist: string; youtubeUrl: string | null; chorusUrl: string | null };
};

export type GuessResponse = { ok: true; state: GameState } | { ok: false; error: string };
