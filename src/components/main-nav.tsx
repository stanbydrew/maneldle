"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

const LINKS = [
  { href: "/", label: "Azi" },
  { href: "/leaderboard", label: "Clasament" },
  { href: "/archive", label: "Arhivă" },
] as const;

// usePathname() pe rute dinamice (/archive/[date]) trebuie pus în <Suspense>.
// Fallback-ul e aceeași navigație, doar fără tab-ul activ evidențiat.
export function MainNav() {
  return (
    <Suspense fallback={<NavLinks pathname={null} />}>
      <ActiveNav />
    </Suspense>
  );
}

function ActiveNav() {
  return <NavLinks pathname={usePathname()} />;
}

function NavLinks({ pathname }: { pathname: string | null }) {
  return (
    <nav className="grid grid-cols-3 gap-1 rounded-xl bg-surface p-1 text-sm font-semibold">
      {LINKS.map(({ href, label }) => {
        const active = pathname !== null && (href === "/" ? pathname === "/" : pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg py-2 text-center transition ${
              active ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
