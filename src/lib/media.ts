"use client";

// Pe iPhone, orice <audio> redat de pagină apare în widget-ul „Now Playing”
// (ecran de blocare, centru de control) și rămâne acolo cât timp elementul mai
// ține fișierul încărcat, chiar după ce pleci de pe pagină. Butonul de play de
// acolo nu mai face nimic util. Soluția: după ce un sunet se termină, sau când
// pagina nu mai e vizibilă, „eliberăm” elementul (fără sursă), iar widget-ul dispare.

const tracked = new Set<HTMLAudioElement>();

/** Oprește sunetul și golește sursa: widget-ul „Now Playing” dispare. */
export function releaseMedia(audio: HTMLAudioElement) {
  audio.pause();
  if (audio.hasAttribute("src")) {
    audio.removeAttribute("src");
    audio.load(); // fără sursă, browserul renunță la sesiunea media
  }
  if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
    navigator.mediaSession.playbackState = "none";
  }
}

/** Elemente create cu `new Audio()` (nu sunt în DOM), eliberate și ele când pleci de pe pagină. */
export function trackMedia(audio: HTMLAudioElement) {
  tracked.add(audio);
}

export function untrackMedia(audio: HTMLAudioElement) {
  tracked.delete(audio);
}

function releaseAll() {
  document.querySelectorAll("audio").forEach(releaseMedia);
  tracked.forEach(releaseMedia);
}

if (typeof window !== "undefined") {
  // `visibilitychange` acoperă schimbarea aplicației și blocarea ecranului;
  // `pagehide` acoperă închiderea tab-ului și navigarea în afara site-ului.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") releaseAll();
  });
  window.addEventListener("pagehide", releaseAll);
}
