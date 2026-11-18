# Maneldle

Un Wordle cu manele pentru grupul de prieteni. În fiecare zi, toată lumea ghicește aceeași piesă, cu 5 încercări și câte un indiciu nou după fiecare greșeală: vers, comentariu literar, titlul în emoji, un fragment audio scurt și un vers din refren.

Planul complet și deciziile de design sunt în [`docs/PLAN.md`](docs/PLAN.md).

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind · Supabase (Postgres, Auth, Storage)

Steagurile emoji (pe Windows lipsesc din sistem) vin din fontul [Twemoji Country Flags](https://github.com/talkjs/country-flag-emoji-polyfill), grafică [Twemoji](https://github.com/jdecked/twemoji) sub licența CC-BY 4.0.

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

### Refrenul de la final

La câștig cântă refrenul piesei (`chorus_start_seconds` → `chorus_end_seconds`, max 30s). Pentru piese noi:

```
npm run chorus:propose -- --id 53   # propune partea cea mai redată de pe YouTube
                                    # → ascultă și corectează în .chorus-review/index.html
npm run clips -- --chorus           # după ce ai pus intervalul în DB: taie și urcă refrenele lipsă
```

Fără refren, la câștig cântă sunetul implicit din `public/sounds/win.mp3`. Șterge `.chorus-review/` după ce ai terminat (audio complet, doar local).
