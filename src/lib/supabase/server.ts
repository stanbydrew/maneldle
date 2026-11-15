import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { serverEnv } from "@/lib/env";

/**
 * Client legat de sesiunea userului (cookie-uri). Îl folosim DOAR pentru auth:
 * cine e logat, login, logout. Datele jocului trec prin `createAdminClient`.
 * Trebuie creat unul nou la fiecare request.
 */
export async function createSessionClient() {
  const cookieStore = await cookies();

  return createServerClient(serverEnv.supabaseUrl, serverEnv.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Apelat dintr-un Server Component, unde cookie-urile sunt read-only.
          // E ok: proxy-ul reîmprospătează sesiunea.
        }
      },
    },
  });
}
