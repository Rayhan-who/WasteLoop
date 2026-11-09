-- 007 · Public read models and the exact-address gate (SRS §4.4)
--
-- listings_public and profiles_public are deliberately NOT security_invoker:
-- they run with the owner's rights so anonymous and signed-in users can read
-- the safe columns of rows that RLS on the base tables hides from them. They
-- never select pickup_address_exact, the exact pickup point, phone or e-mail.
-- (Supabase's linter flags these as "security definer views"; that is intended.)
set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- listings_public: every browse, search and map query reads this view.
-- pickup_point is replaced by the ~500 m grid-snapped point.
-- ---------------------------------------------------------------------------
create view public.listings_public
with (security_barrier = true)
as
select
  l.id,
  l.provider_id,
  l.title,
  l.description,
  l.waste_type,
  l.quantity_value,
  l.quantity_unit,
  l.offer_type,
  l.price_amount,
  l.currency,
  l.available_from,
  l.available_until,
  public.snap_point(l.pickup_point)                                    as pickup_point,
  extensions.st_y(public.snap_point(l.pickup_point)::extensions.geometry) as approx_lat,
  extensions.st_x(public.snap_point(l.pickup_point)::extensions.geometry) as approx_lng,
  l.pickup_area_label,
  l.status,
  l.view_count,
  l.created_at,
  l.updated_at,
  p.display_name                                                       as provider_display_name,
  p.org_name                                                           as provider_org_name,
  exists (
    select 1 from public.organisations o
    where o.owner_id = l.provider_id and o.verification_status = 'approved'
  )                                                                    as provider_verified,
  (
    select ph.storage_path from public.listing_photos ph
    where ph.listing_id = l.id
    order by ph.sort_order
    limit 1
  )                                                                    as cover_photo_path
from public.listings l
join public.profiles p on p.id = l.provider_id
where (l.status = 'reserved' or (l.status = 'available' and l.available_until > now()))
  and not p.is_suspended
  and p.deactivated_at is null;

comment on view public.listings_public is
  'Public listing read model (SRS §4.4): no exact address, pickup_point snapped to a ~500 m grid.';

-- ---------------------------------------------------------------------------
-- profiles_public: what other users may see about a person or organisation.
-- ---------------------------------------------------------------------------
create view public.profiles_public
with (security_barrier = true)
as
select
  p.id,
  p.display_name,
  p.org_name,
  p.avatar_url,
  p.bio,
  p.general_location,
  p.approx_point,
  coalesce(
    (select array_agg(ur.role order by ur.role) from public.user_roles ur
     where ur.user_id = p.id and ur.role <> 'admin'),
    '{}'::public.user_role[]
  )                                                             as roles,
  exists (
    select 1 from public.organisations o
    where o.owner_id = p.id and o.verification_status = 'approved'
  )                                                             as is_verified,
  (select round(avg(r.rating)::numeric, 2) from public.reviews r where r.reviewee_id = p.id) as rating_avg,
  (select count(*)::integer from public.reviews r where r.reviewee_id = p.id)               as rating_count,
  p.created_at
from public.profiles p
where not p.is_suspended
  and p.deactivated_at is null;

-- ---------------------------------------------------------------------------
-- get_listing_detail: the only path to pickup_address_exact for anyone other
-- than the owner. Returns the exact address and point only to the listing
-- owner, a taker with an accepted request on it, or an admin. Everyone else
-- gets the public fields of a public listing, with those columns NULL.
-- ---------------------------------------------------------------------------
create or replace function public.get_listing_detail(p_listing_id uuid)
returns table (
  id                    uuid,
  provider_id           uuid,
  title                 text,
  description           text,
  waste_type            public.waste_type,
  quantity_value        numeric,
  quantity_unit         public.quantity_unit,
  offer_type            public.listing_offer_type,
  price_amount          numeric,
  currency              text,
  available_from        timestamptz,
  available_until       timestamptz,
  approx_lat            double precision,
  approx_lng            double precision,
  pickup_area_label     text,
  status                public.listing_status,
  collected_at          timestamptz,
  view_count            integer,
  created_at            timestamptz,
  updated_at            timestamptz,
  provider_display_name text,
  provider_org_name     text,
  provider_verified     boolean,
  viewer_relation       text,               -- 'owner' | 'admin' | 'accepted_taker' | 'public'
  pickup_address_exact  text,               -- NULL unless viewer_relation <> 'public'
  exact_lat             double precision,   -- NULL unless viewer_relation <> 'public'
  exact_lng             double precision    -- NULL unless viewer_relation <> 'public'
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with ctx as (
    select
      l.*,
      pr.display_name as p_display_name,
      pr.org_name     as p_org_name,
      pr.is_suspended as p_suspended,
      pr.deactivated_at as p_deactivated_at,
      case
        when l.provider_id = (select auth.uid()) then 'owner'
        when public.is_admin() then 'admin'
        when exists (
          select 1 from public.requests r
          where r.listing_id = l.id and r.taker_id = (select auth.uid()) and r.status = 'accepted'
        ) then 'accepted_taker'
        else 'public'
      end as relation
    from public.listings l
    join public.profiles pr on pr.id = l.provider_id
    where l.id = p_listing_id
  )
  select
    c.id, c.provider_id, c.title, c.description, c.waste_type,
    c.quantity_value, c.quantity_unit, c.offer_type, c.price_amount, c.currency::text,
    c.available_from, c.available_until,
    st_y(public.snap_point(c.pickup_point)::geometry),
    st_x(public.snap_point(c.pickup_point)::geometry),
    c.pickup_area_label, c.status, c.collected_at, c.view_count, c.created_at, c.updated_at,
    c.p_display_name, c.p_org_name,
    exists (select 1 from public.organisations o
            where o.owner_id = c.provider_id and o.verification_status = 'approved'),
    c.relation,
    case when c.relation <> 'public' then c.pickup_address_exact end,
    case when c.relation <> 'public' then st_y(c.pickup_point::geometry) end,
    case when c.relation <> 'public' then st_x(c.pickup_point::geometry) end
  from ctx c
  where c.relation <> 'public'
     or (c.status in ('available', 'reserved') and not c.p_suspended and c.p_deactivated_at is null);
$$;

-- ---------------------------------------------------------------------------
-- View counter: anyone but the owner viewing a public listing.
-- ---------------------------------------------------------------------------
create or replace function public.increment_listing_view(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.listing_is_public(p_listing_id) or public.is_listing_provider(p_listing_id) then
    return;
  end if;
  perform public.begin_trusted_op();
  update public.listings set view_count = view_count + 1 where id = p_listing_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Landing-page counters: aggregate only, safe for anonymous visitors.
-- ---------------------------------------------------------------------------
create or replace function public.public_impact_stats()
returns table (kg_diverted numeric, active_listings bigint, completed_exchanges bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce((select sum(quantity_kg) from public.impact_records where role_side = 'provider'), 0),
    (select count(*) from public.listings where status = 'available' and available_until > now()),
    (select count(*) from public.pickups where status = 'completed');
$$;
