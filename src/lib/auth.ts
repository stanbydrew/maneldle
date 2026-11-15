import "server-only";
import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type CurrentUser = {
  id: string;
  username: string;
  isAdmin: boolean;
};

/** Username-ul `andrei` devine intern emailul `andrei@maneldle.local`. */
export const USERNAME_EMAIL_DOMAIN = "maneldle.local";

export function usernameToEmail(username: string): string {
  return `${username}@${USERNAME_EMAIL_DOMAIN}`;
}

/**
 * Userul logat, verificat pe server (semnătura JWT e validată de getClaims),
 * sau null. Cache-uit per request.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // Supabase folosește Date.now() ca să verifice expirarea token-ului. Fără
  // connection(), Next ar încerca să prerandeze asta în avans și ar da eroare.
  await connection();
  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return null;

  return getProfile(userId);
});

/** Profilul se schimbă foarte rar, deci nu-l mai cerem din DB la fiecare pagină. */
async function getProfile(userId: string): Promise<CurrentUser | null> {
  "use cache";
  cacheTag(`profile-${userId}`);
  cacheLife("minutes");

  const { data: profile, error } = await createAdminClient()
    .from("profiles")
    .select("id, username, is_admin")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;

  if (!profile) return null;
  return { id: profile.id, username: profile.username, isAdmin: profile.is_admin };
}

/** Pentru pagini și acțiuni care cer login: redirect la /login dacă nu e cazul. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
