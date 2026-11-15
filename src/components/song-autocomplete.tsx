"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { SongOption } from "@/lib/game-types";

const MAX_SUGGESTIONS = 8;

/** „Sărăcie” → „saracie”: căutare fără diacritice și fără majuscule. */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

type Props = {
  songs: SongOption[];
  excludeIds: number[];
  disabled?: boolean;
  onSubmit: (song: SongOption) => void;
};

export function SongAutocomplete({ songs, excludeIds, disabled, onSubmit }: Props) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SongOption | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  // Inputul e dezactivat cât se trimite răspunsul și pierde focusul.
  // Îl readucem, ca să poți scrie direct următoarea încercare.
  // Doar după o trimitere (disabled: true → false), nu la încărcarea paginii:
  // pe telefon ar deschide tastatura peste indicii.
  const wasDisabled = useRef(disabled);
  useEffect(() => {
    if (wasDisabled.current && !disabled) inputRef.current?.focus();
    wasDisabled.current = disabled;
  }, [disabled]);

  const indexed = useMemo(() => songs.map((s) => ({ ...s, key: normalize(s.title) })), [songs]);

  const suggestions = useMemo(() => {
    const q = normalize(query);
    if (!q) return [];
    const excluded = new Set(excludeIds);
    const matches = indexed.filter((s) => !excluded.has(s.id) && s.key.includes(q));
    // Titlurile care încep cu textul căutat apar primele.
    matches.sort((a, b) => Number(b.key.startsWith(q)) - Number(a.key.startsWith(q)));
    return matches.slice(0, MAX_SUGGESTIONS);
  }, [indexed, excludeIds, query]);

  const showList = open && !selected && suggestions.length > 0;

  function choose(song: SongOption) {
    setSelected(song);
    setQuery(song.title);
    setOpen(false);
  }

  function submit() {
    if (!selected || disabled) return;
    onSubmit(selected);
    setSelected(null);
    setQuery("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && showList) {
      event.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (event.key === "ArrowUp" && showList) {
      event.preventDefault();
      setActive((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === "Tab" && showList && !event.shiftKey) {
      // Tab completează piesa evidențiată și rămâne în input, ca Enter să o trimită.
      event.preventDefault();
      choose(suggestions[active]);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (showList) choose(suggestions[active]);
      else submit();
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList ? `${listId}-${active}` : undefined}
          placeholder="Caută titlul piesei…"
          value={query}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(null);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={handleKeyDown}
          className="w-full rounded-lg border border-border bg-surface px-3 py-3 text-base outline-none transition focus:border-accent disabled:opacity-50"
        />
        {showList && (
          <ul
            id={listId}
            role="listbox"
            className="absolute bottom-full z-10 mb-2 max-h-72 w-full overflow-auto rounded-lg border border-border bg-surface py-1 shadow-xl shadow-black/40"
          >
            {suggestions.map((song, i) => (
              <li
                key={song.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                // onMouseDown, nu onClick: se declanșează înainte de blur-ul inputului.
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(song);
                }}
                onMouseEnter={() => setActive(i)}
                className={`cursor-pointer px-3 py-2 ${i === active ? "bg-accent/15 text-accent" : ""}`}
              >
                {song.title}
              </li>
            ))}
          </ul>
        )}
        {open && !selected && normalize(query) && suggestions.length === 0 && (
          <p className="absolute bottom-full mb-2 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted">
            Nicio piesă găsită.
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={submit}
        disabled={!selected || disabled}
        className="rounded-lg bg-accent px-5 font-semibold text-accent-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Ghicește
      </button>
    </div>
  );
}
