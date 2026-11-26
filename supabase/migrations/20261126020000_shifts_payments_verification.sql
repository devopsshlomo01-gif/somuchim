-- Shift lifecycle (check-in/out with a one-time location sample, payment),
-- vouches guard, identity/police verification requests, and staff review.
-- All state changes go through security-definer functions.

-- ───────────── Home location (sampled once by the parent) ─────────────
alter table public.families add column if not exists lat double precision;
alter table public.families add column if not exists lng double precision;

alter table public.shifts add column if not exists check_in_distance_m integer;
alter table public.shifts add column if not exists check_out_distance_m integer;
alter table public.shifts add column if not exists amount integer;

-- Shifts change only through the functions below.
drop policy if exists "parties update shifts" on public.shifts;

create or replace function public.geo_distance_m(lat1 double precision, lng1 double precision,
                                                  lat2 double precision, lng2 double precision)
returns integer language sql immutable as $$
  select round(2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2))))::int
$$;

-- Where the shift takes place: the family's home or the sitter's.
create or replace function public.shift_target(sh public.shifts, out lat double precision, out lng double precision)
language sql stable security definer set search_path = public as $$
  select case when coalesce(r.location, 'parent_home') = 'sitter_home' then s.lat else f.lat end,
         case when coalesce(r.location, 'parent_home') = 'sitter_home' then s.lng else f.lng end
  from (select 1) x
  left join public.booking_requests r on r.id = sh.request_id
  left join public.families f on f.id = sh.parent_id
  left join public.sitter_profiles s on s.id = sh.sitter_id
$$;

create or replace function public.check_in(shift_id uuid, lat double precision, lng double precision)
returns integer language plpgsql security definer set search_path = public as $$
declare sh public.shifts; tgt record; dist integer;
begin
  select * into sh from public.shifts where id = shift_id for update;
  if sh.id is null or sh.sitter_id <> auth.uid() then raise exception 'shift not found' using errcode = 'P0002'; end if;
  if sh.status <> 'scheduled' then raise exception 'shift not scheduled' using errcode = 'P0001'; end if;
  if now() < sh.starts_at - interval '2 hours' then raise exception 'too early' using errcode = 'P0001'; end if;
  select * into tgt from public.shift_target(sh);
  if lat is not null and tgt.lat is not null then dist := public.geo_distance_m(lat, lng, tgt.lat, tgt.lng); end if;
  update public.shifts set status = 'in_progress', check_in_at = now(),
    check_in_distance_m = dist, check_in_verified = (dist is not null and dist <= 300)
  where id = shift_id;
  return dist;
end $$;

create or replace function public.check_out(shift_id uuid, lat double precision, lng double precision)
returns integer language plpgsql security definer set search_path = public as $$
declare sh public.shifts; tgt record; dist integer; mins integer;
begin
  select * into sh from public.shifts where id = shift_id for update;
  if sh.id is null or sh.sitter_id <> auth.uid() then raise exception 'shift not found' using errcode = 'P0002'; end if;
  if sh.status <> 'in_progress' then raise exception 'shift not in progress' using errcode = 'P0001'; end if;
  select * into tgt from public.shift_target(sh);
  if lat is not null and tgt.lat is not null then dist := public.geo_distance_m(lat, lng, tgt.lat, tgt.lng); end if;
  -- Bill actual time, rounded to the nearest quarter hour, at least one hour.
  mins := greatest(60, round(extract(epoch from (now() - sh.check_in_at)) / 60 / 15) * 15);
  update public.shifts set status = 'unpaid', check_out_at = now(),
    check_out_distance_m = dist, check_out_verified = (dist is not null and dist <= 300),
    amount = round(mins / 60.0 * sh.hourly_rate)
  where id = shift_id;
  return dist;
end $$;

