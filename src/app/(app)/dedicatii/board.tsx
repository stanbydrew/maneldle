"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { SongRequest } from "@/lib/dedications";
import { normalize } from "@/lib/text";
import { DedicationForm } from "./dedication-form";
import { VoteButton } from "./vote-button";

export type BoardSong = { id: number; title: string; artist: string; isNew: boolean };

/** Câte cereri în așteptare se văd înainte de „arată toate”. */
const TOP_REQUESTS = 10;

type Tab = "requests" | "catalog";

/**
 * Pagina de dedicații: o căutare comună (piese din joc + cereri), apoi două
 * file. Formularul stă ascuns și se deschide din căutare (cu titlul completat)
 * sau din butonul „Cere o piesă”.
 */
export function DedicationsBoard({ requests, songs }: { requests: SongRequest[]; songs: BoardSong[] }) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("requests");
  const [form, setForm] = useState<{ title: string } | null>(null);

  const pending = requests.filter((r) => r.status === "pending");
  const recent = requests.filter((r) => r.status !== "pending");

  const songIndex = useMemo(() => songs.map((s) => ({ s, key: normalize(`${s.title} ${s.artist}`) })), [songs]);
  const requestIndex = useMemo(
    () => pending.map((r) => ({ r, key: normalize(`${r.title} ${r.artist}`) })),
    [pending],
  );

  const q = normalize(query);
  const openForm = (title: string) => setForm({ title });

  return (
    <div className="flex flex-col gap-4">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="🔍 Caută o manea, după titlu sau artist…"
        aria-label="Caută în piesele din joc și în cereri"
        autoComplete="off"
        spellCheck={false}
        className="w-full rounded-lg border border-border bg-surface px-3 py-3 text-base outline-none transition focus:border-accent"
      />

      {form ? (
        <DedicationForm key={form.title} initialTitle={form.title} onClose={() => setForm(null)} />
      ) : (
        !q && (
          <button
            type="button"
            onClick={() => openForm("")}
            className="self-start rounded-lg border border-accent/60 px-4 py-2 text-sm font-semibold text-accent transition hover:bg-accent/10"
          >
            + Cere o piesă
          </button>
        )
      )}

      {q ? (
        <SearchResults
          query={query.trim()}
          songs={songIndex.filter((x) => x.key.includes(q)).map((x) => x.s)}
          requests={requestIndex.filter((x) => x.key.includes(q)).map((x) => x.r)}
          onRequest={form ? null : openForm}
        />
      ) : (
        <>
          <Tabs
            tab={tab}
            onChange={setTab}
            counts={{ requests: pending.length, catalog: songs.length }}
          />
          {tab === "requests" ? <Requests pending={pending} recent={recent} /> : <SongList songs={songs} />}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function SearchResults({
  query,
  songs,
  requests,
  onRequest,
}: {
  query: string;
  songs: BoardSong[];
  requests: SongRequest[];
  onRequest: ((title: string) => void) | null;
}) {
  return (
    <div className="flex flex-col gap-5">
      {songs.length > 0 && (
        <Section title="În joc" count={songs.length}>
          <SongList songs={songs} />
        </Section>
      )}
      {requests.length > 0 && (
        <Section title="Cerute deja" count={requests.length}>
          <RequestList requests={requests} />
        </Section>
      )}
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted">
        {songs.length === 0 && requests.length === 0 ? (
          <p>Nu e nici în joc, nici cerută. 🎶</p>
        ) : (
          <p>Nu e aici ce cauți?</p>
        )}
        {onRequest && (
          <button
            type="button"
            onClick={() => onRequest(query)}
            className="rounded-lg bg-accent px-4 py-2 font-semibold text-accent-foreground transition hover:brightness-110"
          >
            Cere „{query}”
          </button>
        )}
      </div>
    </div>
  );
}

function Tabs({
  tab,
  onChange,
  counts,
}: {
  tab: Tab;
  onChange: (tab: Tab) => void;
  counts: Record<Tab, number>;
}) {
  const tabs: { id: Tab; label: string }[] = [
    { id: "requests", label: "Cereri" },
    { id: "catalog", label: "În joc" },
  ];
  return (
    <div role="tablist" className="grid grid-cols-2 gap-1 rounded-xl bg-surface p-1 text-sm font-semibold">
      {tabs.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={tab === id}
          onClick={() => onChange(id)}
          className={`rounded-lg py-2 transition ${
            tab === id ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground"
          }`}
        >
          {label} <span className="font-mono">({counts[id]})</span>
        </button>
      ))}
    </div>
  );
}

function Requests({ pending, recent }: { pending: SongRequest[]; recent: SongRequest[] }) {
  const [onlyMine, setOnlyMine] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // „Ale mele” filtrează și cererile închise recent, nu doar pe cele în așteptare.
  const filtered = onlyMine ? pending.filter((r) => r.mine) : pending;
  const recentShown = onlyMine ? recent.filter((r) => r.mine) : recent;
  const shown = showAll ? filtered : filtered.slice(0, TOP_REQUESTS);
  const hidden = filtered.length - shown.length;

  return (
    <div className="flex flex-col gap-5">
      {recentShown.length > 0 && <Recent requests={recentShown} />}

      <Section
        title="Cele mai votate"
        count={filtered.length}
        action={
          (pending.some((r) => r.mine) || recent.some((r) => r.mine)) && (
            <button
              type="button"
              aria-pressed={onlyMine}
              onClick={() => setOnlyMine((v) => !v)}
              className={`rounded-full border px-3 py-0.5 text-xs font-semibold normal-case tracking-normal transition ${
                onlyMine ? "border-accent bg-accent text-accent-foreground" : "border-border text-muted"
              }`}
            >
              Ale mele
            </button>
          )
        }
      >
        {filtered.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
            {onlyMine ? "N-ai nicio dedicație în așteptare." : "Nicio dedicație încă. Fii primul!"}
          </p>
        ) : (
          <>
            <RequestList requests={shown} />
            {hidden > 0 && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="py-2 text-center text-xs text-muted transition hover:text-foreground"
              >
                ┄ Arată toate cele {filtered.length} ┄
              </button>
            )}
          </>
        )}
      </Section>
    </div>
  );
}

