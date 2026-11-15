// Reguli de validare folosite și în browser (validare live), și pe server
// (validarea care contează). Fără `server-only`: se importă din ambele părți.

export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
export const MIN_PASSWORD_LENGTH = 6;

export function normalizeUsername(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase();
}

/** Mesaj de eroare pentru username, sau null dacă e valid. */
export function usernameError(raw: string): string | null {
  const username = normalizeUsername(raw);
  if (username.length < 3) return "Minim 3 caractere.";
  if (username.length > 20) return "Maxim 20 de caractere.";
  if (!USERNAME_PATTERN.test(username)) return "Doar litere, cifre și _ (fără diacritice sau spații).";
  return null;
}

/** Mesaj de eroare pentru parolă, sau null dacă e validă. */
export function passwordError(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Minim ${MIN_PASSWORD_LENGTH} caractere.`;
  return null;
}
