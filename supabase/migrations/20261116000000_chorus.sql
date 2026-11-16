-- Refrenul care cântă la final, când piesa e ghicită: partea pe care o știe toată lumea.
alter table public.songs add column if not exists chorus_start_seconds numeric(7, 2);
alter table public.songs add column if not exists chorus_end_seconds numeric(7, 2);
alter table public.songs add column if not exists chorus_path text; -- cale în bucket-ul `clips` (completată de script)

alter table public.songs add constraint songs_chorus_range_check check (
  chorus_start_seconds is null
  or (chorus_end_seconds is not null
    and chorus_start_seconds >= 0
    and chorus_end_seconds > chorus_start_seconds
    and chorus_end_seconds - chorus_start_seconds <= 30)
);
