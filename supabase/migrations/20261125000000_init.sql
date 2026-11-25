-- Somuchim: initial schema
-- Run in Supabase: SQL Editor → paste → Run (or `supabase db push`).

-- ───────────── Profiles ─────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 80),
  roles text[] not null default '{parent}'
    check (roles <@ array['parent', 'sitter'] and cardinality(roles) between 1 and 2),
  is_staff boolean not null default false,
  terms_accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_staff from public.profiles where id = auth.uid()), false)
$$;

-- Babysitter details. Verification fields are set by staff only (see trigger below).
create table public.sitter_profiles (
  id uuid primary key references public.profiles (id) on delete cascade,
  bio text default '' check (char_length(bio) <= 1000),
  area text default '' check (char_length(area) <= 60),
  birth_date date,
  hourly_rate integer check (hourly_rate between 20 and 300),
  hosts_at_home boolean not null default false,
  bit_phone text check (char_length(bit_phone) <= 20),
  bit_link text check (bit_link is null or bit_link like 'https://%'),
  photo_path text,
  video_path text,
  lat double precision,
  lng double precision,
  -- staff-controlled
  id_verified boolean not null default false,
  police_status text not null default 'none'
    check (police_status in ('none', 'review', 'approved', 'rejected')),
  police_expires date,
  is_listed boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.families (
  id uuid primary key references public.profiles (id) on delete cascade,
  about text default '' check (char_length(about) <= 1000),
  area text default '' check (char_length(area) <= 60),
  photo_path text,
  video_path text,
  updated_at timestamptz not null default now()
);

-- Block non-staff users from marking themselves verified or listed.
create or replace function public.protect_staff_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_staff() or auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.id_verified := false; new.police_status := 'none';
    new.police_expires := null; new.is_listed := false;
  else
    new.id_verified := old.id_verified; new.police_status := old.police_status;
    new.police_expires := old.police_expires; new.is_listed := old.is_listed;
  end if;
  new.updated_at := now();
  return new;
end $$;

-- profiles has no updated_at column, so use a dedicated trigger function for it.
create or replace function public.protect_profile_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() and auth.uid() is not null then
    new.is_staff := case when tg_op = 'INSERT' then false else old.is_staff end;
  end if;
  return new;
end $$;

create trigger profiles_protect before insert or update on public.profiles
  for each row execute function public.protect_profile_fields();
create trigger sitter_protect before insert or update on public.sitter_profiles
  for each row execute function public.protect_staff_fields();

-- ───────────── Bookings, shifts, reviews ─────────────
create table public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles (id) on delete cascade,
  sitter_id uuid not null references public.sitter_profiles (id) on delete cascade,
  location text not null check (location in ('parent_home', 'sitter_home')),
  weekdays smallint[] not null default '{}',
  start_date date,
  start_time time not null,
  end_time time not null,
  kids text default '' check (char_length(kids) <= 200),
  notes text default '' check (char_length(notes) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now()
);

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.booking_requests (id) on delete set null,
  parent_id uuid not null references public.profiles (id) on delete cascade,
  sitter_id uuid not null references public.sitter_profiles (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  hourly_rate integer not null,
  check_in_at timestamptz,
  check_in_verified boolean,
  check_out_at timestamptz,
  check_out_verified boolean,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'in_progress', 'unpaid', 'reported', 'confirmed', 'cancelled')),
  created_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null unique references public.shifts (id) on delete cascade,
  sitter_id uuid not null references public.sitter_profiles (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  reliability smallint not null check (reliability between 1 and 5),
  punctuality smallint not null check (punctuality between 1 and 5),
  with_kids smallint not null check (with_kids between 1 and 5),
  communication smallint not null check (communication between 1 and 5),
  body text default '' check (char_length(body) <= 1000),
  created_at timestamptz not null default now()
);

