# Maneldle: plan v1

Un Wordle cu manele pentru grupul de prieteni. În fiecare zi, toată lumea are de ghicit aceeași piesă.

## Jocul

Ai 4 încercări. După fiecare greșeală se deblochează următorul indiciu:

| Încercarea | Ce vezi |
|---|---|
| 1 | Un vers obscur din piesă (nu din refren) |
| 2 | + numele cântărețului |
| 3 | + un „comentariu literar” (amuzant) despre mesajul piesei |
| 4 | + un fragment audio de 5 secunde |

- Răspunsul se alege dintr-un **autocomplete** care afișează doar titlurile. Dacă ar afișa și artistul, ar strica indiciul 2.
- La final (ghicit sau nu) apar titlul, artistul și linkul de YouTube.
- **Arhivă:** zilele trecute se pot juca, dar nu aduc puncte (`is_late`).
- **Share:** rezultatul se copiază ca emoji (🟥🟥🟩⬛) pentru chat-ul grupului.

## Selecția zilnică („lazy”)

- „Ziua” se calculează pe fusul `Europe/Bucharest`.
- Primul request din zi apelează `get_today_puzzle()`. Funcția alege aleator o piesă activă care n-a ieșit în ciclul curent și o salvează în `daily_puzzles`. Toate request-urile următoare din aceeași zi primesc același rând.
- Un advisory lock tranzacțional împiedică două request-uri simultane să aleagă piese diferite.
- Când s-au epuizat piesele, începe un ciclu nou. Piesa de ieri e evitată la începutul ciclului nou.
- Dacă nimeni nu joacă într-o zi, nu se consumă nicio piesă.

## Leaderboard

Un singur leaderboard, comun pentru toată lumea. Nu există grupuri.

- **Ghicite / zile totale.** Zilele totale se numără de la `LAUNCH_DATE`, pentru toți. Ziua de azi se adaugă doar după ce ai terminat puzzle-ul.
- **Punctaj (departajare):** 4 / 3 / 2 / 1 puncte, după încercarea la care ai ghicit.
- **Ordonare:** ghicite ↓, apoi puncte ↓.

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind
- **Supabase**
  - Postgres, pentru date
  - Auth, pentru conturi
  - Storage: bucket privat `clips`, servit prin URL-uri semnate
- Schema e în git (`supabase/migrations/`). Conținutul (piesele) stă **doar în baza de date** și se introduce din Table Editor-ul Supabase (sau prin import CSV).

## Autentificare

- **Username + parolă.** Intern, `andrei` devine `andrei@maneldle.local`, fără confirmare pe email.
- **Înregistrarea cere `INVITE_CODE`.** Contul e creat de server cu cheia secretă (`auth.admin.createUser`).
- **Înregistrarea publică e dezactivată** (`enable_signup = false`), altfel oricine ar putea crea cont direct cu cheia publică și ar ocoli codul de invitație.
- Nu există „am uitat parola”. Adminul resetează parola din dashboard.

## Securitate

- RLS e activ pe toate tabelele, **fără politici**: browserul nu poate citi sau scrie nimic direct.
- Toate datele trec prin route handlers / server actions, care folosesc `SUPABASE_SECRET_KEY` (modul `server-only`).
- Răspunsul nu ajunge în browser până la finalul jocului. Indiciile sunt trimise doar după ce sunt deblocate.

## Schema

```
profiles       id, username, is_admin, created_at
songs          id, title, artist, obscure_lyric, literary_comment,
               youtube_url, audio_start_seconds, audio_path, active
daily_puzzles  puzzle_date (PK), song_id, cycle      UNIQUE(cycle, song_id)
plays          user_id, puzzle_date, guesses[], solved, finished, is_late
               PK(user_id, puzzle_date)
```

## Pași de implementare

- [x] 1. Setup: Next.js, Tailwind, clienții Supabase, `.env.example`
- [x] 2. Migrare: schema, `get_today_puzzle()`, `leaderboard()`, RLS, bucket-ul `clips`
- [x] 3. Auth: înregistrare cu cod, login, logout, proxy pentru refresh-ul sesiunii
- [x] 4. Ecranul de joc + API-ul de ghicit
- [ ] 5. Leaderboard
- [ ] 6. Arhiva
- [ ] 7. Share cu emoji
- [x] 8. Scriptul audio: `yt-dlp` + `ffmpeg` (5s de la `audio_start_seconds`), upload în `clips`, completează `audio_path`

## Setup Supabase (o singură dată)

1. Creează un proiect pe supabase.com.
2. **Authentication → Sign In / Providers:** dezactivează „Allow new users to sign up” și „Confirm email”.
3. Copiază `.env.example` în `.env.local` și completează cheile.
4. Aplică migrarea: `npx supabase link --project-ref <ref>` și apoi `npx supabase db push`. Alternativ, lipește fișierul SQL în SQL Editor.
5. Introdu piesele în tabela `songs` (Table Editor sau import CSV).

## Fragmente audio

Completează `youtube_url` și `audio_start_seconds` în tabela `songs`, apoi rulează:

```
npm run clips              # piesele noi, fără fragment
npm run clips -- --id 3    # regenerează fragmentul pentru piesa 3
npm run clips -- --force   # regenerează toate fragmentele
```

## Înainte de lansare

Șterge puzzle-urile și încercările de test (în SQL Editor), ca ciclul să pornească curat:

```sql
delete from plays;
delete from daily_puzzles;
```

## Mai târziu (după v1)

- O pagină de admin pentru piese
- Streak-uri
- Statistici personale (distribuția încercărilor)
