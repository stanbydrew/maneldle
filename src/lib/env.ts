import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Lipsește variabila de mediu ${name} (vezi .env.example)`);
  return value;
}

export const serverEnv = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL");
  },
  get publishableKey() {
    return required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  },
  get secretKey() {
    return required("SUPABASE_SECRET_KEY");
  },
  get inviteCode() {
    return required("INVITE_CODE");
  },
  get launchDate() {
    const value = required("LAUNCH_DATE");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("LAUNCH_DATE trebuie să fie YYYY-MM-DD");
    return value;
  },
};
