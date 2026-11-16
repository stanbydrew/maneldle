/** Bară subțire care se plimbă de la stânga la dreapta: „se încarcă”. */
export function LoadingBar({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden className={`pointer-events-none block h-0.5 overflow-hidden rounded-full ${className}`}>
      <span className="nav-pending-bar block h-full w-1/3 rounded-full bg-current" />
    </span>
  );
}

/** Bloc gri care pulsează, cu bara de încărcare deasupra (fallback pentru <Suspense>). */
export function BlockSkeleton({ className = "h-64" }: { className?: string }) {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      <LoadingBar className="text-accent" />
      <div className={`animate-pulse rounded-xl bg-surface ${className}`} />
    </div>
  );
}
