import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

type Limit = { max: number; windowSeconds: number };

// Limitele sunt generoase pentru un om, dar opresc scripturile.
export const LIMITS = {
  loginPerIp: { max: 20, windowSeconds: 15 * 60 },
  loginPerUsername: { max: 10, windowSeconds: 15 * 60 },
  registerPerIp: { max: 5, windowSeconds: 60 * 60 },
  guessPerUser: { max: 30, windowSeconds: 60 },
  dedicationPerUser: { max: 10, windowSeconds: 60 * 60 },
  votePerUser: { max: 60, windowSeconds: 60 },
} satisfies Record<string, Limit>;

export const TOO_MANY_REQUESTS = "Prea multe încercări. Mai așteaptă puțin și încearcă din nou.";

/**
 * Înregistrează o cerere pentru `key` și întoarce false dacă s-a depășit limita.
 * Dacă verificarea însăși eșuează (ex. migrarea nu e rulată), lăsăm cererea să
 * treacă: mai bine fără limită decât cu aplicația blocată.
 */
export async function withinLimit(key: string, limit: Limit): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("hit_rate_limit", {
    p_key: key,
    p_max: limit.max,
    p_window_seconds: limit.windowSeconds,
  });
  if (error) {
    console.error("Verificarea limitei de cereri a eșuat", error);
    return true;
  }
  return data === true;
}

/** IP-ul clientului, așa cum îl transmite platforma de hosting (Vercel etc.). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "necunoscut";
}
