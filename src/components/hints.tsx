"use client";

import { useEffect, useRef, useState } from "react";
import type { GameState } from "@/lib/game-types";
import { releaseMedia } from "@/lib/media";
import { updateSoundSettings, useSoundSettings } from "@/lib/sound-settings";
import { SpeakerIcon, SpeakerOffIcon } from "./sound-toggle";

const LABELS = ["Versul", "Comentariu literar", "Titlul în emoji", "Fragment audio", "Din refren"];

type Props = {
  hints: GameState["hints"];
  /** Indiciul tocmai deblocat: primește focus și e evidențiat scurt. `seq` repornește efectul. */
  revealed?: { index: number; seq: number } | null;
};

export function Hints({ hints, revealed }: Props) {
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);

  // Focus pe indiciul nou (închide și tastatura pe telefon) și îl centrăm pe ecran.
  useEffect(() => {
    if (!revealed) return;
    const el = itemRefs.current[revealed.index];
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [revealed]);

  const items = [
    hints.lyric !== undefined && <blockquote className="whitespace-pre-line text-lg italic leading-snug">„{hints.lyric}”</blockquote>,
    hints.comment !== undefined && <p className="leading-relaxed">{hints.comment}</p>,
    hints.emoji !== undefined &&
      (hints.emoji ? (
        <p className="text-3xl leading-snug tracking-wide">{hints.emoji}</p>
      ) : (
        <p className="text-sm text-muted">Indiciul ăsta nu e încă pregătit pentru piesa de azi.</p>
      )),
    hints.audioUrl !== undefined && <AudioClip url={hints.audioUrl} />,
    hints.chorusLyric !== undefined &&
      (hints.chorusLyric ? (
        <blockquote className="whitespace-pre-line text-lg italic leading-snug">„{hints.chorusLyric}”</blockquote>
      ) : (
        <p className="text-sm text-muted">Indiciul ăsta nu e încă pregătit pentru piesa de azi.</p>
      )),
  ];

  return (
    <ol className="flex flex-col gap-3">
      {items.map((content, i) => (
        <li
          key={LABELS[i]}
          ref={(el) => {
            itemRefs.current[i] = el;
          }}
          tabIndex={-1}
          className={`scroll-my-6 rounded-xl border p-4 outline-none transition ${
            content ? "border-border bg-surface" : "border-dashed border-border/60 text-muted"
          } ${revealed?.index === i ? "hint-revealed" : ""}`}
        >
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
            {i + 1}. {LABELS[i]}
          </p>
          {content || <p className="text-sm">🔒 Indiciu blocat</p>}
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Player audio în stil „guess the song”: o formă de undă care se umple pe
// măsură ce rulează fragmentul.
// ---------------------------------------------------------------------------

const BAR_COUNT = 48;

// Înălțimi fixe, pseudo-aleatorii, ca forma de undă să arate la fel la fiecare randare.
const BARS = Array.from({ length: BAR_COUNT }, (_, i) => {
  const wave = Math.abs(Math.sin(i * 1.7) * 0.6 + Math.sin(i * 0.43) * 0.4);
  return 0.2 + wave * 0.8;
});

type PlayerStatus = "idle" | "loading" | "playing" | "paused" | "error";

function AudioClip({ url }: { url: string | null }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [status, setStatus] = useState<PlayerStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(5);
  const { clipVolume } = useSoundSettings();
  // Ultimul volum nenul, ca butonul de mute să revină la el.
  const [lastVolume, setLastVolume] = useState(clipVolume || 0.6);

  // Volumul se aplică live, inclusiv cât rulează fragmentul.
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = clipVolume;
  }, [clipVolume, url]);

  // Sursa e pusă din cod, nu ca prop, ca s-o putem scoate după redare (vezi media.ts)
  // și pune la loc la următorul play. La ieșirea din pagină, elementul e eliberat.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !url) return;
    audio.src = url;
    return () => releaseMedia(audio);
  }, [url]);

  function setVolume(volume: number) {
    if (volume > 0) setLastVolume(volume);
    updateSoundSettings({ clipVolume: volume });
  }

  // Progresul se actualizează la fiecare frame cât rulează, pentru o animație fluidă.
  useEffect(() => {
    if (status !== "playing") return;
    let frame = 0;
    const tick = () => {
      const audio = audioRef.current;
      if (audio && audio.duration) setProgress(audio.currentTime / audio.duration);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [status]);

  if (!url) return <p className="text-sm text-muted">Fragmentul pentru piesa asta nu e încă disponibil.</p>;
  if (status === "error") return <p className="text-sm text-danger">Nu s-a putut încărca. Reîncarcă pagina.</p>;

  async function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (status === "playing" || status === "loading") {
      audio.pause();
      return;
    }
    if (!audio.hasAttribute("src")) audio.src = url!; // eliberat după ultima redare
    else if (audio.ended || progress >= 1) audio.currentTime = 0;
    audio.volume = clipVolume;
    setStatus("loading");
    try {
      await audio.play();
    } catch {
      setStatus("error");
    }
  }

  const active = status === "playing" || status === "loading";
  const elapsed = progress * duration;

  return (
    // Butonul și forma de undă au aceeași înălțime și stau pe același rând;
    // cronometrul e dedesubt, doar sub forma de undă, ca să nu tragă butonul în jos.
    <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1.5">
      <button
        type="button"
        onClick={toggle}
        aria-label={active ? "Oprește fragmentul" : "Ascultă fragmentul"}
        className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground transition hover:scale-105 active:scale-95 ${
          status === "playing" ? "shadow-[0_0_24px] shadow-accent/50" : ""
        }`}
      >
        {status === "loading" ? <Spinner /> : active ? <PauseIcon /> : <PlayIcon />}
      </button>

      <div className="flex h-14 min-w-0 items-center gap-[3px]" aria-hidden>
          {BARS.map((height, i) => {
            const filled = (i + 0.5) / BAR_COUNT <= progress;
            return (
              <span
                key={i}
                className={`flex-1 rounded-full transition-colors duration-150 ${
                  filled ? "bg-accent" : "bg-border"
                } ${status === "loading" ? "animate-pulse" : ""}`}
                style={{ height: `${height * 100}%` }}
              />
            );
          })}
      </div>
      <div className="col-start-2 flex justify-between font-mono text-xs text-muted">
        <span>{formatTime(elapsed)}</span>
        <span>{status === "loading" ? "se încarcă…" : formatTime(duration)}</span>
      </div>

      <div className="col-start-2 flex items-center gap-2 text-muted">
        <button
          type="button"
          onClick={() => setVolume(clipVolume > 0 ? 0 : lastVolume)}
          aria-label={clipVolume > 0 ? "Fără sonor" : "Pornește sonorul"}
          className="transition hover:text-foreground"
        >
          {clipVolume > 0 ? <SpeakerIcon size={16} /> : <SpeakerOffIcon size={16} />}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={clipVolume}
          onChange={(e) => setVolume(Number(e.target.value))}
          aria-label="Volumul fragmentului"
          className="h-1 w-28 cursor-pointer accent-accent"
        />
        <span className="w-8 font-mono text-xs">{Math.round(clipVolume * 100)}%</span>
      </div>

      <audio
        ref={audioRef}
        preload="auto"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 5)}
        onWaiting={() => setStatus("loading")}
        onPlaying={() => setStatus("playing")}
        onPause={() => setStatus((s) => (s === "error" ? s : "paused"))}
        onEnded={(e) => {
          setProgress(1);
          setStatus("idle");
          releaseMedia(e.currentTarget);
        }}
        // Fără sursă (eliberat intenționat) nu e o eroare.
        onError={(e) => e.currentTarget.hasAttribute("src") && setStatus("error")}
      />
    </div>
  );
}

function formatTime(seconds: number) {
  const s = Math.min(Math.floor(seconds), 59);
  return `0:${String(s).padStart(2, "0")}`;
}

function PlayIcon() {
  return (
    // Triunghi cu centrul de greutate la x=13 (mijlocul e 12): un triunghi
    // centrat matematic pare mutat spre stânga, deci îl împingem puțin spre dreapta.
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path transform="translate(1 0)" d="M8 5.6v12.8a1.1 1.1 0 0 0 1.68.93l10.1-6.4a1.1 1.1 0 0 0 0-1.86L9.68 4.67A1.1 1.1 0 0 0 8 5.6Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="4.5" width="4" height="15" rx="1" />
      <rect x="14" y="4.5" width="4" height="15" rx="1" />
    </svg>
  );
}

function Spinner() {
  return (
    <span
      className="h-6 w-6 animate-spin rounded-full border-[3px] border-accent-foreground/30 border-t-accent-foreground"
      aria-hidden
    />
  );
}
