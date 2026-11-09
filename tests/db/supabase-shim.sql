-- TEST ONLY. Recreates the parts of a Supabase database that the WasteLoop
-- migrations depend on, so they can run unchanged inside PGlite:
--   roles anon / authenticated / service_role, auth.users, auth.identities,
--   auth.uid() / auth.role() / auth.jwt(), storage.buckets / storage.objects,
--   storage.foldername(), and Supabase's default privileges on public.
-- Never apply this to a real Supabase project; those objects already exist.

create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

create schema auth;
create schema storage;
create schema if not exists extensions;

grant usage on schema public, auth, storage, extensions to anon, authenticated, service_role;

-- auth ----------------------------------------------------------------------
create table auth.users (
  instance_id                uuid,
  id                         uuid primary key,
  aud                        varchar(255),
  role                       varchar(255),
  email                      varchar(255),
  encrypted_password         varchar(255),
  email_confirmed_at         timestamptz,
  phone                      text,
  raw_app_meta_data          jsonb,
  raw_user_meta_data         jsonb,
  confirmation_token         varchar(255),
  recovery_token             varchar(255),
  email_change_token_new     varchar(255),
  email_change               varchar(255),
  created_at                 timestamptz,
  updated_at                 timestamptz
);

create table auth.identities (
  id              uuid primary key default gen_random_uuid(),
  provider_id     text not null,
  user_id         uuid not null references auth.users (id) on delete cascade,
  identity_data   jsonb not null,
  provider        text not null,
  last_sign_in_at timestamptz,
  created_at      timestamptz,
  updated_at      timestamptz,
  unique (provider_id, provider)
);

-- Same definitions Supabase uses: claims come from request.jwt.claim(s).
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create function auth.role() returns text language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;

create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

grant execute on all functions in schema auth to anon, authenticated, service_role;

-- storage -------------------------------------------------------------------
create table storage.buckets (
  id                 text primary key,
  name               text not null unique,
  owner              uuid,
  public             boolean default false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

create table storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text references storage.buckets (id),
  name       text,
  owner      uuid,
  owner_id   text,
  metadata   jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (bucket_id, name)
);

alter table storage.objects enable row level security;

create function storage.foldername(name text) returns text[] language plpgsql immutable as $$
declare
  _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1 : array_length(_parts, 1) - 1];
end
$$;

grant all on storage.objects, storage.buckets to anon, authenticated, service_role;

-- Supabase's default privileges on public ------------------------------------
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
