-- Family photos/videos (files named "family-*") are visible only to the family,
-- staff, and sitters the family has sent a booking request to.
-- Sitter photos/videos stay visible to any signed-in user.

drop policy if exists "signed-in read media" on storage.objects;

create policy "read media" on storage.objects for select to authenticated
using (
  bucket_id = 'media' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or storage.filename(name) not like 'family-%'
    or public.is_staff()
    or exists (
      select 1 from public.booking_requests r
      where r.parent_id::text = (storage.foldername(name))[1] and r.sitter_id = auth.uid()
    )
  )
);
