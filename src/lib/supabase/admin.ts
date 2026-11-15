import "server-only";
import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

/**
 * Client cu cheia secretă: ocolește RLS. Toate citirile și scrierile de date
 * ale jocului trec pe aici, după ce am verificat pe server cine e userul.
 * `server-only` garantează că modulul nu ajunge niciodată în bundle-ul de browser.
 */
export function createAdminClient() {
  return createClient(serverEnv.supabaseUrl, serverEnv.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
