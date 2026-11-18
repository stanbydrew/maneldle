import { LoadingBar } from "@/components/loading-bar";

export function GameSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      <LoadingBar className="text-accent" />
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="h-20 animate-pulse rounded-xl bg-surface" />
      ))}
    </div>
  );
}
