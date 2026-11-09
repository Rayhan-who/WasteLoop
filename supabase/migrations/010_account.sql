-- 010 · Account lifecycle (FR-1.x): e-mail sync, deactivation, data removal requests
set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- The privileged-column guard also honours the trusted-operation flag, so the
-- auth → profile e-mail sync below can update profiles.email.
-- ---------------------------------------------------------------------------
create or replace function public.profiles_guard_privileged()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
     and not public.is_admin()
     and current_setting('wasteloop.trusted_op', true) is distinct from 'on' then
    if new.is_suspended is distinct from old.is_suspended then
      raise exception 'Only an administrator can change suspension' using errcode = '42501';
    end if;
    if new.email is distinct from old.email then
      raise exception 'E-mail is managed by authentication' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- Keep profiles.email in step with auth.users when a user confirms a new address.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    perform public.begin_trusted_op();
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed after update of email on auth.users
  for each row execute function public.handle_user_email_change();

revoke execute on function public.handle_user_email_change() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- data_removal_requests: a user asks for their personal data to be erased.
-- Admins action it (milestone 11) by deleting the auth user, which cascades.
-- The row survives the erasure (user_id → NULL) as the record of compliance.
-- ---------------------------------------------------------------------------
create table public.data_removal_requests (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references public.profiles (id) on delete set null,
  email_snapshot text,
  reason         text check (char_length(reason) <= 1000),
  status         text not null default 'open' check (status in ('open', 'completed', 'cancelled')),
  handled_by     uuid references public.profiles (id) on delete set null,
  handled_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint data_removal_requests_handled check ((status = 'open') = (handled_at is null))
);

create unique index data_removal_requests_one_open
  on public.data_removal_requests (user_id) where status = 'open';
create index data_removal_requests_status_idx on public.data_removal_requests (status, created_at);

create trigger data_removal_requests_set_updated_at before update on public.data_removal_requests
  for each row execute function public.set_updated_at();

alter table public.data_removal_requests enable row level security;
grant select, insert, update on public.data_removal_requests to authenticated;
revoke all on public.data_removal_requests from anon;

create policy data_removal_requests_insert_own on public.data_removal_requests
  for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'open' and handled_by is null);

create policy data_removal_requests_select on public.data_removal_requests
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy data_removal_requests_update_admin on public.data_removal_requests
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
