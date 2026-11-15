import Link from "next/link";
import { Suspense } from "react";
import { MainNav } from "@/components/main-nav";
import { SoundToggle } from "@/components/sound-toggle";
import { requireUser } from "@/lib/auth";
import { logout } from "../(auth)/actions";

// Layout comun pentru paginile cu login: header + navigație.
// Partea care depinde de user stă în <Suspense> (vezi cacheComponents).
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 px-4 pt-6 pb-16">
      <header className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-2xl font-black tracking-tight">
            Manel<span className="text-accent">dle</span>
          </Link>
          <div className="flex items-center gap-3">
            <SoundToggle />
            <Suspense fallback={<span className="h-5 w-24 animate-pulse rounded bg-surface" />}>
              <UserMenu />
            </Suspense>
          </div>
        </div>
        <MainNav />
      </header>

      {children}
    </main>
  );
}

async function UserMenu() {
  const user = await requireUser();
  return (
    <form action={logout} className="flex items-center gap-3 text-sm">
      <span className="text-muted">{user.username}</span>
      <button type="submit" className="text-accent underline-offset-4 hover:underline">
        Ieși
      </button>
    </form>
  );
}
