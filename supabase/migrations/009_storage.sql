-- 009 · Storage buckets and policies
--
-- listing-photos      public read; a user writes only under "<their uid>/…"
-- verification-docs   private; owner and admins read; owner writes "<uid>/…"
--
-- Object paths always start with the uploader's user id, so ownership is
-- checked with (storage.foldername(name))[1] = auth.uid()::text.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('listing-photos', 'listing-photos', true, 5 * 1024 * 1024,
   array['image/jpeg', 'image/png', 'image/webp']),
  ('verification-docs', 'verification-docs', false, 10 * 1024 * 1024,
   array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- listing-photos ------------------------------------------------------------
create policy "listing photos are publicly readable"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'listing-photos');

create policy "users upload listing photos to their own folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "users update their own listing photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "users delete their own listing photos, admins any"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'listing-photos'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin()))
  );

-- verification-docs ---------------------------------------------------------
create policy "owners and admins read verification documents"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'verification-docs'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin()))
  );

create policy "users upload verification documents to their own folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'verification-docs' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "users delete their own verification documents"
  on storage.objects for delete to authenticated
  using (bucket_id = 'verification-docs' and (storage.foldername(name))[1] = (select auth.uid())::text);
