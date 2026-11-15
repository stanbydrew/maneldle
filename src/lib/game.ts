import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { MAX_GUESSES, SKIP_ID, type GameState, type SongOption } from "@/lib/game-types";

const CLIP_URL_TTL_SECONDS = 5 * 60;

type SongRow = {
  id: number;
  title: string;
  artist: string;
  obscure_lyric: string;
  literary_comment: string;
  youtube_url: string | null;
  audio_path: string | null;
};

type PlayRow = {
  guesses: number[];
  solved: boolean;
  finished: boolean;
  is_late: boolean;
};

export class GameError extends Error {}

/** Data de azi în România, ca YYYY-MM-DD. */
export function todayRo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bucharest" }).format(new Date());
}

/** Piesa zilei: prima cerere din zi o alege, restul primesc același rând. */
export async function getTodayPuzzleDate(): Promise<string> {
  const date = await ensurePuzzle(todayRo());
  if (!date) throw new GameError("Nu există încă nicio piesă în joc.");
  return date;
}

// Odată ales, puzzle-ul unei zile nu se mai schimbă, deci RPC-ul rulează o
// singură dată pe zi (per server). `today` e doar cheia de cache.
async function ensurePuzzle(today: string): Promise<string | null> {
  "use cache";
  cacheTag(`puzzle-${today}`);
  cacheLife("hours");

  const { data, error } = await createAdminClient().rpc("get_today_puzzle");
  if (error) {
    // Fără piese active nu putem alege nimic; nu ținem rezultatul în cache.
    if (error.message.includes("Nu există nicio piesă activă")) {
      cacheLife("seconds");
      return null;
    }
    throw error;
  }
  const date = (data as { puzzle_date: string }).puzzle_date;
  // Exact la miezul nopții, ceasul bazei de date poate fi cu câteva milisecunde
  // în urmă și să întoarcă puzzle-ul de ieri. Nu-l ținem ore întregi sub cheia de azi.
  if (date !== today) cacheLife("seconds");
  return date;
}

/** Tag-ul de cache pentru progresul unui user (arhiva lui). */
export function playsTag(userId: string) {
  return `plays-${userId}`;
}

/**
 * Lista pentru autocomplete: doar id + titlu (artistul ar strica indiciul 2).
 * Se schimbă doar când adaugi piese în DB, deci o ținem în cache câteva minute.
 */
export async function listSongOptions(): Promise<SongOption[]> {
  "use cache";
  cacheTag("songs");
  cacheLife("minutes");
  const { data, error } = await createAdminClient()
    .from("songs")
    .select("id, title")
    .order("title");
  if (error) throw error;
  return data;
}

export type ArchiveEntry = {
  date: string;
  status: "won" | "lost" | "playing" | "unplayed";
  guesses: number;
  isLate: boolean;
};

/** Zilele trecute care au avut puzzle (cele mai recente primele), cu progresul userului. */
export async function listArchive(userId: string, today: string): Promise<ArchiveEntry[]> {
  "use cache";
  cacheTag(playsTag(userId));
  cacheLife("minutes"); // ca zilele adăugate manual în DB să apară repede

  const admin = createAdminClient();

  const [{ data: puzzles, error: puzzlesError }, { data: plays, error: playsError }] = await Promise.all([
    admin.from("daily_puzzles").select("puzzle_date").lt("puzzle_date", today).order("puzzle_date", { ascending: false }),
    admin.from("plays").select("puzzle_date, guesses, solved, finished, is_late").eq("user_id", userId).lt("puzzle_date", today),
  ]);
  if (puzzlesError) throw puzzlesError;
  if (playsError) throw playsError;

  const byDate = new Map(plays.map((p) => [p.puzzle_date as string, p]));
  return puzzles.map(({ puzzle_date: date }) => {
    const play = byDate.get(date);
    return {
      date,
      status: !play ? "unplayed" : play.solved ? "won" : play.finished ? "lost" : "playing",
      guesses: play?.guesses.length ?? 0,
      isLate: play?.is_late ?? false,
    };
  });
}

export async function getGameState(userId: string, date: string): Promise<GameState> {
  const { song, play } = await loadGame(userId, date);
  return buildState(date, song, play);
}

/**
 * Înregistrează o încercare. Toată validarea se face aici, pe server:
 * clientul trimite doar id-ul piesei ghicite.
 */
