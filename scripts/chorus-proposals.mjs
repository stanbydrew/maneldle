#!/usr/bin/env node
// Propune pentru fiecare piesă „partea pe care o știe toată lumea”: fereastra
// cu cele mai multe reascultări din graficul YouTube „Cele mai redate”.
//
//   npm run chorus:propose               # toate piesele
//   npm run chorus:propose -- --id 12    # doar una (re-descarcă)
//   npm run chorus:propose -- --recompute  # recalculează din graficele salvate, fără descărcare
//
// Descarcă audio-ul complet în `.chorus-review/audio/` (local, ignorat de git)
// și scrie `.chorus-review/data.js`. Deschide `.chorus-review/index.html` în
// browser ca să asculți propunerile și să le corectezi.
// Nu modifică nimic în baza de date.

import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";

const WINDOW_SECONDS = 12;
// Începutul videoclipului are mereu un vârf (toată lumea apasă play), iar finalul e liniște.
const SKIP_START_SECONDS = 15;
const SKIP_END_SECONDS = 8;

const { values: args } = parseArgs({
  options: { id: { type: "string" }, recompute: { type: "boolean", default: false } },
});
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, ".chorus-review");
const audioDir = join(outDir, "audio");
mkdirSync(audioDir, { recursive: true });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
let query = supabase.from("songs").select("id, title, artist, youtube_url").not("youtube_url", "is", null).order("id");
if (args.id) query = query.eq("id", Number(args.id));
const { data: songs, error } = await query;
if (error) throw error;

const dataFile = join(outDir, "data.js");
const previous = existsSync(dataFile)
  ? JSON.parse(readFileSync(dataFile, "utf8").replace(/^window\.SONGS = /, "").replace(/;\s*$/, ""))
  : [];
const results = new Map(previous.map((s) => [s.id, s]));

// Sub acest prag, vârful e prea mic ca să fie sigur: pagina îl marchează „de verificat”.
const WEAK_SIGNAL = 0.04;
// Câte segmente (din ~100) de fiecare parte intră în tendința locală.
const TREND_HALF_WIDTH = 12;

/**
 * Graficul scade natural de la început spre final (lumea renunță pe parcurs), așa
 * că valoarea brută favorizează mereu începutul. Scădem tendința locală (mediana
 * vecinilor) și căutăm fereastra care iese cel mai mult în evidență față de ea:
 * partea pe care lumea o dă înapoi ca s-o reasculte.
 */
export function bestWindow(values, duration) {
  const n = values.length;
  const segment = duration / n;
  const residual = values.map((v, i) => {
    const near = values.slice(Math.max(0, i - TREND_HALF_WIDTH), i + TREND_HALF_WIDTH + 1).sort((a, b) => a - b);
    return v - near[near.length >> 1];
  });
  const at = (t) => residual[Math.min(n - 1, Math.floor(t / segment))];
  let best = null;
  for (let s = SKIP_START_SECONDS; s <= duration - SKIP_END_SECONDS - WINDOW_SECONDS; s += 0.5) {
    let sum = 0;
    let count = 0;
    for (let t = s; t < s + WINDOW_SECONDS; t += 0.25, count++) sum += at(t);
    if (!best || sum / count > best.score) best = { start: s, score: sum / count };
  }
  return best && { start: best.start, end: best.start + WINDOW_SECONDS, weak: best.score < WEAK_SIGNAL };
}

function download(song, workDir) {
  for (let attempt = 1; ; attempt++) {
    try {
      execFileSync(
        "yt-dlp",
        ["-f", "bestaudio", "--no-playlist", "--quiet", "--no-warnings", "--write-info-json",
          "-o", join(workDir, "source.%(ext)s"), song.youtube_url],
        { stdio: ["ignore", "ignore", "pipe"] },
      );
      return;
    } catch (err) {
      if (attempt >= 3) throw err;
    }
  }
}

let ok = 0;
for (const song of songs) {
  process.stdout.write(`#${song.id} ${song.title}: `);
  const cached = results.get(song.id);
  if (args.recompute && cached) {
    // Doar recalculează propunerea din graficul salvat, fără să descarce din nou.
    const proposal = cached.heatmap.length ? bestWindow(cached.heatmap, cached.duration) : null;
    Object.assign(cached, { start: proposal?.start ?? null, end: proposal?.end ?? null, weak: proposal?.weak ?? true });
    console.log(proposal ? `${proposal.start}s → ${proposal.end}s${proposal.weak ? " (semnal slab, de verificat)" : ""}` : "fără grafic");
    ok++;
    continue;
  }
  const workDir = join(outDir, `tmp-${song.id}`);
  rmSync(workDir, { recursive: true, force: true });
  mkdirSync(workDir);
  try {
    download(song, workDir);
    const info = JSON.parse(readFileSync(join(workDir, "source.info.json"), "utf8"));
    const source = readdirSync(workDir).find((f) => f.startsWith("source.") && !f.endsWith(".json"));
    const audio = `audio/${song.id}.${source.split(".").pop()}`;
    for (const f of readdirSync(audioDir)) if (f.startsWith(`${song.id}.`)) rmSync(join(audioDir, f));
    copyFileSync(join(workDir, source), join(outDir, audio));

    const heatmap = (info.heatmap ?? []).map((h) => Math.round(h.value * 100) / 100);
    const proposal = heatmap.length ? bestWindow(heatmap, info.duration) : null;
    results.set(song.id, {
      id: song.id,
      title: song.title,
      artist: song.artist,
      youtubeUrl: song.youtube_url,
      duration: info.duration,
      audio,
      heatmap,
      start: proposal?.start ?? null,
      end: proposal?.end ?? null,
      weak: proposal?.weak ?? true,
    });
    console.log(proposal ? `${proposal.start}s → ${proposal.end}s${proposal.weak ? " (semnal slab, de verificat)" : ""}` : "fără grafic „Cele mai redate”, alege manual");
    ok++;
  } catch (err) {
    console.log(`EȘUAT\n   ${err.stderr?.toString().trim() || err.message}`);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

const all = [...results.values()].sort((a, b) => a.id - b.id);
writeFileSync(dataFile, `window.SONGS = ${JSON.stringify(all)};\n`);
copyFileSync(join(root, "scripts", "chorus-review.html"), join(outDir, "index.html"));
console.log(`\n${ok}/${songs.length} piese procesate. Deschide .chorus-review/index.html`);
