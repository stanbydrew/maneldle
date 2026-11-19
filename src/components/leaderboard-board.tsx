"use client";

import { useEffect, useRef, useState } from "react";
import type { LeaderboardRow, TodayStatus } from "@/lib/leaderboard";

/** De la câți jucători lista se strânge, cu goluri care se desfac la apăsare. */
const COLLAPSE_FROM = 25;
/** În lista strânsă: locurile de sus mereu vizibile, plus vecinii tăi. */
const TOP_VISIBLE_RANK = 10;
const NEIGHBOURS = 2;
/** Câte nume încap pe o treaptă a podiumului înainte de „+N”. */
const PODIUM_NAMES = 3;

const GRID = "grid grid-cols-[3.25rem_minmax(0,1fr)_2.5rem_2rem_2rem_2.25rem] items-center gap-x-1";

type Props = { rows: LeaderboardRow[]; meId: string };

export function LeaderboardBoard({ rows, meId }: Props) {
  // Pe podium stau doar cei cu puncte: la început, când toți au 0, ar fi toți pe locul 1.
  const podium = rows.filter((r) => r.rank <= 3 && r.points > 0);
  const table = rows.slice(podium.length);

  return (
    <div className="flex flex-col gap-4">
      <ScoringInfo />
      {podium.length > 0 && <Podium rows={podium} meId={meId} />}
      {table.length > 0 && <Table rows={table} meId={meId} collapse={rows.length >= COLLAPSE_FROM} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Podium

function Podium({ rows, meId }: Props) {
  const step = (rank: number) => rows.filter((r) => r.rank === rank);
  return (
    <div className="grid grid-cols-3 items-end gap-2">
      <PodiumStep place={2} rows={step(2)} meId={meId} height="h-14" />
      <PodiumStep place={1} rows={step(1)} meId={meId} height="h-20" />
      <PodiumStep place={3} rows={step(3)} meId={meId} height="h-10" />
    </div>
  );
}

function PodiumStep({ place, rows, meId, height }: Props & { place: number; height: string }) {
  const [showAll, setShowAll] = useState(false);
  if (rows.length === 0) return <div />;

  const shown = showAll ? rows : rows.slice(0, PODIUM_NAMES);
  const hidden = rows.length - shown.length;

  return (
    <div className="flex min-w-0 flex-col items-center gap-2">
      <ul className="flex w-full flex-col items-center gap-1.5">
        {shown.map((row) => (
          <li key={row.userId} className="flex w-full flex-col items-center">
            <span
              className={`max-w-full truncate text-sm font-semibold ${row.userId === meId ? "text-accent" : ""}`}
            >
              {row.username}
            </span>
            <span className="flex items-center gap-1 text-xs text-muted">
              <Streak value={row.streak} />
              <Today status={row.today} />
              <RankChange row={row} />
            </span>
          </li>
        ))}
        {hidden > 0 && (
          <li>
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="text-xs text-accent underline-offset-4 hover:underline"
            >
              +{hidden}
            </button>
          </li>
        )}
      </ul>
      <span className="font-mono text-sm font-semibold">{rows[0].points} pct</span>
      <div
        className={`flex w-full items-start justify-center rounded-t-lg border border-b-0 border-border bg-surface pt-1 text-2xl ${height}`}
      >
        {["🥇", "🥈", "🥉"][place - 1]}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabel

type Item = { kind: "row"; row: LeaderboardRow } | { kind: "gap"; key: number; rows: LeaderboardRow[] };

function Table({ rows, meId, collapse }: Props & { collapse: boolean }) {
  const [opened, setOpened] = useState<Set<number>>(new Set());
  const myRowRef = useRef<HTMLLIElement>(null);
  const [myRowOffscreen, setMyRowOffscreen] = useState(false);
  const me = rows.find((r) => r.userId === meId);

  // Rândul tău, fixat jos, cât timp nu se vede în listă.
  useEffect(() => {
    const el = myRowRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setMyRowOffscreen(!entry.isIntersecting));
    observer.observe(el);
    return () => observer.disconnect();
  }, [me?.userId]);

  const items = buildItems(rows, meId, collapse, opened);

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-border text-sm">
        <div className={`${GRID} bg-surface px-3 py-3 text-xs uppercase tracking-wider text-muted`}>
          <span>#</span>
          <span>Jucător</span>
          <span className="text-right" title="Puncte">Pct</span>
          <span className="text-right" title="Ghicite din prima încercare">🎯</span>
          <span className="text-right" title="Piese ghicite">✓</span>
          <span className="text-right" title="Ziua de azi">Azi</span>
        </div>
        <ol>
          {items.map((item) =>
            item.kind === "row" ? (
              <li
                key={item.row.userId}
                ref={item.row.userId === meId ? myRowRef : undefined}
                className={`border-t border-border ${item.row.userId === meId ? "bg-accent/10" : ""}`}
              >
                <RowView row={item.row} isMe={item.row.userId === meId} />
              </li>
            ) : (
              <li key={`gap-${item.key}`} className="border-t border-border">
                <button
                  type="button"
                  onClick={() => setOpened((prev) => new Set(prev).add(item.key))}
                  className="w-full py-2.5 text-center text-xs text-muted transition hover:bg-surface hover:text-foreground"
                >
                  ┄ {gapLabel(item.rows)} ┄
                </button>
              </li>
            ),
          )}
        </ol>
      </div>

      {me && myRowOffscreen && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] text-sm backdrop-blur">
          <div className="mx-auto max-w-lg px-4">
            <div className="rounded-lg bg-accent/10">
              <RowView row={me} isMe />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Rândurile de afișat. Sub `COLLAPSE_FROM` jucători se vede tot. Peste, se văd
 * locurile până la 10 și vecinii tăi; restul stă în goluri care se desfac la
 * apăsare. Un gol cu un singur jucător nu merită buton: se afișează direct.
 */
function buildItems(rows: LeaderboardRow[], meId: string, collapse: boolean, opened: Set<number>): Item[] {
  if (!collapse) return rows.map((row) => ({ kind: "row", row }));

  const myIndex = rows.findIndex((r) => r.userId === meId);
  const visible = rows.map(
    (r, i) => r.rank <= TOP_VISIBLE_RANK || (myIndex >= 0 && Math.abs(i - myIndex) <= NEIGHBOURS),
  );

  const items: Item[] = [];
  let i = 0;
  while (i < rows.length) {
    if (visible[i]) {
      items.push({ kind: "row", row: rows[i] });
      i += 1;
      continue;
    }
    let end = i;
    while (end < rows.length && !visible[end]) end += 1;
    const gap = rows.slice(i, end);
    if (gap.length === 1 || opened.has(i)) gap.forEach((row) => items.push({ kind: "row", row }));
    else items.push({ kind: "gap", key: i, rows: gap });
    i = end;
  }
  return items;
}

function gapLabel(rows: LeaderboardRow[]) {
  const from = rows[0].rank;
  const to = rows[rows.length - 1].rank;
  const places = from === to ? `locul ${from}` : `locurile ${from}–${to}`;
  return `Arată ${places} (${players(rows.length)})`;
}

/** 1 jucător, 2 jucători, 20 de jucători. */
function players(n: number) {
  if (n === 1) return "1 jucător";
  const de = n % 100 === 0 || n % 100 >= 20 ? "de " : "";
  return `${n} ${de}jucători`;
}

function RowView({ row, isMe }: { row: LeaderboardRow; isMe: boolean }) {
  return (
    <div className={`${GRID} px-3 py-3`}>
      <span className="flex items-baseline gap-1 font-mono text-muted">
        {row.rank}
        <RankChange row={row} />
      </span>
      <span className="flex min-w-0 items-center gap-1.5">
        <span className={`truncate ${isMe ? "font-semibold text-accent" : ""}`}>{row.username}</span>
        <Streak value={row.streak} className="shrink-0 text-xs text-muted" />
      </span>
      <span className="text-right font-mono font-semibold">{row.points}</span>
      <span className="text-right font-mono text-muted">{row.firstTry}</span>
      <span className="text-right font-mono text-muted">{row.solved}</span>
      <span className="text-right">
        <Today status={row.today} />
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bucăți mici

function RankChange({ row }: { row: LeaderboardRow }) {
  if (row.isNew) return <span className="font-sans text-[10px] font-semibold text-accent">nou</span>;
  if (row.rankChange > 0)
    return (
      <span className="text-[11px] text-success" title={`Urcat ${row.rankChange} față de ieri`}>
        ↑{row.rankChange}
      </span>
    );
  if (row.rankChange < 0)
    return (
      <span className="text-[11px] text-danger" title={`Coborât ${-row.rankChange} față de ieri`}>
        ↓{-row.rankChange}
      </span>
    );
  return null;
}

function Streak({ value, className = "" }: { value: number; className?: string }) {
  if (value <= 0) return null;
  return (
    <span className={className} title={`${value} ${value === 1 ? "zi" : "zile"} la rând ghicite`}>
      🔥{value}
    </span>
  );
}

const TODAY: Record<TodayStatus, { icon: string; label: string }> = {
  solved: { icon: "✅", label: "A ghicit azi" },
  failed: { icon: "❌", label: "A ratat azi" },
  pending: { icon: "⏳", label: "N-a terminat încă piesa de azi" },
};

function Today({ status }: { status: TodayStatus }) {
  const { icon, label } = TODAY[status];
  return (
    <span title={label} aria-label={label}>
      {icon}
    </span>
  );
}

function ScoringInfo() {
  return (
    <details className="text-sm">
      <summary className="flex cursor-pointer list-none items-center justify-end gap-1.5 text-muted transition hover:text-foreground [&::-webkit-details-marker]:hidden">
        <span className="flex h-5 w-5 items-center justify-center rounded-full border border-current text-xs font-semibold">
          i
        </span>
        Cum se punctează
      </summary>
      <div className="mt-2 flex flex-col gap-2 rounded-xl border border-border bg-surface p-4 text-xs leading-relaxed text-muted">
        <p>
          <span className="font-semibold text-foreground">Puncte:</span> 5 din prima încercare, 4 din a doua, 3 din a
          treia, 2 din a patra, 1 din a cincea.
        </p>
        <p>
          <span className="font-semibold text-foreground">Ordinea:</span> după puncte. La egalitate contează piesele
          ghicite din prima, apoi toate piesele ghicite.
        </p>
        <ul className="flex flex-col gap-0.5">
          <li>🎯 ghicite din prima · ✓ piese ghicite</li>
          <li>🔥 zile la rând ghicite (se pierde la o zi ratată sau nejucată)</li>
          <li>✅ a ghicit azi · ❌ a ratat azi · ⏳ încă n-a terminat</li>
          <li>↑↓ schimbarea de loc față de ieri</li>
        </ul>
        <p>Zilele ratate contează. Arhiva nu aduce puncte.</p>
      </div>
    </details>
  );
}
