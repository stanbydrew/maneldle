-- Fragmentul audio are acum un interval ales de mână: [audio_start_seconds, audio_end_seconds].
-- Dacă audio_end_seconds e gol, scriptul folosește 5 secunde de la start.
alter table public.songs
  add column if not exists audio_end_seconds numeric(7, 2);

alter table public.songs
  add constraint songs_audio_range_check
  check (
    audio_end_seconds is null
    or (audio_start_seconds is not null
        and audio_end_seconds > audio_start_seconds
        and audio_end_seconds - audio_start_seconds <= 30)
  );
