"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createRequest, DedicationError, vote } from "@/lib/dedications";
import { LIMITS, TOO_MANY_REQUESTS, withinLimit } from "@/lib/rate-limit";

export type DedicationFormState = { ok?: string; error?: string };

const YOUTUBE_URL = /^https:\/\/(www\.|m\.|music\.)?(youtube\.com\/(watch\?|shorts\/)|youtu\.be\/)\S+$/;

function field(input: unknown, name: string) {
  const value = input && typeof input === "object" ? (input as Record<string, unknown>)[name] : undefined;
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

export async function requestSongAction(input: unknown): Promise<DedicationFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sesiunea a expirat. Intră din nou în cont." };

  const title = field(input, "title");
  const artist = field(input, "artist");
  const youtubeUrl = field(input, "youtubeUrl") || null;
  if (!title || title.length > 100) return { error: "Scrie titlul piesei (maxim 100 de caractere)." };
  if (!artist || artist.length > 80) return { error: "Scrie artistul (maxim 80 de caractere)." };
  if (youtubeUrl && (youtubeUrl.length > 200 || !YOUTUBE_URL.test(youtubeUrl))) {
    return { error: "Linkul trebuie să fie de pe YouTube (youtube.com sau youtu.be)." };
  }

  if (!(await withinLimit(`dedication:user:${user.id}`, LIMITS.dedicationPerUser))) {
    return { error: TOO_MANY_REQUESTS };
  }

  try {
    const result = await createRequest(user.id, { title, artist, youtubeUrl });
    refresh();
    switch (result.kind) {
      case "created":
        return { ok: `Am primit dedicația pentru „${result.title}”. 🎶` };
      case "voted":
        return { ok: `„${result.title}” a cerut-o deja cineva. Ți-am adăugat +1.` };
      case "exists":
        return { error: `„${result.title}” e deja în joc. Caut-o în lista de mai jos.` };
    }
  } catch (error) {
    if (error instanceof DedicationError) return { error: error.message };
    console.error("requestSongAction a eșuat", error);
    return { error: "Ceva n-a mers. Încearcă din nou." };
  }
}

export async function voteAction(requestId: unknown, on: unknown): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sesiunea a expirat. Intră din nou în cont." };
  const id = Number(requestId);
  if (!Number.isSafeInteger(id) || id <= 0 || typeof on !== "boolean") return { error: "Cerere invalidă." };
  if (!(await withinLimit(`vote:user:${user.id}`, LIMITS.votePerUser))) return { error: TOO_MANY_REQUESTS };

  try {
    await vote(user.id, id, on);
    refresh();
    return {};
  } catch (error) {
    if (error instanceof DedicationError) return { error: error.message };
    console.error("voteAction a eșuat", error);
    return { error: "Ceva n-a mers. Încearcă din nou." };
  }
}
