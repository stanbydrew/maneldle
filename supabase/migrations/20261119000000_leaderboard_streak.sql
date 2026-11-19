-- Clasament: starea de azi, seria și cifrele de ieri (pentru săgeata ↑↓).
-- Coloanele vechi rămân, deci codul vechi merge și după migrare: se poate rula înainte de deploy.
-- Ordinea (puncte, din prima, ghicite) se stabilește în cod, vezi src/lib/leaderboard.ts.

drop function if exists public.leaderboard(date);

create function public.leaderboard(p_launch date)
returns table (
  user_id        uuid,
  username       text,
  solved         int,
  total_days     int,  -- nefolosit de codul nou, păstrat pentru compatibilitate
  points         int,
  first_try      int,
  today_status   text, -- 'solved' | 'failed' | 'pending' (n-a jucat sau e în mijlocul piesei)
  streak         int,  -- zile consecutive ghicite la timp; azi nu o strică până nu ratezi
  prev_solved    int,  -- aceleași cifre, socotite până ieri inclusiv
  prev_points    int,
  prev_first_try int
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
  ),
  -- Zilele ghicite, grupate în șiruri consecutive (în același șir, data minus
  -- numărul de ordine dă aceeași valoare).
  runs as (
    select s.user_id, max(s.puzzle_date) as last_day, count(*)::int as len
    from (
      select user_id, puzzle_date,
             puzzle_date - (row_number() over (partition by user_id order by puzzle_date))::int as grp
      from on_time
      where solved
    ) s
    group by s.user_id, s.grp
  ),
  stats as (
    select
      p.id,
      p.username,
      count(*) filter (where o.solved)::int as solved,
      (
        greatest(public.today_ro() - p_launch, 0)
        + case when bool_or(o.finished and o.puzzle_date = public.today_ro()) then 1 else 0 end
      )::int as total_days,
      coalesce(sum(6 - cardinality(o.guesses)) filter (where o.solved), 0)::int as points,
      count(*) filter (where o.solved and cardinality(o.guesses) = 1)::int as first_try,
      case
        when bool_or(o.solved and o.puzzle_date = public.today_ro()) then 'solved'
        when bool_or(o.finished and o.puzzle_date = public.today_ro()) then 'failed'
        else 'pending'
      end as today_status,
      count(*) filter (where o.solved and o.puzzle_date < public.today_ro())::int as prev_solved,
      coalesce(sum(6 - cardinality(o.guesses)) filter (where o.solved and o.puzzle_date < public.today_ro()), 0)::int as prev_points,
      count(*) filter (where o.solved and cardinality(o.guesses) = 1 and o.puzzle_date < public.today_ro())::int as prev_first_try
    from profiles p
    left join on_time o on o.user_id = p.id
    group by p.id, p.username
  )
  select
    s.id,
    s.username,
    s.solved,
    s.total_days,
    s.points,
    s.first_try,
    s.today_status,
    -- Șirul care se termină azi (ghicit azi) sau ieri (azi încă nejucat).
    -- Dacă azi a ratat, seria e 0.
    case
      when s.today_status = 'failed' then 0
      else coalesce((
        select r.len from runs r
        where r.user_id = s.id and r.last_day >= public.today_ro() - 1
      ), 0)
    end::int,
    s.prev_solved,
    s.prev_points,
    s.prev_first_try
  from stats s;
$$;

revoke all on function public.leaderboard(date) from public, anon, authenticated;
grant execute on function public.leaderboard(date) to service_role;
