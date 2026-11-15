import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/register"];

/**
 * Rulează înaintea fiecărei pagini:
 * 1. reîmprospătează token-ul de sesiune Supabase (cookie-urile expiră),
 * 2. trimite userii nelogați la /login.
 *
 * E doar o verificare „optimistă”. Paginile și acțiunile verifică din nou
 * userul pe server (vezi src/lib/auth.ts).
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  // Nu pune cod între crearea clientului și getClaims(): acest apel reîmprospătează sesiunea.
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims?.sub);
  const isPublic = PUBLIC_PATHS.includes(request.nextUrl.pathname);

  if (!isLoggedIn && !isPublic) {
    return redirectPreservingCookies(request, response, "/login");
  }
  if (isLoggedIn && isPublic) {
    return redirectPreservingCookies(request, response, "/");
  }

  return response;
}

function redirectPreservingCookies(request: NextRequest, from: NextResponse, path: string) {
  const redirect = NextResponse.redirect(new URL(path, request.url));
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export const config = {
  matcher: [
    // Totul în afară de API, fișiere statice și imagini.
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