create or replace function public.report_paid(shift_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.shifts set status = 'reported'
  where id = shift_id and parent_id = auth.uid() and status = 'unpaid';
  if not found then raise exception 'shift not found or not awaiting payment' using errcode = 'P0002'; end if;
end $$;

create or replace function public.confirm_paid(shift_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.shifts set status = 'confirmed'
  where id = shift_id and sitter_id = auth.uid() and status in ('unpaid', 'reported');
  if not found then raise exception 'shift not found or already confirmed' using errcode = 'P0002'; end if;
end $$;

create or replace function public.cancel_shift(shift_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.shifts set status = 'cancelled'
  where id = shift_id and (parent_id = auth.uid() or sitter_id = auth.uid()) and status = 'scheduled';
  if not found then raise exception 'shift not found or already started' using errcode = 'P0002'; end if;
end $$;

-- ───────────── Shift card: what both parties see ─────────────
drop view if exists public.shift_cards;
create view public.shift_cards as
select
  sh.id, sh.parent_id, sh.sitter_id, sh.starts_at, sh.ends_at, sh.hourly_rate, sh.status,
  sh.check_in_at, sh.check_out_at, sh.check_in_verified, sh.check_out_verified,
  sh.check_in_distance_m, sh.check_out_distance_m,
  coalesce(sh.amount, round(greatest(60, round(extract(epoch from (sh.ends_at - sh.starts_at)) / 60 / 15) * 15) / 60.0 * sh.hourly_rate)::int) as amount,
  coalesce(r.location, 'parent_home') as location,
  r.kids, r.notes,
  pp.full_name as parent_name,
  sp.full_name as sitter_name,
  s.bit_phone, s.bit_link,
  exists (select 1 from public.reviews rv where rv.shift_id = sh.id) as reviewed
from public.shifts sh
join public.profiles pp on pp.id = sh.parent_id
join public.profiles sp on sp.id = sh.sitter_id
left join public.sitter_profiles s on s.id = sh.sitter_id
left join public.booking_requests r on r.id = sh.request_id
where sh.parent_id = auth.uid() or sh.sitter_id = auth.uid();

revoke all on public.shift_cards from anon;
grant select on public.shift_cards to authenticated;

-- ───────────── Vouches: only from other people, about listed sitters ─────────────
drop policy if exists "write own vouch" on public.vouches;
create policy "write own vouch" on public.vouches for insert
  with check (author_id = auth.uid() and sitter_id <> auth.uid() and public.is_listed_sitter(sitter_id));

-- ───────────── Verification requests ─────────────
create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('identity', 'police')),
  full_name_on_id text check (char_length(full_name_on_id) <= 80),
  id_last4 text check (id_last4 ~ '^\d{4}$'),
  birth_date date,
  files text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  staff_note text check (char_length(staff_note) <= 500),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.verification_requests enable row level security;

create policy "submit own verification" on public.verification_requests for insert
  with check (user_id = auth.uid() and status = 'pending' and reviewed_by is null
              and exists (select 1 from public.sitter_profiles s where s.id = auth.uid()));
create policy "see own or staff" on public.verification_requests for select
  using (user_id = auth.uid() or public.is_staff());

-- Staff decision. Identity approval verifies and lists the sitter;
-- police approval sets the badge for 12 months from the issue date given.
create or replace function public.review_verification(request_id uuid, approve boolean,
                                                      note text default null, police_issued date default null)
returns void language plpgsql security definer set search_path = public as $$
declare v public.verification_requests;
begin
  if not public.is_staff() then raise exception 'staff only' using errcode = '42501'; end if;
  select * into v from public.verification_requests where id = request_id for update;
  if v.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  if v.status <> 'pending' then raise exception 'already reviewed' using errcode = 'P0001'; end if;

  update public.verification_requests
  set status = case when approve then 'approved' else 'rejected' end,
      staff_note = note, reviewed_by = auth.uid(), reviewed_at = now()
  where id = request_id;

  if v.kind = 'identity' then
    update public.sitter_profiles
    set id_verified = approve, is_listed = approve, birth_date = coalesce(v.birth_date, birth_date)
    where id = v.user_id;
  else
    update public.sitter_profiles
    set police_status = case when approve then 'approved' else 'rejected' end,
        police_expires = case when approve then coalesce(police_issued, current_date) + interval '12 months' else null end
    where id = v.user_id;
  end if;
end $$;

-- Staff can also hide or show a sitter in search.
create or replace function public.set_sitter_listed(sitter uuid, listed boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'staff only' using errcode = '42501'; end if;
  update public.sitter_profiles set is_listed = listed where id = sitter;
end $$;

-- Staff queue with the applicant's name.
create or replace view public.verification_queue as
select v.*, p.full_name, s.hourly_rate, s.area, s.photo_path, s.video_path
from public.verification_requests v
join public.profiles p on p.id = v.user_id
left join public.sitter_profiles s on s.id = v.user_id
where public.is_staff();

revoke all on public.verification_queue from anon;
grant select on public.verification_queue to authenticated;

-- ───────────── Grants ─────────────
do $$
declare f text;
begin
  foreach f in array array[
    'check_in(uuid,double precision,double precision)',
    'check_out(uuid,double precision,double precision)',
    'report_paid(uuid)', 'confirm_paid(uuid)', 'cancel_shift(uuid)',
    'review_verification(uuid,boolean,text,date)', 'set_sitter_listed(uuid,boolean)']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke all on function public.shift_target(public.shifts) from public, anon, authenticated;
