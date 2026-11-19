import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { compactKey, nameWords, roCollator } from "@/lib/text";

export type CatalogSong = { id: number; title: string; artist: string; createdAt: string };

/** Cât stau la vedere cererile închise și cât e „nouă” o piesă adăugată. */
export const RECENT_DAYS = 7;
const RECENT_MS = RECENT_DAYS * 24 * 60 * 60 * 1000;

export type SongRequest = {
  id: number;
  title: string;
  artist: string;
  youtubeUrl: string | null;
  status: "pending" | "added" | "rejected";
  requestedBy: string; // username
  votes: number;
  votedByMe: boolean;
  mine: boolean;
};

/** Câte cereri în așteptare poate avea un jucător deodată. */
export const MAX_PENDING_PER_USER = 10;

export class DedicationError extends Error {}

/** Piesele din joc, în ordine alfabetică. Se schimbă doar când adaugi piese. */
export async function listCatalog(): Promise<CatalogSong[]> {
  "use cache";
  cacheTag("songs");
  cacheLife("minutes");
  const { data, error } = await createAdminClient()
    .from("songs")
    .select("id, title, artist, createdAt:created_at")
    .eq("active", true);
  if (error) throw error;
  return (data as CatalogSong[]).sort((a, b) => roCollator.compare(a.title, b.title));
}

/**
 * Piesa e „nouă” dacă a intrat în joc după ziua lansării, în ultimele
 * `RECENT_DAYS` zile. Cele puse la lansare nu sunt noi.
 */
export function isNewSong(song: CatalogSong, now: number): boolean {
  const created = Date.parse(song.createdAt);
  return song.createdAt.slice(0, 10) > serverEnv.launchDate && now - created < RECENT_MS;
}

/**
 * Cererile vizibile: cele în așteptare (cele mai votate primele), plus cele
 * închise în ultimele `RECENT_DAYS` zile: adăugate (le vede toată lumea) și
 * respinse (le vede doar cine le-a cerut). Fără cache: se schimbă la fiecare vot.
 */
export async function listRequests(userId: string, now: number): Promise<SongRequest[]> {
  const since = new Date(now - RECENT_MS).toISOString();
  const { data, error } = await createAdminClient()
    .from("song_requests")
    .select(
      "id, title, artist, youtube_url, status, created_at, requested_by, requester:profiles!song_requests_requested_by_fkey (username), votes:song_request_votes (user_id)",
    )
    .or(`status.eq.pending,status_changed_at.gte.${since}`)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw error;

  type Row = {
    id: number;
    title: string;
    artist: string;
    youtube_url: string | null;
    status: SongRequest["status"];
    requested_by: string;
    requester: { username: string } | null;
    votes: { user_id: string }[];
  };

  return (data as unknown as Row[])
    .filter((r) => r.status !== "rejected" || r.requested_by === userId)
    .map((r) => ({
      id: Number(r.id),
      title: r.title,
      artist: r.artist,
      youtubeUrl: r.youtube_url,
      status: r.status,
      requestedBy: r.requester?.username ?? "?",
      votes: r.votes.length,
      votedByMe: r.votes.some((v) => v.user_id === userId),
      mine: r.requested_by === userId,
    }))
    .sort((a, b) => b.votes - a.votes);
}

/**
 * Tot ce arată pagina de dedicații. Ora se citește aici, la fiecare cerere
 * (apelantul a citit deja cookie-urile), nu în componentă.
 */
export async function getDedicationsPage(userId: string) {
  const now = Date.now();
  const [requests, catalog] = await Promise.all([listRequests(userId, now), listCatalog()]);
  const songs = catalog.map((s) => ({ id: s.id, title: s.title, artist: s.artist, isNew: isNewSong(s, now) }));
  return { requests, songs };
}

/** Aceeași piesă: același titlu (fără diacritice/semne) și cel puțin un cuvânt comun în artist. */
function samePiece(a: { title: string; artist: string }, b: { title: string; artist: string }) {
  if (compactKey(a.title) !== compactKey(b.title)) return false;
  const wordsB = nameWords(b.artist);
  return [...nameWords(a.artist)].some((w) => wordsB.has(w));
}

export type CreateResult =
  | { kind: "created"; title: string }
  | { kind: "voted"; title: string } // exista deja o cerere: i-am dat +1
  | { kind: "exists"; title: string }; // piesa e deja în joc

export async function createRequest(
  userId: string,
  input: { title: string; artist: string; youtubeUrl: string | null },
): Promise<CreateResult> {
  const admin = createAdminClient();

  const catalog = await listCatalog();
  const inGame = catalog.find((s) => samePiece(s, input));
  if (inGame) return { kind: "exists", title: inGame.title };

  const { data: open, error: openError } = await admin
    .from("song_requests")
    .select("id, title, artist, requested_by")
    .eq("status", "pending");
  if (openError) throw openError;

  const duplicate = open.find((r) => samePiece(r, input));
  if (duplicate) {
    await vote(userId, Number(duplicate.id), true);
    return { kind: "voted", title: duplicate.title };
  }

  if (open.filter((r) => r.requested_by === userId).length >= MAX_PENDING_PER_USER) {
    throw new DedicationError(
      `Ai deja ${MAX_PENDING_PER_USER} dedicații în așteptare. Mai așteaptă să fie adăugate.`,
    );
  }

  const { data: created, error } = await admin
    .from("song_requests")
    .insert({ title: input.title, artist: input.artist, youtube_url: input.youtubeUrl, requested_by: userId })
    .select("id")
    .single();
  if (error) throw error;
  await vote(userId, Number(created.id), true);
  return { kind: "created", title: input.title };
}

/** Pune (`on = true`) sau scoate votul userului. Doar pe cereri în așteptare. */
export async function vote(userId: string, requestId: number, on: boolean) {
  const admin = createAdminClient();
  const { data: request, error } = await admin
    .from("song_requests")
    .select("status, requested_by")
    .eq("id", requestId)
    .maybeSingle();
  if (error) throw error;
  if (!request || request.status !== "pending") throw new DedicationError("Cererea nu mai e deschisă.");
  if (!on && request.requested_by === userId) {
    throw new DedicationError("Nu-ți poți retrage votul de pe propria dedicație.");
  }

  const result = on
    ? await admin
        .from("song_request_votes")
        .upsert({ request_id: requestId, user_id: userId }, { onConflict: "request_id,user_id", ignoreDuplicates: true })
    : await admin.from("song_request_votes").delete().eq("request_id", requestId).eq("user_id", userId);
  if (result.error) throw result.error;
}
