-- Dedicații: când s-a schimbat statusul (pending → added / rejected).
-- Se completează singur la orice schimbare de status, inclusiv din Table Editor.
-- Cererile adăugate stau 7 zile la „Adăugate recent”; cele respinse le vede 7 zile doar cine le-a cerut.
-- Compatibil cu codul vechi: se poate rula înainte de deploy.

alter table public.song_requests add column if not exists status_changed_at timestamptz;

-- Cererile deja închise pornesc de acum, ca să nu dispară brusc.
update public.song_requests set status_changed_at = now()
where status <> 'pending' and status_changed_at is null;

create or replace function public.song_requests_touch_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists song_requests_touch_status on public.song_requests;
create trigger song_requests_touch_status
  before update of status on public.song_requests
  for each row execute function public.song_requests_touch_status();

create index if not exists song_requests_status_changed_idx on public.song_requests (status_changed_at)
  where status <> 'pending';