create table public.vouches (
  id uuid primary key default gen_random_uuid(),
  sitter_id uuid not null references public.sitter_profiles (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  relation text not null check (char_length(relation) <= 40),
  known_for text not null check (char_length(known_for) <= 40),
  body text not null check (char_length(body) between 5 and 600),
  created_at timestamptz not null default now(),
  unique (sitter_id, author_id),
  check (sitter_id <> author_id)
);

-- ───────────── Messages to the developer ─────────────
-- The developer's email address never reaches the app: an Edge Function
-- (supabase/functions/notify-feedback) reads it from a server secret.
create table public.feedback_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('הצעה', 'תקלה', 'מחמאה')),
  rating smallint check (rating between 1 and 5),
  body text not null check (char_length(body) between 3 and 2000),
  reply_to text check (char_length(reply_to) <= 120),
  role text check (role in ('parent', 'sitter')),
  app_version text,
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ───────────── Public sitter card (what parents see) ─────────────
-- Runs with the view owner's rights so it can show listed sitters only,
-- without exposing private columns of sitter_profiles.
create or replace view public.sitter_cards as
select
  s.id,
  p.full_name,
  s.bio,
  s.area,
  case when s.birth_date is null then null
       else extract(year from age(s.birth_date))::int end as age,
  s.hourly_rate,
  s.hosts_at_home,
  s.photo_path,
  s.video_path,
  s.id_verified,
  (s.police_status = 'approved' and (s.police_expires is null or s.police_expires >= current_date)) as police_ok,
  coalesce(r.avg_rating, 0)::numeric(2,1) as rating,
  coalesce(r.n, 0) as review_count,
  coalesce(v.n, 0) as vouch_count
from public.sitter_profiles s
join public.profiles p on p.id = s.id
left join lateral (
  select count(*)::int as n,
         avg((reliability + punctuality + with_kids + communication) / 4.0) as avg_rating
  from public.reviews where sitter_id = s.id
) r on true
left join lateral (select count(*)::int as n from public.vouches where sitter_id = s.id) v on true
where s.is_listed;

revoke all on public.sitter_cards from anon;
grant select on public.sitter_cards to authenticated;

-- ───────────── Row Level Security ─────────────
alter table public.profiles enable row level security;
alter table public.sitter_profiles enable row level security;
alter table public.families enable row level security;
alter table public.booking_requests enable row level security;
alter table public.shifts enable row level security;
alter table public.reviews enable row level security;
alter table public.vouches enable row level security;
alter table public.feedback_messages enable row level security;

create policy "own profile" on public.profiles for all
  using (id = auth.uid() or public.is_staff()) with check (id = auth.uid() or public.is_staff());

create policy "own sitter profile" on public.sitter_profiles for all
  using (id = auth.uid() or public.is_staff()) with check (id = auth.uid() or public.is_staff());

create policy "own family" on public.families for all
  using (id = auth.uid() or public.is_staff()) with check (id = auth.uid() or public.is_staff());
create policy "sitter sees families that asked her" on public.families for select
  using (exists (select 1 from public.booking_requests b where b.parent_id = families.id and b.sitter_id = auth.uid()));

create policy "parties see requests" on public.booking_requests for select
  using (parent_id = auth.uid() or sitter_id = auth.uid() or public.is_staff());
create policy "parent creates request" on public.booking_requests for insert
  with check (parent_id = auth.uid() and status = 'pending');
create policy "parties update request" on public.booking_requests for update
  using (parent_id = auth.uid() or sitter_id = auth.uid());

create policy "parties see shifts" on public.shifts for select
  using (parent_id = auth.uid() or sitter_id = auth.uid() or public.is_staff());
create policy "parties update shifts" on public.shifts for update
  using (parent_id = auth.uid() or sitter_id = auth.uid());

create policy "reviews are public" on public.reviews for select using (auth.uid() is not null);
create policy "parent reviews own finished shift" on public.reviews for insert
  with check (
    author_id = auth.uid() and exists (
      select 1 from public.shifts sh
      where sh.id = shift_id and sh.parent_id = auth.uid() and sh.sitter_id = reviews.sitter_id
        and sh.status in ('reported', 'confirmed')));

create policy "vouches are public" on public.vouches for select using (auth.uid() is not null);
create policy "write own vouch" on public.vouches for insert with check (author_id = auth.uid());
create policy "delete own vouch" on public.vouches for delete using (author_id = auth.uid() or public.is_staff());

create policy "send own message" on public.feedback_messages for insert
  with check (user_id = auth.uid() and emailed_at is null);
create policy "staff read messages" on public.feedback_messages for select using (public.is_staff());

-- ───────────── Storage ─────────────
-- media: profile photos and intro videos, readable by signed-in users.
-- documents: ID scans, selfies, police clearance. Owner uploads, staff reads.
insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', false, 104857600), ('documents', 'documents', false, 10485760)
on conflict (id) do nothing;

create policy "upload own media" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "replace own media" on storage.objects for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own media" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "signed-in read media" on storage.objects for select to authenticated
  using (bucket_id = 'media');

create policy "upload own documents" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owner or staff read documents" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));
create policy "staff delete documents" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and public.is_staff());
