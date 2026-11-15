#!/usr/bin/env node
// Generează fragmentele audio de 5 secunde și le urcă în bucket-ul privat `clips`.
//
//   npm run clips                 # piesele care nu au încă fragment
//   npm run clips -- --force      # regenerează toate fragmentele
//   npm run clips -- --id 3       # doar piesa cu id-ul 3 (regenerează)
//
// Are nevoie de `yt-dlp` și `ffmpeg` în PATH. Pentru fiecare piesă cu
// `youtube_url` și `audio_start_seconds` completate în tabela `songs`:
// descarcă audio-ul, taie [start, start + 5s], urcă un .mp3 cu nume aleator
// (ca numele fișierului să nu dea răspunsul) și completează `audio_path`.

import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";

const CLIP_SECONDS = 5;
const FADE_SECONDS = 0.15;
// Toate fragmentele la același volum, mai jos decât masterizarea agresivă a pieselor.
const LOUDNESS = "loudnorm=I=-18:TP=-2:LRA=11";
const BUCKET = "clips";

const { values: args } = parseArgs({
  options: { force: { type: "boolean", default: false }, id: { type: "string" } },
});

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) {
  console.error("Lipsesc variabilele Supabase. Rulează cu: npm run clips");
  process.exit(1);
}
const supabase = createClient(url, secretKey, { auth: { persistSession: false } });

for (const tool of [["yt-dlp", "--version"], ["ffmpeg", "-version"]]) {
  try {
    execFileSync(tool[0], [tool[1]], { stdio: "ignore" });
  } catch {
    console.error(`Nu găsesc ${tool[0]} în PATH.`);
    process.exit(1);
  }
}

let query = supabase
  .from("songs")
  .select("id, title, youtube_url, audio_start_seconds, audio_path")
  .not("youtube_url", "is", null)
  .not("audio_start_seconds", "is", null)
  .order("id");
if (args.id) query = query.eq("id", Number(args.id));
else if (!args.force) query = query.is("audio_path", null);

const { data: songs, error } = await query;
if (error) throw error;
if (songs.length === 0) {
  console.log("Nimic de făcut: toate piesele au fragment (folosește --force ca să le regenerezi).");
  process.exit(0);
}

let ok = 0;
for (const song of songs) {
  const label = `#${song.id} ${song.title}`;
  const workDir = mkdtempSync(join(tmpdir(), "maneldle-clip-"));
  try {
    process.stdout.write(`${label}: descarc… `);
    execFileSync(
      "yt-dlp",
      ["-f", "bestaudio", "--no-playlist", "--quiet", "--no-warnings", "-o", join(workDir, "source.%(ext)s"), song.youtube_url],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    const source = readdirSync(workDir).find((f) => f.startsWith("source."));
    if (!source) throw new Error("yt-dlp nu a produs niciun fișier");

    process.stdout.write("tai… ");
    const start = Number(song.audio_start_seconds);
    const output = join(workDir, "clip.mp3");
    execFileSync(
      "ffmpeg",
      [
        "-hide_banner", "-loglevel", "error",
        "-ss", String(start), "-t", String(CLIP_SECONDS), "-i", join(workDir, source),
        "-af", `${LOUDNESS},afade=t=in:d=${FADE_SECONDS},afade=t=out:st=${CLIP_SECONDS - FADE_SECONDS}:d=${FADE_SECONDS}`,
        "-map_metadata", "-1", // fără titlu/artist în metadatele fișierului
        "-ac", "2", "-ar", "44100", "-b:a", "128k",
        output,
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );

    process.stdout.write("urc… ");
    const path = `${randomUUID()}.mp3`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, readFileSync(output), { contentType: "audio/mpeg" });
    if (uploadError) throw uploadError;

    const { error: updateError } = await supabase.from("songs").update({ audio_path: path }).eq("id", song.id);
    if (updateError) {
      await supabase.storage.from(BUCKET).remove([path]);
      throw updateError;
    }
    if (song.audio_path) await supabase.storage.from(BUCKET).remove([song.audio_path]);

    console.log(`gata (${start}s → ${start + CLIP_SECONDS}s)`);
    ok++;
  } catch (err) {
    const detail = err.stderr?.toString().trim() || err.message;
    console.log(`EȘUAT\n   ${detail}`);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

console.log(`\n${ok}/${songs.length} fragmente generate.`);
process.exit(ok === songs.length ? 0 : 1);
