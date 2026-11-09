-- 004 · Listings, photos, saved interests (FR-3.x, FR-4.3)
set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- listings. The exact pickup point and address are private (SRS §4.4):
-- RLS (migration 008) lets only the owner, an accepted taker and admins read
-- a row; everyone else reads listings_public (migration 007).
-- ---------------------------------------------------------------------------
create table public.listings (
  id                    uuid primary key default gen_random_uuid(),
  provider_id           uuid not null references public.profiles (id) on delete cascade,
  title                 text not null check (char_length(title) between 3 and 120),
  description           text not null default '' check (char_length(description) <= 2000),
  waste_type            public.waste_type not null,
  quantity_value        numeric(12, 2) not null check (quantity_value > 0),
  quantity_unit         public.quantity_unit not null,
  offer_type            public.listing_offer_type not null,
  price_amount          numeric(12, 2),
  currency              char(3) not null default 'BDT',
  available_from        timestamptz not null default now(),
  available_until       timestamptz not null,
  pickup_point          geography(Point, 4326) not null,
  pickup_address_exact  text not null check (char_length(pickup_address_exact) between 3 and 500),
  pickup_area_label     text not null check (char_length(pickup_area_label) between 2 and 120),
  status                public.listing_status not null default 'draft',
  collected_at          timestamptz,
  view_count            integer not null default 0 check (view_count >= 0),
  flagged_for_review    boolean not null default false,
  ml_suggested_category public.waste_type,                                       -- reserved: FR-3.6
  ml_confidence         real check (ml_confidence between 0 and 1),              -- reserved: FR-3.6
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint listings_window_valid check (available_until > available_from),
  -- FR-7.3: only for_sale listings carry a price; free/donation never do.
  constraint listings_price_only_for_sale check (
    (offer_type = 'for_sale' and price_amount is not null and price_amount > 0)
    or (offer_type <> 'for_sale' and price_amount is null)
  ),
  constraint listings_collected_at_matches check ((status = 'collected') = (collected_at is not null)),
  -- Target of the composite FK from transactions (FR-7.3, migration 005).
  constraint listings_id_offer_type_key unique (id, offer_type)
);

create index listings_pickup_point_gist on public.listings using gist (pickup_point);
create index listings_status_type_until_idx on public.listings (status, waste_type, available_until);
create index listings_provider_idx on public.listings (provider_id, created_at desc);

create trigger listings_set_updated_at before update on public.listings
  for each row execute function public.set_updated_at();

-- Marks the rest of the current transaction as a trusted server operation.
-- Only callable from other SECURITY DEFINER functions (EXECUTE is revoked
-- from client roles in migration 008).
create or replace function public.begin_trusted_op()
returns void
language sql
set search_path = ''
as $$
  select set_config('wasteloop.trusted_op', 'on', true);
$$;

-- Owners cannot touch moderation fields, resurrect a removed listing, or
-- remove a listing themselves (they delete or pause it instead).
create or replace function public.listings_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Trusted contexts: no end-user JWT (seed, service role), an admin, or a
  -- SECURITY DEFINER function that set the transaction-local flag via
  -- public.begin_trusted_op(). Clients cannot SET this through PostgREST.
  if (select auth.uid()) is null or public.is_admin()
     or current_setting('wasteloop.trusted_op', true) = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status not in ('draft', 'available') then
      raise exception 'A new listing must be a draft or available' using errcode = '42501';
    end if;
    new.view_count := 0;
    new.flagged_for_review := false;
    new.collected_at := null;
    return new;
  end if;

  if old.status = 'removed' then
    raise exception 'This listing was removed by a moderator' using errcode = '42501';
  end if;
  if new.status = 'removed' then
    raise exception 'Only a moderator can remove a listing' using errcode = '42501';
  end if;
  new.flagged_for_review := old.flagged_for_review;
  new.view_count := old.view_count;
  new.provider_id := old.provider_id;
  return new;
end;
$$;

create trigger listings_guard before insert or update on public.listings
  for each row execute function public.listings_guard();

-- ---------------------------------------------------------------------------
-- listing_photos: up to six per listing, stored in the listing-photos bucket.
-- ---------------------------------------------------------------------------
create table public.listing_photos (
  id           uuid primary key default gen_random_uuid(),
  listing_id   uuid not null references public.listings (id) on delete cascade,
  storage_path text not null unique,
  sort_order   smallint not null default 0 check (sort_order between 0 and 5),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (listing_id, sort_order)
);

create trigger listing_photos_set_updated_at before update on public.listing_photos
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- saved_interests: powers new-matching-listing alerts (FR-4.3).
-- An empty array means "any".
-- ---------------------------------------------------------------------------
create table public.saved_interests (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  label           text check (char_length(label) <= 80),
  waste_types     public.waste_type[] not null default '{}',
  max_distance_km numeric(6, 1) not null default 10 check (max_distance_km > 0 and max_distance_km <= 200),
  centre_point    geography(Point, 4326) not null,
  offer_types     public.listing_offer_type[] not null default '{}',
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index saved_interests_centre_gist on public.saved_interests using gist (centre_point);
create index saved_interests_user_idx on public.saved_interests (user_id);

create trigger saved_interests_set_updated_at before update on public.saved_interests
  for each row execute function public.set_updated_at();

-- profiles.approx_point index (declared here with the other GIST indexes).
create index profiles_approx_point_gist on public.profiles using gist (approx_point);
