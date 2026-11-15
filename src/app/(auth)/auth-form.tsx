"use client";

import Link from "next/link";
import { startTransition, useActionState, useState, type FormEvent } from "react";
import { passwordError, usernameError } from "@/lib/auth-rules";
import type { AuthFormState } from "./actions";

type Props = {
  mode: "login" | "register";
  action: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
};

export function AuthForm({ mode, action }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const isRegister = mode === "register";

  // Inputuri controlate: valorile rămân completate și când serverul întoarce o eroare.
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [touched, setTouched] = useState({ username: false, password: false });

  // Validarea live doar la înregistrare. La login nu dăm indicii despre format.
  const errors = isRegister
    ? { username: usernameError(username), password: passwordError(password) }
    : { username: null, password: null };
  const canSubmit = isRegister
    ? !errors.username && !errors.password && inviteCode.trim() !== ""
    : username.trim() !== "" && password !== "";

  // Trimitem manual (nu prin `<form action>`), ca React să nu reseteze
  // formularul după răspuns: dacă serverul zice „cod greșit”, restul rămâne completat.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || pending) return;
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4" noValidate>
      <Field
        label="Username"
        name="username"
        autoComplete="username"
        value={username}
        onChange={setUsername}
        onBlur={() => setTouched((t) => ({ ...t, username: true }))}
        error={touched.username || username ? errors.username : null}
        hint={isRegister ? "3-20 caractere: litere, cifre sau _" : undefined}
      />
      <PasswordField
        autoComplete={isRegister ? "new-password" : "current-password"}
        value={password}
        onChange={setPassword}
        onBlur={() => setTouched((t) => ({ ...t, password: true }))}
        error={touched.password || password ? errors.password : null}
      />
      {isRegister && (
        <Field
          label="Cod de invitație"
          name="inviteCode"
          autoComplete="off"
          value={inviteCode}
          onChange={setInviteCode}
          hint="Îl primești pe grup"
        />
      )}

      {state.error && !pending && (
        <p role="alert" className="rounded-lg bg-danger/15 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !canSubmit}
        className="mt-2 rounded-lg bg-accent px-4 py-3 font-semibold text-accent-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Un moment…" : isRegister ? "Fă-mi cont" : "Intră"}
      </button>

      <p className="text-center text-sm text-muted">
        {isRegister ? "Ai deja cont? " : "N-ai cont? "}
        <Link
          href={isRegister ? "/login" : "/register"}
          className="text-accent underline-offset-4 hover:underline"
        >
          {isRegister ? "Intră aici" : "Fă-ți unul"}
        </Link>
      </p>
    </form>
  );
}

type FieldProps = {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  autoComplete?: string;
  error?: string | null;
  hint?: string;
};

function Field({ label, name, value, onChange, onBlur, autoComplete, error, hint }: FieldProps) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {label}
      <input
        name={name}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        autoComplete={autoComplete}
        autoCapitalize="off"
        spellCheck={false}
        aria-invalid={Boolean(error)}
        className={inputClass(error)}
      />
      <FieldMessage error={error} hint={hint} />
    </label>
  );
}

function PasswordField({
  value,
  onChange,
  onBlur,
  autoComplete,
  error,
}: Omit<FieldProps, "label" | "name" | "hint">) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex flex-col gap-1.5 text-sm font-medium">
      <label htmlFor="password">Parolă</label>
      <div className="relative">
        <input
          id="password"
          name="password"
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          className={`${inputClass(error)} w-full pr-12`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ascunde parola" : "Arată parola"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted transition hover:text-foreground"
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      <FieldMessage error={error} />
    </div>
  );
}

function FieldMessage({ error, hint }: { error?: string | null; hint?: string }) {
  if (error) return <span className="text-xs font-normal text-danger">{error}</span>;
  if (hint) return <span className="text-xs font-normal text-muted">{hint}</span>;
  return null;
}

function inputClass(error?: string | null) {
  return `rounded-lg border bg-surface px-3 py-2.5 text-base outline-none transition ${
    error ? "border-danger focus:border-danger" : "border-border focus:border-accent"
  }`;
}

function EyeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2" />
      <path d="M6.6 6.6A17.4 17.4 0 0 0 2 12s3.5 7 10 7a10.6 10.6 0 0 0 5.4-1.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="m2 2 20 20" />
    </svg>
  );
}
