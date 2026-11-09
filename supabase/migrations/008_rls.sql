-- 008 · Row Level Security and grants (Build Prompt §3 "RLS")
--
-- Every table in public has RLS enabled; tests/db/rls.test.ts fails if one
-- does not. Policies reference auth.uid() through (select auth.uid()) so it
-- is evaluated once per statement, not once per row.
set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Grants. Anonymous visitors may only read the public read models; signed-in
-- users get table privileges, which RLS then narrows row by row.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

grant select on public.listings_public, public.profiles_public to anon, authenticated;
grant select on public.listing_photos, public.reviews to anon;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;

-- The audit log is written only through admin server code and never edited.
revoke update, delete, truncate on public.admin_audit_log from authenticated;
-- Payments are written only by trusted server code (milestone 7).
revoke insert, update, delete on public.transactions from authenticated;
-- Impact rows are written only when a pickup completes (trigger, milestone 6).
revoke insert, update, delete on public.impact_records from authenticated;
-- Read receipts go through mark_messages_read(); messages are never edited.
revoke update, delete on public.messages from authenticated;

-- Internal function: never callable by clients.
revoke execute on function public.begin_trusted_op() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Public RPCs.
grant execute on function public.get_listing_detail(uuid) to anon, authenticated;
grant execute on function public.increment_listing_view(uuid) to anon, authenticated;
grant execute on function public.public_impact_stats() to anon, authenticated;
grant execute on function public.mark_messages_read(uuid) to authenticated;
revoke execute on function public.mark_messages_read(uuid) from anon;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere.
-- ---------------------------------------------------------------------------
alter table public.profiles                 enable row level security;
alter table public.user_roles               enable row level security;
alter table public.organisations            enable row level security;
alter table public.listings                 enable row level security;
alter table public.listing_photos           enable row level security;
alter table public.saved_interests          enable row level security;
alter table public.requests                 enable row level security;
alter table public.messages                 enable row level security;
alter table public.pickups                  enable row level security;
alter table public.transactions             enable row level security;
alter table public.reviews                  enable row level security;
alter table public.reports                  enable row level security;
alter table public.notifications            enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.impact_records           enable row level security;
alter table public.admin_audit_log          enable row level security;

