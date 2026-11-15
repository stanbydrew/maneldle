# Maneldle

Un Wordle cu manele pentru grupul de prieteni. În fiecare zi, toată lumea ghicește aceeași piesă, cu 4 încercări și câte un indiciu nou după fiecare greșeală: vers, artist, comentariu literar și un fragment audio scurt.

Planul complet și deciziile de design sunt în [`docs/PLAN.md`](docs/PLAN.md).

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind · Supabase (Postgres, Auth, Storage)

## Setup local

1. `npm install`
2. Copiază `.env.example` în `.env.local` și completează valorile.
3. Aplică migrarea din `supabase/migrations/` (SQL Editor sau `npx supabase db push`).
4. În Supabase → Authentication → Sign In / Providers: dezactivează „Allow new users to sign up” și „Confirm email”.
5. `npm run dev` → http://localhost:3000

## Piese

Piesele se adaugă din Table Editor-ul Supabase, în tabela `songs`. Fragmentele audio se generează cu:

```
npm run clips              # piesele fără fragment
npm run clips -- --id 3    # regenerează piesa 3
npm run clips -- --force   # regenerează tot
```

Ai nevoie de `yt-dlp` și `ffmpeg` în PATH.
