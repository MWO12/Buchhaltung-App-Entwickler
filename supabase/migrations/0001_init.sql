-- AppDev Buchhaltung – Grundschema
-- Journal ist append-only (GoBD: Unveränderbarkeit). Korrekturen ausschließlich per Storno-Buchung.

create table public.entries (
  id         uuid primary key,
  user_id    uuid not null references auth.users (id) on delete restrict,
  seq        integer not null check (seq > 0),
  hash       char(64) not null,
  prev_hash  char(64) not null,
  data       jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, seq)
);

create index entries_user_seq on public.entries (user_id, seq);

-- Hash-Kette serverseitig absichern: prev_hash muss auf den Hash der Vorgängerbuchung zeigen.
create or replace function public.entries_check_chain() returns trigger
language plpgsql as $$
declare
  expected char(64);
begin
  if new.seq = 1 then
    expected := repeat('0', 64);
  else
    select hash into expected from public.entries where user_id = new.user_id and seq = new.seq - 1;
    if expected is null then
      raise exception 'Vorgängerbuchung % fehlt', new.seq - 1;
    end if;
  end if;
  if new.prev_hash <> expected then
    raise exception 'Hash-Kette unterbrochen bei Buchung %', new.seq;
  end if;
  if new.data->>'hash' <> new.hash or (new.data->>'seq')::int <> new.seq then
    raise exception 'Metadaten stimmen nicht mit Buchungsinhalt überein';
  end if;
  return new;
end $$;

create trigger entries_check_chain before insert on public.entries
  for each row execute function public.entries_check_chain();

create or replace function public.entries_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'Buchungen sind unveränderbar (GoBD). Bitte Storno-Buchung verwenden.';
end $$;

create trigger entries_no_update before update or delete on public.entries
  for each row execute function public.entries_immutable();

alter table public.entries enable row level security;

create policy entries_select on public.entries
  for select using (auth.uid() = user_id);
create policy entries_insert on public.entries
  for insert with check (auth.uid() = user_id);

create table public.settings (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.settings enable row level security;

create policy settings_rw on public.settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
