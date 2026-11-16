"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

const HREF = "/dedicatii";

/** Butonul din header spre Dedicații: doar 🎶 pe telefon, cu text de la `sm` în sus. */
export function DedicationsLink() {
  return (
    <Suspense fallback={<DedicationsButton active={false} />}>
      <ActiveDedicationsLink />
    </Suspense>
  );
}

function ActiveDedicationsLink() {
  return <DedicationsButton active={usePathname().startsWith(HREF)} />;
}

function DedicationsButton({ active }: { active: boolean }) {
  return (
    <Link
      href={HREF}
      aria-label="Dedicații: piesele din joc și cereri de piese noi"
      aria-current={active ? "page" : undefined}
      title="Dedicații"
      className={`flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-full border px-2 text-sm font-semibold transition sm:px-3 ${
        active
          ? "border-accent bg-accent text-accent-foreground"
          : "border-accent/40 text-accent hover:text-foreground"
      }`}
    >
      <span aria-hidden>🎶</span>
      <span className="hidden sm:inline">Dedicații</span>
    </Link>
  );
}
