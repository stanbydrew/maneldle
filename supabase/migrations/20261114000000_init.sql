-- Maneldle: schema inițială
--
-- Securitate: RLS e activ pe toate tabelele și NU are nicio politică, deci
-- cheia publică (din browser) nu poate citi sau scrie nimic. Toate accesele
-- trec prin serverul Next.js, cu cheia secretă (rolul service_role ocolește RLS).

-- ---------------------------------------------------------------------------
-- Tabele
-- ---------------------------------------------------------------------------

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now()
);

create table public.songs (
  id                   bigint generated always as identity primary key,
  title                text not null,
  artist               text not null,
  obscure_lyric        text not null,          -- indiciul 1
  literary_comment     text not null,          -- indiciul 3
  youtube_url          text,                   -- arătat la final; sursa pentru scriptul audio
  audio_start_seconds  numeric(7, 2),          -- de unde începe fragmentul de 5s
  audio_path           text,                   -- cale în bucket-ul `clips` (completată de script)
  active               boolean not null default true,
  created_at           timestamptz not null default now()
);

create table public.daily_puzzles (
  puzzle_date  date primary key,
  song_id      bigint not null references public.songs (id),
  cycle        int not null,
  created_at   timestamptz not null default now(),
  unique (cycle, song_id)   -- o piesă apare o singură dată pe ciclu
);

create table public.plays (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  puzzle_date  date not null references public.daily_puzzles (puzzle_date),
  guesses      bigint[] not null default '{}',  -- song_id-urile încercate, în ordine
  solved       boolean not null default false,
  finished     boolean not null default false,  -- ghicit sau epuizat încercările
  is_late      boolean not null default false,  -- jucat din arhivă: nu dă puncte
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  primary key (user_id, puzzle_date),
  check (cardinality(guesses) <= 4)
);

create index plays_puzzle_date_idx on public.plays (puzzle_date);

alter table public.profiles      enable row level security;
alter table public.songs         enable row level security;
alter table public.daily_puzzles enable row level security;
alter table public.plays         enable row level security;

-- Drepturi explicite, ca să nu depindem de setarea „Automatically expose new
-- tables” din Supabase: doar serverul (service_role) are acces la tabele.
revoke all on public.profiles, public.songs, public.daily_puzzles, public.plays
  from anon, authenticated;
grant select, insert, update, delete
  on public.profiles, public.songs, public.daily_puzzles, public.plays
  to service_role;
grant usage, select on all sequences in schema public to service_role;

-- ---------------------------------------------------------------------------
-- Ziua curentă (fusul orar al României)
-- ---------------------------------------------------------------------------

create or replace function public.today_ro()
returns date
language sql
stable
as $$
  select (now() at time zone 'Europe/Bucharest')::date;
$$;

-- ---------------------------------------------------------------------------
-- Puzzle-ul zilei: selecție „lazy”
--
-- Primul apel din zi alege aleator o piesă activă care n-a ieșit în ciclul
-- curent și o salvează. Toate apelurile următoare din aceeași zi primesc
-- același rând. Lock-ul tranzacțional garantează că două request-uri
-- simultane nu pot alege piese diferite.
-- ---------------------------------------------------------------------------

create or replace function public.get_today_puzzle()
returns public.daily_puzzles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today     date := public.today_ro();
  v_result    public.daily_puzzles;
  v_cycle     int;
  v_last_song bigint;
  v_pick      bigint;
begin
  select * into v_result from daily_puzzles where puzzle_date = v_today;
  if found then
    return v_result;
  end if;

  perform pg_advisory_xact_lock(hashtext('maneldle:get_today_puzzle'));

  -- Un alt request poate să fi creat puzzle-ul cât am așteptat lock-ul.
  select * into v_result from daily_puzzles where puzzle_date = v_today;
  if found then
    return v_result;
  end if;

  select coalesce(max(cycle), 1) into v_cycle from daily_puzzles;

  select s.id into v_pick
  from songs s
  where s.active
    and not exists (
      select 1 from daily_puzzles d where d.cycle = v_cycle and d.song_id = s.id
    )
  order by random()
  limit 1;

  if v_pick is null then
    -- Ciclul s-a terminat: începe unul nou. Evităm să repetăm piesa de ieri.
    v_cycle := v_cycle + 1;

    select song_id into v_last_song
    from daily_puzzles
    order by puzzle_date desc
    limit 1;

    select s.id into v_pick
    from songs s
    where s.active and s.id is distinct from v_last_song
    order by random()
    limit 1;

    if v_pick is null then
      -- O singură piesă activă: n-avem de ales.
      select s.id into v_pick from songs s where s.active order by random() limit 1;
    end if;
  end if;

  if v_pick is null then
    raise exception 'Nu există nicio piesă activă în tabela songs';
  end if;

  insert into daily_puzzles (puzzle_date, song_id, cycle)
  values (v_today, v_pick, v_cycle)
  returning * into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Leaderboard
--
-- zile totale = zilele de la lansare până ieri + azi (doar dacă ai terminat
--               deja puzzle-ul de azi, ca să nu fii penalizat dimineața)
-- ghicite     = ghicite în ziua lor (nu din arhivă)
-- puncte      = 4 / 3 / 2 / 1 după încercarea la care ai ghicit
-- ---------------------------------------------------------------------------

create or replace function public.leaderboard(p_launch date)
returns table (
  user_id     uuid,
  username    text,
  solved      int,
  total_days  int,
  points      int,
  first_try   int
)
language sql
stable
security definer
set search_path = public
as $$
  with on_time as (
    select *
    from plays
    where not is_late
      and puzzle_date >= p_launch
      and puzzle_date <= public.today_ro()
  )
  select
    p.id,
    p.username,
    count(*) filter (where o.solved)::int,
    (
      greatest(public.today_ro() - p_launch, 0)
      + case when bool_or(o.finished and o.puzzle_date = public.today_ro()) then 1 else 0 end
    )::int,
    coalesce(sum(5 - cardinality(o.guesses)) filter (where o.solved), 0)::int,
    count(*) filter (where o.solved and cardinality(o.guesses) = 1)::int
  from profiles p
  left join on_time o on o.user_id = p.id
  group by p.id, p.username
  order by 3 desc, 5 desc, 2 asc;
$$;

-- Funcțiile pot fi apelate doar de server (service_role), nu din browser.
revoke all on function public.get_today_puzzle() from public, anon, authenticated;
revoke all on function public.leaderboard(date)  from public, anon, authenticated;
grant execute on function public.get_today_puzzle() to service_role;
grant execute on function public.leaderboard(date)  to service_role;

-- ---------------------------------------------------------------------------
-- Storage: bucket privat pentru fragmentele audio
-- (servite prin URL-uri semnate, valabile câteva minute)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('clips', 'clips', false)
on conflict (id) do nothing;
