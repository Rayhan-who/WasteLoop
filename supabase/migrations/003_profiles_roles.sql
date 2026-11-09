-- 003 · Profiles, roles, organisations (FR-1.x, FR-2.x)
set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Shared trigger: keep updated_at current on every table.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Coarse public location: snap to a ~500 m grid (0.0045° ≈ 500 m of latitude,
-- ≈ 460 m of longitude at Dhaka). Used for profiles.approx_point and for the
-- point exposed by listings_public (SRS §4.4).
create or replace function public.snap_point(p extensions.geography)
returns extensions.geography
language sql
immutable
parallel safe
set search_path = public, extensions
as $$
  select case when p is null then null
              else extensions.st_snaptogrid(p::extensions.geometry, 0.0045)::extensions.geography end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user. Only the owner and admins can read the
-- full row (RLS, migration 008); other users see profiles_public.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  display_name     text not null check (char_length(display_name) between 1 and 80),
  org_name         text check (char_length(org_name) <= 120),
  phone            text check (char_length(phone) <= 20),
  email            text,
  bio              text check (char_length(bio) <= 600),
  avatar_url       text,
  general_location text check (char_length(general_location) <= 120),  -- e.g. "Mirpur, Dhaka"
  approx_point     geography(Point, 4326),                              -- always grid-snapped (trigger below)
  locale           text not null default 'bn' check (locale in ('bn', 'en')),
  is_suspended     boolean not null default false,
  deactivated_at   timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.profiles_snap_point()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  new.approx_point := public.snap_point(new.approx_point);
  return new;
end;
$$;

create trigger profiles_snap_point before insert or update of approx_point on public.profiles
  for each row execute function public.profiles_snap_point();

-- ---------------------------------------------------------------------------
-- user_roles: a user may hold several roles (FR-1.2).
-- ---------------------------------------------------------------------------
create table public.user_roles (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       public.user_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, role)
);

create trigger user_roles_set_updated_at before update on public.user_roles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Role helpers. SECURITY DEFINER so they read user_roles without recursing
-- through its RLS. Admin checks always use is_admin(), never a JWT claim the
-- client could shape (Build Prompt §3).
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function public.has_role(p_role public.user_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role = p_role
  );
$$;

create or replace function public.has_taker_role()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role in ('farmer', 'energy_plant', 'recycler', 'charity')
  );
$$;

-- Signed in, not suspended, not deactivated.
create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and not is_suspended and deactivated_at is null
  );
$$;

-- ---------------------------------------------------------------------------
-- Only admins may change suspension. Rows changed from a trusted server
-- context (no end-user JWT, e.g. seed or service role) are allowed.
-- ---------------------------------------------------------------------------
create or replace function public.profiles_guard_privileged()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not public.is_admin() then
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

create trigger profiles_guard_privileged before update on public.profiles
  for each row execute function public.profiles_guard_privileged();

-- ---------------------------------------------------------------------------
-- organisations: verification (FR-2.x). One organisation per user.
-- ---------------------------------------------------------------------------
create table public.organisations (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null unique references public.profiles (id) on delete cascade,
  legal_name          text not null check (char_length(legal_name) between 2 and 160),
  registration_number text check (char_length(registration_number) <= 60),
  document_path       text,                       -- object path in the private verification-docs bucket
  verification_status public.verification_status not null default 'unsubmitted',
  submitted_at        timestamptz,
  reviewed_by         uuid references public.profiles (id) on delete set null,
  reviewed_at         timestamptz,
  reviewer_note       text check (char_length(reviewer_note) <= 1000),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index organisations_status_idx on public.organisations (verification_status);

create trigger organisations_set_updated_at before update on public.organisations
  for each row execute function public.set_updated_at();

-- Owners may submit (→ pending) but never approve themselves. Editing the
-- legal details of an approved organisation sends it back for review.
create or replace function public.organisations_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.verification_status not in ('unsubmitted', 'pending') then
      raise exception 'Invalid initial verification status' using errcode = '42501';
    end if;
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.reviewer_note := null;
    if new.verification_status = 'pending' then new.submitted_at := now(); end if;
    return new;
  end if;

  -- UPDATE by the owner
  new.reviewed_by := old.reviewed_by;
  new.reviewed_at := old.reviewed_at;
  new.reviewer_note := old.reviewer_note;
  new.owner_id := old.owner_id;

  if new.verification_status is distinct from old.verification_status then
    if not (new.verification_status = 'pending'
            and old.verification_status in ('unsubmitted', 'rejected', 'more_info')) then
      raise exception 'Only an administrator can set verification status to %', new.verification_status
        using errcode = '42501';
    end if;
    new.submitted_at := now();
  elsif old.verification_status = 'approved'
        and (new.legal_name, new.registration_number, new.document_path)
            is distinct from (old.legal_name, old.registration_number, old.document_path) then
    new.verification_status := 'pending';
    new.submitted_at := now();
  end if;

  return new;
end;
$$;

create trigger organisations_guard before insert or update on public.organisations
  for each row execute function public.organisations_guard();

-- ---------------------------------------------------------------------------
-- New auth user → profile + self-chosen roles (FR-1.1, FR-1.2).
-- raw_user_meta_data is client-controlled, so only self-service roles are
-- accepted from it; 'admin' is silently dropped.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_locale text := case when meta ->> 'locale' in ('bn', 'en') then meta ->> 'locale' else 'bn' end;
  v_name text := nullif(btrim(meta ->> 'display_name'), '');
begin
  insert into public.profiles (id, display_name, org_name, phone, email, locale)
  values (
    new.id,
    left(coalesce(v_name, split_part(coalesce(new.email, 'user'), '@', 1)), 80),
    left(nullif(btrim(meta ->> 'org_name'), ''), 120),
    left(nullif(btrim(coalesce(meta ->> 'phone', new.phone)), ''), 20),
    new.email,
    v_locale
  );

  if jsonb_typeof(meta -> 'roles') = 'array' then
    insert into public.user_roles (user_id, role)
    select distinct new.id, r::public.user_role
    from jsonb_array_elements_text(meta -> 'roles') as r
    where r in ('provider', 'farmer', 'energy_plant', 'recycler', 'charity');
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
