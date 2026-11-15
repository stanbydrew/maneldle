"use server";

import { timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { serverEnv } from "@/lib/env";
import { createSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { usernameToEmail } from "@/lib/auth";
import { normalizeUsername, passwordError, usernameError } from "@/lib/auth-rules";
import { clientIp, LIMITS, TOO_MANY_REQUESTS, withinLimit } from "@/lib/rate-limit";

export type AuthFormState = { error?: string; username?: string };

export async function login(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const username = normalizeUsername(formData.get("username"));
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "Completează username-ul și parola.", username };
  }

  // Limită per IP (scripturi) și per username (ghicit parola cuiva de pe mai multe IP-uri).
  const ip = await clientIp();
  const [ipOk, userOk] = await Promise.all([
    withinLimit(`login:ip:${ip}`, LIMITS.loginPerIp),
    withinLimit(`login:user:${username}`, LIMITS.loginPerUsername),
  ]);
  if (!ipOk || !userOk) return { error: TOO_MANY_REQUESTS, username };

  const supabase = await createSessionClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });

  if (error) {
    return { error: "Username sau parolă greșită.", username };
  }

  redirect("/");
}

export async function register(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const username = normalizeUsername(formData.get("username"));
  const password = String(formData.get("password") ?? "");
  const inviteCode = String(formData.get("inviteCode") ?? "").trim();

  // Înainte de orice altceva, ca nimeni să nu poată ghici codul de invitație prin încercări repetate.
  if (!(await withinLimit(`register:ip:${await clientIp()}`, LIMITS.registerPerIp))) {
    return { error: TOO_MANY_REQUESTS, username };
  }

  if (!isValidInviteCode(inviteCode)) {
    return { error: "Cod de invitație greșit.", username };
  }
  const fieldError = usernameError(username) ?? passwordError(password);
  if (fieldError) {
    return { error: fieldError, username };
  }

  const admin = createAdminClient();

  const { count, error: countError } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true });
  if (countError) throw countError;
  if ((count ?? 0) >= serverEnv.maxUsers) {
    return { error: "S-a atins numărul maxim de conturi. Vorbește cu adminul.", username };
  }

  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (existing) {
    return { error: "Username-ul e deja luat.", username };
  }

  // Contul se creează cu cheia secretă: înregistrarea publică e dezactivată în
  // Supabase, ca nimeni să nu poată ocoli codul de invitație.
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: usernameToEmail(username),
    password,
    email_confirm: true,
    user_metadata: { username },
  });
  if (createError || !created.user) {
    const taken = createError?.code === "email_exists" || createError?.status === 422;
    if (!taken) console.error("createUser a eșuat", createError);
    return {
      error: taken ? "Username-ul e deja luat." : "Nu am putut crea contul. Încearcă din nou.",
      username,
    };
  }

  const { error: profileError } = await admin
    .from("profiles")
    .insert({ id: created.user.id, username });
  if (profileError) {
    console.error("Inserarea profilului a eșuat", profileError);
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: "Nu am putut crea contul. Încearcă din nou.", username };
  }

  const supabase = await createSessionClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });
  if (signInError) {
    redirect("/login");
  }

  redirect("/");
}

export async function logout() {
  const supabase = await createSessionClient();
  await supabase.auth.signOut();
  redirect("/login");
}

function isValidInviteCode(candidate: string): boolean {
  const expected = Buffer.from(serverEnv.inviteCode);
  const actual = Buffer.from(candidate);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
