"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";

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
  // Tab-ul apăsat devine activ imediat, cu bara de încărcare, până se schimbă
  // pagina. (useLinkStatus nu arată nimic când ruta a fost deja preîncărcată,
  // chiar dacă datele ei încă vin de la server.)
  const [clicked, setClicked] = useState<{ href: string; from: string | null } | null>(null);
  const pendingHref = clicked && clicked.from === pathname && !isActive(clicked.href, pathname) ? clicked.href : null;

  return (
    <nav className="grid grid-cols-3 gap-1 rounded-xl bg-surface p-1 text-sm font-semibold">
      {LINKS.map(({ href, label }) => {
        const pending = pendingHref === href;
        const active = pendingHref ? pending : isActive(href, pathname);
        return (
          <Link
            key={href}
            href={href}
            onClick={(e) => {
              // Ctrl/Cmd/Shift + click deschide alt tab: pagina curentă nu se schimbă.
              if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              setClicked({ href, from: pathname });
            }}
            aria-current={isActive(href, pathname) ? "page" : undefined}
            className={`relative overflow-hidden rounded-lg py-2 text-center transition ${
              active ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            {label}
            {pending && <PendingBar />}
          </Link>
        );
      })}
    </nav>
  );
}

function isActive(href: string, pathname: string | null) {
  if (pathname === null) return false;
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Bară care se plimbă în partea de jos a tab-ului cât timp se încarcă pagina. */
function PendingBar() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-x-2 bottom-0.5 h-0.5 overflow-hidden rounded-full">
      <span className="nav-pending-bar block h-full w-1/3 rounded-full bg-accent-foreground/70" />
    </span>
  );
}
