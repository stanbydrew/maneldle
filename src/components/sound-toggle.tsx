"use client";

import { updateSoundSettings, useSoundSettings } from "@/lib/sound-settings";

/** Pornește / oprește efectele sonore (greșeală, pierdere, victorie). */
export function SoundToggle() {
  const { effectsMuted } = useSoundSettings();

  return (
    <button
      type="button"
      onClick={() => updateSoundSettings({ effectsMuted: !effectsMuted })}
      aria-pressed={effectsMuted}
      aria-label={effectsMuted ? "Pornește efectele sonore" : "Oprește efectele sonore"}
      title={effectsMuted ? "Efecte sonore: oprite" : "Efecte sonore: pornite"}
      className={`flex h-9 w-9 items-center justify-center rounded-full border transition hover:text-foreground ${
        effectsMuted ? "border-border text-muted" : "border-accent/40 text-accent"
      }`}
    >
      {effectsMuted ? <SpeakerOffIcon /> : <SpeakerIcon />}
    </button>
  );
}

export function SpeakerIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 5 6 9H2v6h4l5 4V5Z" fill="currentColor" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M19 5a10 10 0 0 1 0 14" />
    </svg>
  );
}

export function SpeakerOffIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 5 6 9H2v6h4l5 4V5Z" fill="currentColor" />
      <path d="m22 9-6 6" />
      <path d="m16 9 6 6" />
    </svg>
  );
}
