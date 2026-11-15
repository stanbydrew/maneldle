"use client";

import confetti from "canvas-confetti";

// Efectele de final de încercare: sunete sintetizate cu Web Audio (fără
// fișiere audio) și confetti la victorie.

const COLORS = ["#f5c542", "#ffffff", "#ff4fa3", "#8b5cf6", "#4ade80"];

/** Victorie: confetti + jingle ascendent. */
export function celebrate() {
  launchConfetti();
  playVictoryJingle();
}

/** Încercare greșită, dar jocul continuă: un „bonk” scurt. */
export function wrongGuessFeedback() {
  play(0.14, (ctx, out) => {
    tone(ctx, out, { type: "square", from: 220, to: 110, start: 0, length: 0.22, volume: 0.5 });
    tone(ctx, out, { type: "sine", from: 110, to: 70, start: 0, length: 0.25, volume: 1 });
  });
}

/** Ultima încercare ratată: „trombonul trist” (wah wah wah waaah). */
export function lossFeedback() {
  play(0.12, (ctx, out) => {
    const notes: [number, number, number][] = [
      // [frecvență, start, durată]
      [392.0, 0, 0.32], // sol
      [369.99, 0.36, 0.32], // fa#
      [349.23, 0.72, 0.32], // fa
      [329.63, 1.08, 1.0], // mi, lung
    ];
    for (const [frequency, start, length] of notes) {
      tone(ctx, out, { type: "sawtooth", from: frequency, to: frequency * 0.97, start, length, volume: 0.6, vibrato: start > 1 });
    }
  });
}

function playVictoryJingle() {
  play(0.18, (ctx, out) => {
    const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5;
    const notes: [number[], number, number][] = [
      // [frecvențe, start, durată]
      [[C5], 0, 0.14],
      [[E5], 0.12, 0.14],
      [[G5], 0.24, 0.14],
      [[C6], 0.36, 0.2],
      [[C5, E5, G5, C6], 0.56, 0.9],
    ];
    for (const [frequencies, start, length] of notes) {
      for (const frequency of frequencies) {
        tone(ctx, out, { type: "triangle", from: frequency, start, length, volume: 1 / frequencies.length });
      }
    }
  });
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
  if (!AudioCtx) return;

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
