-- Booking requests: parent asks, sitter accepts (creates a shift) or declines.
-- State changes go through security-definer functions, not direct UPDATEs,
-- so a parent cannot accept on the sitter's behalf.

-- Remove the broad update policy from the initial schema.
drop policy if exists "parties update request" on public.booking_requests;

-- Requests must be for a real, future date.
alter table public.booking_requests
  add constraint booking_requests_date_required check (start_date is not null) not valid;

-- Parents cannot read sitter_profiles (RLS), so check listing through a
-- narrow security-definer helper that reveals only this one fact.
create or replace function public.is_listed_sitter(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.sitter_profiles where id = sid and is_listed)
$$;

-- Parent may only request from a listed sitter, and not from themselves.
drop policy if exists "parent creates request" on public.booking_requests;
create policy "parent creates request" on public.booking_requests for insert
  with check (
    parent_id = auth.uid()
    and status = 'pending'
    and sitter_id <> auth.uid()
    and start_date >= (now() at time zone 'Asia/Jerusalem')::date
    and public.is_listed_sitter(sitter_id)
  );

-- Accept or decline (sitter only).
create or replace function public.respond_to_request(request_id uuid, accept boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  r public.booking_requests;
  rate integer;
  starts timestamptz;
  ends timestamptz;
  new_shift uuid;
begin
  select * into r from public.booking_requests where id = request_id for update;
  if r.id is null or r.sitter_id <> auth.uid() then
    raise exception 'request not found' using errcode = 'P0002';
  end if;
  if r.status <> 'pending' then
    raise exception 'request already handled' using errcode = 'P0001';
  end if;

  if not accept then
    update public.booking_requests set status = 'declined' where id = request_id;
    return null;
  end if;

  select hourly_rate into rate from public.sitter_profiles where id = r.sitter_id;
  starts := (r.start_date + r.start_time) at time zone 'Asia/Jerusalem';
  ends := (r.start_date + r.end_time) at time zone 'Asia/Jerusalem';
  if ends <= starts then ends := ends + interval '1 day'; end if;

  insert into public.shifts (request_id, parent_id, sitter_id, starts_at, ends_at, hourly_rate)
  values (r.id, r.parent_id, r.sitter_id, starts, ends, coalesce(rate, 50))
  returning id into new_shift;

  update public.booking_requests set status = 'accepted' where id = request_id;
  return new_shift;
end $$;

-- Cancel (parent only, while still pending).
create or replace function public.cancel_request(request_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.booking_requests set status = 'cancelled'
  where id = request_id and parent_id = auth.uid() and status = 'pending';
  if not found then
    raise exception 'request not found or already handled' using errcode = 'P0002';
  end if;
end $$;

revoke all on function public.respond_to_request(uuid, boolean) from public, anon;
revoke all on function public.cancel_request(uuid) from public, anon;
grant execute on function public.respond_to_request(uuid, boolean) to authenticated;
grant execute on function public.cancel_request(uuid) to authenticated;

-- What each side sees about a request: the other party's name, and for the
-- sitter the family's description. Filtered to the viewer's own requests.
create or replace view public.request_cards as
select
  r.id, r.parent_id, r.sitter_id, r.location, r.start_date, r.start_time, r.end_time,
  r.kids, r.notes, r.status, r.created_at,
  pp.full_name as parent_name,
  sp.full_name as sitter_name,
  f.about as family_about,
  f.area as family_area,
  s.hourly_rate
from public.booking_requests r
join public.profiles pp on pp.id = r.parent_id
join public.profiles sp on sp.id = r.sitter_id
left join public.families f on f.id = r.parent_id
left join public.sitter_profiles s on s.id = r.sitter_id
where r.parent_id = auth.uid() or r.sitter_id = auth.uid();

revoke all on public.request_cards from anon;
grant select on public.request_cards to authenticated;

create or replace view public.shift_cards as
select
  sh.id, sh.parent_id, sh.sitter_id, sh.starts_at, sh.ends_at, sh.hourly_rate, sh.status,
  sh.check_in_at, sh.check_out_at,
  pp.full_name as parent_name,
  sp.full_name as sitter_name
from public.shifts sh
join public.profiles pp on pp.id = sh.parent_id
join public.profiles sp on sp.id = sh.sitter_id
where sh.parent_id = auth.uid() or sh.sitter_id = auth.uid();

revoke all on public.shift_cards from anon;
grant select on public.shift_cards to authenticated;
