"use client";

import { useMemo, useState } from "react";
import { normalize } from "@/lib/text";

type Song = { id: number; title: string; artist: string };

/** Piesele din joc, deja sortate alfabetic, cu căutare după titlu sau artist. */
export function Catalog({ songs }: { songs: Song[] }) {
  const [query, setQuery] = useState("");
  const indexed = useMemo(() => songs.map((s) => ({ ...s, key: normalize(`${s.title} ${s.artist}`) })), [songs]);
  const q = normalize(query);
  const visible = q ? indexed.filter((s) => s.key.includes(q)) : indexed;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
        Piese în joc <span className="font-mono">({songs.length})</span>
      </h2>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Caută după titlu sau artist…"
        aria-label="Caută în piesele din joc"
        autoComplete="off"
        spellCheck={false}
        className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-base outline-none transition focus:border-accent"
      />
      {visible.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted">
          Nu e în joc încă. Cere-o mai sus! 🎶
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {visible.map((s) => (
            <li key={s.id} className="flex flex-col gap-x-3 px-4 py-2.5 sm:flex-row sm:items-baseline sm:justify-between">
              <span className="min-w-0 font-medium">{s.title}</span>
              <span className="text-sm text-muted sm:text-right">{s.artist}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
