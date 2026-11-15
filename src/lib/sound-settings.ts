"use client";

import { useSyncExternalStore } from "react";

// Preferințele de sunet ale userului, ținute în browser (localStorage).
// Sunt doar comodități: dacă localStorage nu e disponibil (mod privat etc.),
// totul merge cu valorile implicite.

export type SoundSettings = {
  effectsMuted: boolean; // bonk / trombon / jingle
  clipVolume: number; // 0..1, volumul fragmentului audio
};

const STORAGE_KEY = "maneldle:sound";
const DEFAULTS: SoundSettings = { effectsMuted: false, clipVolume: 0.6 };

let current: SoundSettings | null = null;
const listeners = new Set<() => void>();

function read(): SoundSettings {
  if (current) return current;
  current = DEFAULTS;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (saved && typeof saved === "object") {
      current = {
        effectsMuted: Boolean(saved.effectsMuted),
        clipVolume:
          typeof saved.clipVolume === "number" ? Math.min(1, Math.max(0, saved.clipVolume)) : DEFAULTS.clipVolume,
      };
    }
  } catch {
    // localStorage indisponibil sau corupt: rămânem la valorile implicite.
  }
  return current;
}

export function getSoundSettings(): SoundSettings {
  return typeof window === "undefined" ? DEFAULTS : read();
}

export function updateSoundSettings(patch: Partial<SoundSettings>) {
  current = { ...read(), ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Nu putem salva: setarea rămâne valabilă până la reîncărcare.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSoundSettings(): SoundSettings {
  return useSyncExternalStore(subscribe, getSoundSettings, () => DEFAULTS);
}
