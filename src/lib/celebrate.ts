"use client";

import confetti from "canvas-confetti";
import { getSoundSettings } from "@/lib/sound-settings";

// Efectele de final de încercare: la victorie confetti + o bucată de manea,
// la pierdere altă bucată (fișiere din public/sounds), iar la o încercare
// greșită un „bonk” sintetizat cu Web Audio.

const WIN_SOUND = "/sounds/win.mp3";
const LOSE_SOUND = "/sounds/lose.mp3";
const sounds = new Map<string, HTMLAudioElement>();

/** Încarcă din timp sunetele de final, ca să pornească instant. */
export function preloadEndSounds() {
  for (const src of [WIN_SOUND, LOSE_SOUND]) getSound(src);
}

function getSound(src: string) {
  let audio = sounds.get(src);
  if (!audio) {
    audio = new Audio(src);
    audio.preload = "auto";
    sounds.set(src, audio);
  }
  return audio;
}

function playFile(src: string) {
  const settings = getSoundSettings();
  if (settings.effectsMuted) return;
  // Oprim fragmentul-indiciu, dacă rulează, ca să nu se suprapună.
  document.querySelectorAll("audio").forEach((el) => el.pause());
  const audio = getSound(src);
  audio.volume = settings.clipVolume;
  audio.currentTime = 0;
  audio.play().catch(() => {}); // browserul poate bloca redarea; nu e grav
}

const COLORS = ["#f5c542", "#ffffff", "#ff4fa3", "#8b5cf6", "#4ade80"];

/** Victorie: confetti + manea de victorie. */
export function celebrate() {
  launchConfetti();
  playFile(WIN_SOUND);
}

/** Încercare greșită, dar jocul continuă: un „bonk” scurt. */
export function wrongGuessFeedback() {
  play(0.14, (ctx, out) => {
    tone(ctx, out, { type: "square", from: 220, to: 110, start: 0, length: 0.22, volume: 0.5 });
    tone(ctx, out, { type: "sine", from: 110, to: 70, start: 0, length: 0.25, volume: 1 });
  });
}

/** Ultima încercare ratată: maneaua de consolare. */
export function lossFeedback() {
  playFile(LOSE_SOUND);
}

function launchConfetti() {
  const base = { colors: COLORS, disableForReducedMotion: true, zIndex: 100 };

  // O explozie din centru, apoi două „tunuri” din lateral.
  confetti({ ...base, particleCount: 120, spread: 90, startVelocity: 45, origin: { y: 0.6 } });

  const end = Date.now() + 1200;
  (function frame() {
    confetti({ ...base, particleCount: 4, angle: 60, spread: 55, origin: { x: 0, y: 0.75 } });
    confetti({ ...base, particleCount: 4, angle: 120, spread: 55, origin: { x: 1, y: 0.75 } });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

// ---------------------------------------------------------------------------
// Mini-sintetizator
// ---------------------------------------------------------------------------

type ToneOptions = {
  type: OscillatorType;
  from: number; // Hz
  to?: number; // Hz, pentru glissando
  start: number; // secunde de la începutul sunetului
  length: number; // secunde
  volume: number; // 0..1
  vibrato?: boolean;
};

/** Creează un AudioContext, rulează `build`, apoi îl închide când se termină. */
function play(masterVolume: number, build: (ctx: AudioContext, out: AudioNode) => void) {
  const AudioCtx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx || getSoundSettings().effectsMuted) return;

  const ctx = new AudioCtx();
  const master = ctx.createGain();
  master.gain.value = masterVolume;
  master.connect(ctx.destination);

  build(ctx, master);
  setTimeout(() => ctx.close(), 3000);
}

function tone(ctx: AudioContext, out: AudioNode, o: ToneOptions) {
  const t = ctx.currentTime + o.start;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = o.type;
  osc.frequency.setValueAtTime(o.from, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + o.length);

  if (o.vibrato) {
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = 6;
    depth.gain.value = o.from * 0.02;
    lfo.connect(depth).connect(osc.frequency);
    lfo.start(t);
    lfo.stop(t + o.length);
  }

  // Atac rapid, apoi stingere exponențială: sună a notă, nu a beep.
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(o.volume, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + o.length);

  // Filtru trece-jos: îmblânzește undele „aspre” (square/sawtooth).
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 2200;

  osc.connect(filter).connect(gain).connect(out);
  osc.start(t);
  osc.stop(t + o.length + 0.05);
}