export async function submitGuess(userId: string, date: string, songId: number): Promise<GameState> {
  const admin = createAdminClient();

  const skip = songId === SKIP_ID;
  if (!skip) {
    const { data: guessed } = await admin.from("songs").select("id").eq("id", songId).maybeSingle();
    if (!guessed) throw new GameError("Piesa asta nu e în listă.");
  }

  // Două încercări: dacă alt request (dublu-click, alt tab) a scris între timp,
  // reîncărcăm și reîncercăm o dată.
  for (let attempt = 0; attempt < 2; attempt++) {
    const { song, play } = await loadGame(userId, date);
    const previous = play?.guesses ?? [];

    if (play?.finished) throw new GameError("Ai terminat deja puzzle-ul ăsta.");
    if (!skip && previous.includes(songId)) throw new GameError("Ai încercat deja piesa asta.");

    const guesses = [...previous, songId];
    const solved = songId === song.id;
    const finished = solved || guesses.length >= MAX_GUESSES;
    const changes = {
      guesses,
      solved,
      finished,
      finished_at: finished ? new Date().toISOString() : null,
    };

    let conflict: boolean;
    if (!play) {
      const { error } = await admin.from("plays").insert({
        user_id: userId,
        puzzle_date: date,
        is_late: date !== todayRo(),
        ...changes,
      });
      conflict = error?.code === "23505"; // rândul a fost creat de alt request
      if (error && !conflict) throw error;
    } else {
      // Actualizăm doar dacă încercările sunt încă cele citite mai sus.
      const { data, error } = await admin
        .from("plays")
        .update(changes)
        .eq("user_id", userId)
        .eq("puzzle_date", date)
        .eq("finished", false)
        .eq("guesses", `{${previous.join(",")}}`)
        .select("user_id");
      if (error) throw error;
      conflict = data.length === 0;
    }

    if (!conflict) {
      return buildState(date, song, { ...changes, is_late: play?.is_late ?? date !== todayRo() });
    }
  }

  throw new GameError("Ceva s-a încurcat. Reîncarcă pagina.");
}

async function loadGame(userId: string, date: string) {
  if (date > todayRo()) throw new GameError("Puzzle-ul ăsta nu e disponibil încă.");

  // Piesa zilei vine din cache; progresul userului se citește mereu proaspăt.
  const [song, { data: play, error: playError }] = await Promise.all([
    puzzleSong(date),
    createAdminClient()
      .from("plays")
      .select("guesses, solved, finished, is_late")
      .eq("user_id", userId)
      .eq("puzzle_date", date)
      .maybeSingle(),
  ]);
  if (playError) throw playError;
  if (!song) throw new GameError("Nu există puzzle pentru ziua asta.");

  return { song, play: play as PlayRow | null };
}

/** Piesa unei zile. Rămâne în cache câteva minute, ca editările din DB să ajungă repede. */
async function puzzleSong(date: string): Promise<SongRow | null> {
  "use cache";
  cacheTag(`puzzle-${date}`);
  cacheLife("minutes");

  const { data, error } = await createAdminClient()
    .from("daily_puzzles")
    .select(
      "song:songs!inner (id, title, artist, obscure_lyric, literary_comment, youtube_url, audio_path)",
    )
    .eq("puzzle_date", date)
    .maybeSingle();
  if (error) throw error;
  return data ? (data.song as unknown as SongRow) : null;
}

async function buildState(date: string, song: SongRow, play: PlayRow | null): Promise<GameState> {
  const guessIds = (play?.guesses ?? []).map(Number);
  const status: GameState["status"] = play?.solved ? "won" : play?.finished ? "lost" : "playing";
  const finished = status !== "playing";

  // Câte indicii vede userul: 1 la început, +1 după fiecare greșeală, toate la final.
  const unlocked = finished ? MAX_GUESSES : Math.min(guessIds.length + 1, MAX_GUESSES);

  const titles = await titlesById(guessIds);
  const hints: GameState["hints"] = { lyric: song.obscure_lyric };
  if (unlocked >= 2) hints.artist = song.artist;
  if (unlocked >= 3) hints.comment = song.literary_comment;
  if (unlocked >= 4) hints.audioUrl = await signedClipUrl(song.audio_path);

  return {
    date,
    isLate: play?.is_late ?? date !== todayRo(),
    status,
    guesses: guessIds.map((id) => ({
      songId: id,
      title: id === SKIP_ID ? "Sărit" : (titles.get(id) ?? "?"),
      correct: id === Number(song.id),
      skipped: id === SKIP_ID,
    })),
    hints,
    answer: finished
      ? { title: song.title, artist: song.artist, youtubeUrl: song.youtube_url }
      : undefined,
  };
}

async function titlesById(ids: number[]): Promise<Map<number, string>> {
  if (ids.length === 0) return new Map();
  const songs = await listSongOptions(); // din cache
  return new Map(songs.map((s) => [Number(s.id), s.title]));
}

async function signedClipUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await createAdminClient()
    .storage.from("clips")
    .createSignedUrl(path, CLIP_URL_TTL_SECONDS);
  if (error) {
    console.error("Nu am putut semna URL-ul fragmentului", path, error);
    return null;
  }
  return data.signedUrl;
}
