#!/usr/bin/env node
// Pagină locală pentru piesele cerute la Dedicații care nu sunt încă în joc.
//
//   npm run songs:intake        → deschide http://localhost:4321
//
// Pentru fiecare cerere în așteptare: verifici linkul YouTube, corectezi titlul și
// artistul, scrii versul obscur (indiciul 1) și versul din refren (indiciul 5) și
// alegi cele două intervale audio (indiciul 4 și refrenul de la victorie),
// ascultând direct în pagină.
//
// Totul se salvează automat în `.song-intake/drafts.json` (local, ignorat de git).
// Nu scrie nimic în baza de date: comentariul literar și emoji-ul se adaugă după,
// apoi piesele intră în `songs`.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { compactKey, nameWords } from "../src/lib/text.ts";

const PORT = 4321;
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, ".song-intake");
const draftsFile = join(outDir, "drafts.json");
const pageFile = join(root, "scripts", "song-intake.html");
mkdirSync(outDir, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) {
  console.error("Lipsesc variabilele Supabase. Rulează cu: npm run songs:intake");
  process.exit(1);
}
const supabase = createClient(url, secretKey, { auth: { persistSession: false } });

/** Aceeași piesă: același titlu și cel puțin un cuvânt comun în artist (ca în src/lib/dedications.ts). */
function samePiece(a, b) {
  if (compactKey(a.title) !== compactKey(b.title)) return false;
  const wordsB = nameWords(b.artist);
  return [...nameWords(a.artist)].some((w) => wordsB.has(w));
}

function readDrafts() {
  if (!existsSync(draftsFile)) return {};
  return JSON.parse(readFileSync(draftsFile, "utf8"));
}

function writeDrafts(drafts) {
  // Scris întâi în alt fișier și apoi mutat, ca să nu rămână pe jumătate dacă oprești serverul.
  const tmp = `${draftsFile}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(drafts, null, 2)}\n`);
  renameSync(tmp, draftsFile);
}

async function listRequests() {
  const [requests, songs] = await Promise.all([
    supabase
      .from("song_requests")
      .select(
        "id, title, artist, youtube_url, created_at, requester:profiles!song_requests_requested_by_fkey (username), votes:song_request_votes (user_id)",
      )
      .eq("status", "pending"),
    supabase.from("songs").select("title, artist"),
  ]);
  if (requests.error) throw requests.error;
  if (songs.error) throw songs.error;

  return requests.data
    .filter((r) => !songs.data.some((s) => samePiece(s, r)))
    .map((r) => ({
      id: Number(r.id),
      title: r.title,
      artist: r.artist,
      youtubeUrl: r.youtube_url,
      requestedBy: r.requester?.username ?? "?",
      votes: r.votes.length,
      createdAt: r.created_at,
    }))
    .sort((a, b) => b.votes - a.votes || a.createdAt.localeCompare(b.createdAt));
}

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, `http://localhost:${PORT}`).pathname;

    if (req.method === "GET" && path === "/") {
      return send(res, 200, readFileSync(pageFile, "utf8"), "text/html; charset=utf-8");
    }
    if (req.method === "GET" && path === "/api/data") {
      return send(res, 200, { requests: await listRequests(), drafts: readDrafts() });
    }
    if (req.method === "PUT" && path.startsWith("/api/drafts/")) {
      const id = Number(path.slice("/api/drafts/".length));
      if (!Number.isSafeInteger(id) || id <= 0) return send(res, 400, { error: "id invalid" });
      const draft = await readBody(req);
      const drafts = readDrafts();
      drafts[id] = { ...draft, requestId: id, savedAt: new Date().toISOString() };
      writeDrafts(drafts);
      return send(res, 200, { ok: true, savedAt: drafts[id].savedAt });
    }
    send(res, 404, { error: "not found" });
  } catch (error) {
    console.error(error);
    send(res, 500, { error: String(error?.message ?? error) });
  }
});

// Doar pe calculatorul tău: serverul folosește cheia secretă Supabase.
server.listen(PORT, "127.0.0.1", () => {
  console.log(`Piese noi: http://localhost:${PORT}`);
  console.log(`Ciornele se salvează în ${draftsFile}`);
});
