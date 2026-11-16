-- Dedicații: jucătorii cer piese noi, ceilalți dau +1.
-- Statusul îl schimbi din Table Editor: pending → added (ai adăugat-o) sau rejected.

create table public.song_requests (
  id            bigint generated always as identity primary key,
  title         text not null check (char_length(title) between 1 and 100),
  artist        text not null check (char_length(artist) between 1 and 80),
  youtube_url   text check (youtube_url is null or char_length(youtube_url) <= 200),
  requested_by  uuid not null references public.profiles (id) on delete cascade,
  status        text not null default 'pending' check (status in ('pending', 'added', 'rejected')),
  created_at    timestamptz not null default now()
);

create index song_requests_status_idx on public.song_requests (status, created_at);

-- Cine a cerut piesa are automat și el un vot.
create table public.song_request_votes (
  request_id  bigint not null references public.song_requests (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (request_id, user_id)
);

alter table public.song_requests      enable row level security;
alter table public.song_request_votes enable row level security;

-- La fel ca restul tabelelor: doar serverul (service_role) are acces.
revoke all on public.song_requests, public.song_request_votes from anon, authenticated;
grant select, insert, update, delete on public.song_requests, public.song_request_votes to service_role;
grant usage, select on all sequences in schema public to service_role;