/**
 * Cererile închise în ultimele zile, strânse într-un singur rând care se
 * desface la apăsare, ca să nu împingă în jos cererile active.
 */
function Recent({ requests }: { requests: SongRequest[] }) {
  const added = requests.filter((r) => r.status === "added").length;
  const rejected = requests.length - added; // doar ale tale: pe ale altora nu le vezi

  const parts = [];
  if (added > 0) parts.push(added === 1 ? "✅ 1 piesă nouă în joc" : `✅ ${added} piese noi în joc`);
  if (rejected > 0) parts.push(rejected === 1 ? "1 dedicație de-a ta respinsă" : `${rejected} dedicații de-ale tale respinse`);

  return (
    <details className="group rounded-xl border border-border bg-surface">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          {parts.join(" · ")} <span className="text-muted">în ultimele 7 zile</span>
        </span>
        <span aria-hidden className="text-muted transition group-open:rotate-90">
          ›
        </span>
      </summary>
      <div className="border-t border-border p-2">
        <RequestList requests={requests} />
      </div>
    </details>
  );
}

// ---------------------------------------------------------------------------

function Section({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count: number;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          {title} <span className="font-mono">({count})</span>
        </h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function SongList({ songs }: { songs: BoardSong[] }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
      {songs.map((s) => (
        <li key={s.id} className="flex flex-col gap-x-3 px-4 py-2.5 sm:flex-row sm:items-baseline sm:justify-between">
          <span className="min-w-0 font-medium">
            {s.title}
            {s.isNew && (
              <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 align-middle text-[10px] font-semibold uppercase text-accent">
                nou
              </span>
            )}
          </span>
          <span className="text-sm text-muted sm:text-right">{s.artist}</span>
        </li>
      ))}
    </ul>
  );
}

function RequestList({ requests }: { requests: SongRequest[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {requests.map((r) => (
        <li
          key={r.id}
          className={`flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 ${
            r.status === "pending" ? "" : "opacity-70"
          }`}
        >
          {/* Fiecare rând se taie cu „…” separat, deci nimic nu împinge restul afară. */}
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{r.title}</p>
            <p className="truncate text-sm text-muted">{r.artist}</p>
            <p className="truncate text-xs text-muted">
              cerută de{" "}
              <span className={r.mine ? "font-semibold text-accent" : "text-foreground/80"}>
                {r.mine ? "tine" : r.requestedBy}
              </span>
            </p>
          </div>
          {r.youtubeUrl && <YouTubeButton href={r.youtubeUrl} title={r.title} />}
          {r.status === "added" ? (
            <span className="shrink-0 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
              ✅ în joc
            </span>
          ) : r.status === "rejected" ? (
            <span className="shrink-0 rounded-full bg-danger/15 px-3 py-1 text-xs font-semibold text-danger">
              respinsă
            </span>
          ) : (
            <VoteButton requestId={r.id} votes={r.votes} voted={r.votedByMe} mine={r.mine} />
          )}
        </li>
      ))}
    </ul>
  );
}

function YouTubeButton({ href, title }: { href: string; title: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      aria-label={`Ascultă „${title}” pe YouTube`}
      title="Ascultă pe YouTube"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-muted transition hover:border-accent/60 hover:text-accent"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
      </svg>
    </a>
  );
}