-- ---------------------------------------------------------------------------
-- profiles: own row only (others use profiles_public); admins see all.
-- ---------------------------------------------------------------------------
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()))
  with check (id = (select auth.uid()) or (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- user_roles: users manage their own non-admin roles; only admins grant admin.
-- ---------------------------------------------------------------------------
create policy user_roles_select_own on public.user_roles
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy user_roles_insert_own on public.user_roles
  for insert to authenticated
  with check ((user_id = (select auth.uid()) and role <> 'admin') or (select public.is_admin()));

create policy user_roles_delete_own on public.user_roles
  for delete to authenticated
  using ((user_id = (select auth.uid()) and role <> 'admin') or (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- organisations: owner and admins. Field-level rules live in organisations_guard.
-- ---------------------------------------------------------------------------
create policy organisations_select on public.organisations
  for select to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_admin()));

create policy organisations_insert_own on public.organisations
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy organisations_update on public.organisations
  for update to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_admin()))
  with check (owner_id = (select auth.uid()) or (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- listings: the base table holds pickup_address_exact, so a row is visible
-- only to its provider, a taker with an accepted request, and admins
-- (SRS §4.4). Everyone else reads listings_public / get_listing_detail().
-- ---------------------------------------------------------------------------
create policy listings_select_private on public.listings
  for select to authenticated
  using (
    provider_id = (select auth.uid())
    or (select public.is_admin())
    or public.is_accepted_taker(id)
  );

create policy listings_insert_provider on public.listings
  for insert to authenticated
  with check (
    provider_id = (select auth.uid())
    and (select public.has_role('provider'))
    and (select public.is_active_user())
  );

create policy listings_update_owner on public.listings
  for update to authenticated
  using (provider_id = (select auth.uid()) or (select public.is_admin()))
  with check (provider_id = (select auth.uid()) or (select public.is_admin()));

-- Listings with requests cannot be deleted (FK RESTRICT); pause them instead.
create policy listings_delete_owner on public.listings
  for delete to authenticated
  using (provider_id = (select auth.uid()) and status in ('draft', 'available', 'paused', 'expired'));

-- ---------------------------------------------------------------------------
-- listing_photos: public for public listings; writable by the listing owner.
-- ---------------------------------------------------------------------------
create policy listing_photos_select on public.listing_photos
  for select to anon, authenticated
  using (
    public.listing_is_public(listing_id)
    or public.is_listing_provider(listing_id)
    or (select public.is_admin())
  );

create policy listing_photos_insert_owner on public.listing_photos
  for insert to authenticated
  with check (public.is_listing_provider(listing_id));

create policy listing_photos_update_owner on public.listing_photos
  for update to authenticated
  using (public.is_listing_provider(listing_id))
  with check (public.is_listing_provider(listing_id));

create policy listing_photos_delete on public.listing_photos
  for delete to authenticated
  using (public.is_listing_provider(listing_id) or (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- saved_interests: owner only.
-- ---------------------------------------------------------------------------
create policy saved_interests_own on public.saved_interests
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- requests: visible to the taker, the listing's provider, and admins.
-- ---------------------------------------------------------------------------
create policy requests_select on public.requests
  for select to authenticated
  using (
    taker_id = (select auth.uid())
    or public.is_listing_provider(listing_id)
    or (select public.is_admin())
  );

create policy requests_insert_taker on public.requests
  for insert to authenticated
  with check (
    taker_id = (select auth.uid())
    and status = 'pending'
    and (select public.has_taker_role())
    and (select public.is_active_user())
    and not public.is_listing_provider(listing_id)
  );

create policy requests_update_party on public.requests
  for update to authenticated
  using (taker_id = (select auth.uid()) or public.is_listing_provider(listing_id))
  with check (taker_id = (select auth.uid()) or public.is_listing_provider(listing_id));

-- ---------------------------------------------------------------------------
-- messages: only the two parties of an accepted request (FR-5.3).
-- Admins are deliberately excluded: private conversations stay private.
-- ---------------------------------------------------------------------------
create policy messages_select_parties on public.messages
  for select to authenticated
  using (public.is_accepted_request_party(request_id));

create policy messages_insert_party on public.messages
  for insert to authenticated
  with check (sender_id = (select auth.uid()) and public.is_accepted_request_party(request_id));

-- ---------------------------------------------------------------------------
-- pickups: the two parties; admins may read.
-- ---------------------------------------------------------------------------
create policy pickups_select on public.pickups
  for select to authenticated
  using (public.is_request_party(request_id) or (select public.is_admin()));

create policy pickups_insert_party on public.pickups
  for insert to authenticated
  with check (proposed_by = (select auth.uid()) and public.is_accepted_request_party(request_id));

create policy pickups_update_party on public.pickups
  for update to authenticated
  using (public.is_accepted_request_party(request_id))
  with check (public.is_accepted_request_party(request_id));

-- ---------------------------------------------------------------------------
-- transactions: payer, payee and admins may read. No client writes.
-- ---------------------------------------------------------------------------
create policy transactions_select on public.transactions
  for select to authenticated
  using (payer_id = (select auth.uid()) or payee_id = (select auth.uid()) or (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- reviews: public; written by a party once the exchange is complete
-- (reviews_validate enforces completion and parties).
-- ---------------------------------------------------------------------------
create policy reviews_select_public on public.reviews
  for select to anon, authenticated
  using (true);

create policy reviews_insert_party on public.reviews
  for insert to authenticated
  with check (reviewer_id = (select auth.uid()) and public.is_request_party(request_id));

-- ---------------------------------------------------------------------------
-- reports: anyone signed in may report; reporters see their own; admins handle.
-- ---------------------------------------------------------------------------
create policy reports_insert on public.reports
  for insert to authenticated
  with check (reporter_id = (select auth.uid()) and status = 'open');

create policy reports_select on public.reports
  for select to authenticated
  using (reporter_id = (select auth.uid()) or (select public.is_admin()));

create policy reports_update_admin on public.reports
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- notifications: own rows. Rows for other users are created by trusted
-- server code (milestone 9), never by one client for another.
-- ---------------------------------------------------------------------------
create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy notifications_insert_own on public.notifications
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy notifications_delete_own on public.notifications
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- notification_preferences: owner only.
-- ---------------------------------------------------------------------------
create policy notification_preferences_own on public.notification_preferences
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- impact_records: own rows and admins.
-- ---------------------------------------------------------------------------
create policy impact_records_select on public.impact_records
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- admin_audit_log: admins read; admins append as themselves (FR-11.3).
-- ---------------------------------------------------------------------------
create policy admin_audit_log_select_admin on public.admin_audit_log
  for select to authenticated
  using ((select public.is_admin()));

create policy admin_audit_log_insert_admin on public.admin_audit_log
  for insert to authenticated
  with check ((select public.is_admin()) and actor_id = (select auth.uid()));
