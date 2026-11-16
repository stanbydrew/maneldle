#!/usr/bin/env node
// Generează fragmentele audio și le urcă în bucket-ul privat `clips`.
//
//   npm run clips                       # indiciile audio care lipsesc
//   npm run clips -- --force            # regenerează toate indiciile
//   npm run clips -- --id 3             # doar piesa cu id-ul 3 (regenerează)
//   npm run clips -- --chorus           # refrenele de la final care lipsesc
//   npm run clips -- --chorus --force   # (merge cu --force și --id la fel)
//
// Are nevoie de `yt-dlp` și `ffmpeg` în PATH. Pentru fiecare piesă cu
// `youtube_url` și început completat în tabela `songs`: descarcă audio-ul,
// taie intervalul, urcă un .mp3 cu nume aleator (ca numele fișierului să nu dea
// răspunsul) și completează coloana cu calea fișierului.
//
//   indiciu: [audio_start_seconds, audio_end_seconds]   → audio_path
//            (5s de la start dacă audio_end_seconds e gol)
//   refren:  [chorus_start_seconds, chorus_end_seconds] → chorus_path
//
// Dacă piesa e deja descărcată în `.chorus-review/audio/` (de la
// `npm run chorus:propose`), o folosește pe aceea în loc s-o descarce din nou.

import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_CLIP_SECONDS = 5;
const FADE_SECONDS = 0.15;
// Toate fragmentele la același volum, mai jos decât masterizarea agresivă a pieselor.
const LOUDNESS = "loudnorm=I=-18:TP=-2:LRA=11";
const BUCKET = "clips";

const { values: args } = parseArgs({
  options: {
    force: { type: "boolean", default: false },
    id: { type: "string" },
    chorus: { type: "boolean", default: false },
  },
});

const columns = args.chorus
  ? { start: "chorus_start_seconds", end: "chorus_end_seconds", path: "chorus_path", fadeOut: 0.6 }
  : { start: "audio_start_seconds", end: "audio_end_seconds", path: "audio_path", fadeOut: FADE_SECONDS };

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

const localAudioDir = join(dirname(fileURLToPath(import.meta.url)), "..", ".chorus-review", "audio");

let query = supabase
  .from("songs")
  .select(`id, title, youtube_url, ${columns.start}, ${columns.end}, ${columns.path}`)
  .not("youtube_url", "is", null)
  .not(columns.start, "is", null)
  .order("id");
if (args.id) query = query.eq("id", Number(args.id));
else if (!args.force) query = query.is(columns.path, null);

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
    const local = existsSync(localAudioDir)
      ? readdirSync(localAudioDir).find((f) => f.startsWith(`${song.id}.`))
      : undefined;
    let source;
    if (local) {
      process.stdout.write(`${label}: local… `);
      source = join(localAudioDir, local);
    } else {
      process.stdout.write(`${label}: descarc… `);
      execFileSync(
        "yt-dlp",
        ["-f", "bestaudio", "--no-playlist", "--quiet", "--no-warnings", "-o", join(workDir, "source.%(ext)s"), song.youtube_url],
        { stdio: ["ignore", "ignore", "pipe"] },
      );
      const downloaded = readdirSync(workDir).find((f) => f.startsWith("source."));
      if (!downloaded) throw new Error("yt-dlp nu a produs niciun fișier");
      source = join(workDir, downloaded);
    }

    process.stdout.write("tai… ");
    const start = Number(song[columns.start]);
    const end = song[columns.end] == null ? start + DEFAULT_CLIP_SECONDS : Number(song[columns.end]);
    const length = end - start;
    if (!(length > 0)) throw new Error(`interval invalid: ${start}s → ${end}s`);
    const fadeOut = Math.min(columns.fadeOut, length / 4);
    const output = join(workDir, "clip.mp3");
    execFileSync(
      "ffmpeg",
      [
        "-hide_banner", "-loglevel", "error",
        "-ss", String(start), "-t", String(length), "-i", source,
        "-af", `${LOUDNESS},afade=t=in:d=${FADE_SECONDS},afade=t=out:st=${length - fadeOut}:d=${fadeOut}`,
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

    const { error: updateError } = await supabase.from("songs").update({ [columns.path]: path }).eq("id", song.id);
    if (updateError) {
      await supabase.storage.from(BUCKET).remove([path]);
      throw updateError;
    }
    if (song[columns.path]) await supabase.storage.from(BUCKET).remove([song[columns.path]]);

    console.log(`gata (${start}s → ${end}s, ${+length.toFixed(2)}s)`);
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
