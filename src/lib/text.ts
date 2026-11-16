// Folosit și pe server, și în browser. Fără `server-only`.

/** „Sărăcie” → „saracie”: căutare fără diacritice și fără majuscule. */
export function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Ca `normalize`, dar păstrează doar literele și cifrele: „Banii!” ≈ „banii”. */
export function compactKey(text: string): string {
  return normalize(text).replace(/[^a-z0-9]/g, "");
}

/** Cuvintele cu cel puțin 3 litere, normalizate: pentru a compara artiști scriși diferit. */
export function nameWords(text: string): Set<string> {
  return new Set(
    normalize(text)
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3),
  );
}

/** Ordine alfabetică românească (ă după a, ș după s). */
export const roCollator = new Intl.Collator("ro", { sensitivity: "base" });
