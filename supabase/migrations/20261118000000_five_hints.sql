-- 5 indicii / 5 încercări:
--   1. vers obscur  2. comentariu literar  3. titlul în emoji  4. fragment audio  5. vers din refren
-- Artistul nu mai e indiciu (apare în căutare de la început).
-- Compatibil cu codul vechi: se poate rula înainte de deploy.

alter table public.songs add column if not exists emoji_hint   text; -- indiciul 3
alter table public.songs add column if not exists chorus_lyric text; -- indiciul 5

-- Până la 5 încercări. Numele constrângerii vechi e generat de Postgres, așa că o căutăm.
do $$
declare
  v_name text;
begin
  for v_name in
    select conname from pg_constraint
    where conrelid = 'public.plays'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%cardinality(guesses)%'
  loop
    execute format('alter table public.plays drop constraint %I', v_name);
  end loop;
end $$;
alter table public.plays add constraint plays_guesses_max check (cardinality(guesses) <= 5);

-- Puncte: 5 / 4 / 3 / 2 / 1 după încercarea la care ai ghicit
-- (zilele deja jucate primesc +1 fiecare, la toți la fel).
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
    coalesce(sum(6 - cardinality(o.guesses)) filter (where o.solved), 0)::int,
    count(*) filter (where o.solved and cardinality(o.guesses) = 1)::int
  from profiles p
  left join on_time o on o.user_id = p.id
  group by p.id, p.username
  order by 3 desc, 5 desc, 2 asc;
$$;

revoke all on function public.leaderboard(date) from public, anon, authenticated;
grant execute on function public.leaderboard(date) to service_role;
