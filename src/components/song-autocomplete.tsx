"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { SongOption } from "@/lib/game-types";
import { normalize } from "@/lib/text";

const MAX_SUGGESTIONS = 8;

type Props = {
  songs: SongOption[];
  excludeIds: number[];
  disabled?: boolean;
  onSubmit: (song: SongOption) => void;
  onSkip: () => void;
  /** Pe ultima încercare, skip-ul înseamnă „arată răspunsul”. */
  lastAttempt: boolean;
};

export function SongAutocomplete({ songs, excludeIds, disabled, onSubmit, onSkip, lastAttempt }: Props) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SongOption | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

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

  // Pe telefon: căutarea pe tot rândul, butoanele dedesubt. De la `sm` în sus: totul pe un rând.
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
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
            className="absolute top-full z-20 mt-2 max-h-72 w-full overflow-auto rounded-lg border border-border bg-surface py-1 shadow-xl shadow-black/40"
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
          <p className="absolute top-full z-20 mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted">
            Nu e în listă, deci sigur nu e asta. Răspunsul e mereu una dintre piesele din listă.
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={!selected || disabled}
          className="flex-1 rounded-lg bg-accent px-5 py-3 font-semibold sm:flex-none sm:py-0 text-accent-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Ghicește
        </button>
        <button
          type="button"
          onClick={onSkip}
          disabled={disabled}
          title={lastAttempt ? "Mă dau bătut: arată răspunsul" : "Sari la indiciul următor (consumă o încercare)"}
          className="flex items-center gap-1 rounded-lg border border-border px-3 text-sm font-semibold text-muted transition hover:border-accent/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {lastAttempt ? (
            "Renunț"
          ) : (
            <>
              Sari <span aria-hidden>⏭</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
