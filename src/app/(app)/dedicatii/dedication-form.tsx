"use client";

import { useState, useTransition, type FormEvent } from "react";
import { requestSongAction, type DedicationFormState } from "./actions";

const INPUT =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base outline-none transition focus:border-accent disabled:opacity-50";

export function DedicationForm() {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [result, setResult] = useState<DedicationFormState>({});
  const [pending, startTransition] = useTransition();
  const canSubmit = title.trim() !== "" && artist.trim() !== "" && !pending;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    startTransition(async () => {
      const response = await requestSongAction({ title, artist, youtubeUrl });
      setResult(response);
      // Câmpurile rămân completate la eroare, ca să poți corecta.
      if (response.ok) {
        setTitle("");
        setArtist("");
        setYoutubeUrl("");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <h2 className="font-semibold">Cere o piesă</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titlul piesei"
          maxLength={100}
          required
          autoComplete="off"
          aria-label="Titlul piesei"
          className={INPUT}
        />
        <input
          name="artist"
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          placeholder="Artist"
          maxLength={80}
          required
          autoComplete="off"
          aria-label="Artist"
          className={INPUT}
        />
      </div>
      <input
        name="youtubeUrl"
        type="url"
        inputMode="url"
        value={youtubeUrl}
        onChange={(e) => setYoutubeUrl(e.target.value)}
        placeholder="Link YouTube (opțional)"
        maxLength={200}
        autoComplete="off"
        aria-label="Link YouTube (opțional)"
        className={INPUT}
      />
      <button
        type="submit"
        disabled={!canSubmit}
        className="rounded-lg bg-accent px-5 py-3 font-semibold text-accent-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Se trimite…" : "Trimite dedicația"}
      </button>
      {result.ok && (
        <p role="status" className="text-center text-sm text-accent">
          {result.ok}
        </p>
      )}
      {result.error && (
        <p role="alert" className="text-center text-sm text-danger">
          {result.error}
        </p>
      )}
    </form>
  );
}
