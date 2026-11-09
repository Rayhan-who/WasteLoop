-- 005 · Requests, messaging, pickups, payments, reviews (FR-5.x, FR-6.x, FR-7.x, FR-8.x)
-- Status *transitions* are guarded in src/lib/exchange/transitions.ts and by
-- the transition triggers added in milestone 6. This migration enforces the
-- invariants that must hold whatever the code does.
set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Helpers used by triggers here and by RLS policies in 008. SECURITY DEFINER
-- avoids policy recursion between listings and requests.
-- ---------------------------------------------------------------------------
create or replace function public.is_listing_provider(p_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.listings
    where id = p_listing_id and provider_id = (select auth.uid())
  );
$$;

create or replace function public.listing_is_public(p_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.listings l
    join public.profiles p on p.id = l.provider_id
    where l.id = p_listing_id
      and l.status in ('available', 'reserved')
      and not p.is_suspended and p.deactivated_at is null
  );
$$;

-- ---------------------------------------------------------------------------
-- requests: a taker asks for a listing.
-- ---------------------------------------------------------------------------
create table public.requests (
  id         uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete restrict,
  taker_id   uuid not null references public.profiles (id) on delete cascade,
  message    text not null default '' check (char_length(message) <= 1000),
  status     public.request_status not null default 'pending',
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One active request per taker per listing.
create unique index requests_one_active_per_taker
  on public.requests (listing_id, taker_id) where status in ('pending', 'accepted');
-- At most one accepted request per listing.
create unique index requests_one_accepted_per_listing
  on public.requests (listing_id) where status = 'accepted';
create index requests_listing_idx on public.requests (listing_id);
create index requests_taker_idx on public.requests (taker_id, created_at desc);

create trigger requests_set_updated_at before update on public.requests
  for each row execute function public.set_updated_at();

create or replace function public.requests_validate_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  l record;
begin
  select provider_id, status, available_until into l from public.listings where id = new.listing_id;
  if not found then
    raise exception 'Listing not found' using errcode = 'P0002';
  end if;
  if l.provider_id = new.taker_id then
    raise exception 'You cannot request your own listing' using errcode = '23514';
  end if;
  if l.status <> 'available' then
    raise exception 'This listing is not available' using errcode = '23514';
  end if;
  if (select auth.uid()) is not null and l.available_until <= now() then
    raise exception 'This listing has expired' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger requests_validate_insert before insert on public.requests
  for each row execute function public.requests_validate_insert();

-- Request helpers for RLS (defined after the table exists).
create or replace function public.is_request_party(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.requests r
    join public.listings l on l.id = r.listing_id
    where r.id = p_request_id
      and (select auth.uid()) in (r.taker_id, l.provider_id)
  );
$$;

-- Messaging opens only once a request is accepted (FR-5.3).
create or replace function public.is_accepted_request_party(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.requests r
    join public.listings l on l.id = r.listing_id
    where r.id = p_request_id
      and r.status = 'accepted'
      and (select auth.uid()) in (r.taker_id, l.provider_id)
  );
$$;

create or replace function public.is_accepted_taker(p_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.requests
    where listing_id = p_listing_id
      and taker_id = (select auth.uid())
      and status = 'accepted'
  );
$$;

-- ---------------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------------
create table public.messages (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id) on delete cascade,
  sender_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 2000),
  read_at    timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index messages_request_created_idx on public.messages (request_id, created_at);

create trigger messages_set_updated_at before update on public.messages
  for each row execute function public.set_updated_at();

-- Read receipts without giving clients UPDATE on messages.
create or replace function public.mark_messages_read(p_request_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  if not public.is_accepted_request_party(p_request_id) then
    raise exception 'Not a party to this exchange' using errcode = '42501';
  end if;
  update public.messages
     set read_at = now()
   where request_id = p_request_id
     and sender_id <> (select auth.uid())
     and read_at is null;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- pickups: one per request.
-- ---------------------------------------------------------------------------
create table public.pickups (
  id                   uuid primary key default gen_random_uuid(),
  request_id           uuid not null unique references public.requests (id) on delete cascade,
  scheduled_at         timestamptz not null,
  status               public.pickup_status not null default 'proposed',
  proposed_by          uuid not null references public.profiles (id) on delete cascade,
  provider_confirmed   boolean not null default false,   -- handover confirmed by provider (FR-5.4)
  taker_confirmed      boolean not null default false,   -- handover confirmed by taker (FR-5.4)
  completed_at         timestamptz,
  cancelled_reason     text check (char_length(cancelled_reason) <= 500),
  reminder_24h_sent_at timestamptz,                      -- FR-6.2
  reminder_2h_sent_at  timestamptz,                      -- FR-6.2
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint pickups_completed_needs_both check (
    status <> 'completed' or (provider_confirmed and taker_confirmed and completed_at is not null)
  )
);

create index pickups_scheduled_idx on public.pickups (status, scheduled_at);

create trigger pickups_set_updated_at before update on public.pickups
  for each row execute function public.set_updated_at();

-- FR-6.1: a pickup must fall inside the listing's availability window.
create or replace function public.pickups_validate_window()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  l record;
begin
  select li.available_from, li.available_until into l
  from public.requests r join public.listings li on li.id = r.listing_id
  where r.id = new.request_id;

  if new.scheduled_at < l.available_from or new.scheduled_at > l.available_until then
    raise exception 'Pickup must be scheduled inside the listing''s availability window'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger pickups_validate_window before insert or update of scheduled_at on public.pickups
  for each row execute function public.pickups_validate_window();

-- ---------------------------------------------------------------------------
-- transactions (FR-7.1–7.3).
-- FR-7.3 is declarative: offer_type is pinned to 'for_sale' by a CHECK, and
-- the composite FK forces it to equal the listing's offer_type. A free or
-- donation listing therefore cannot have a transaction row at all.
-- ---------------------------------------------------------------------------
create sequence public.receipt_number_seq;

create table public.transactions (
  id             uuid primary key default gen_random_uuid(),
  listing_id     uuid not null,
  offer_type     public.listing_offer_type not null default 'for_sale',
  request_id     uuid not null references public.requests (id) on delete restrict,
  payer_id       uuid not null references public.profiles (id) on delete restrict,
  payee_id       uuid not null references public.profiles (id) on delete restrict,
  amount         numeric(12, 2) not null check (amount > 0),
  currency       char(3) not null default 'BDT',
  status         public.payment_status not null default 'pending',
  provider       text not null default 'mock',
  provider_ref   text,
  receipt_number text unique,
  paid_at        timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint transactions_only_for_sale check (offer_type = 'for_sale'),
  constraint transactions_listing_offer_fk foreign key (listing_id, offer_type)
    references public.listings (id, offer_type) on update restrict on delete restrict,
  constraint transactions_paid_fields check ((status in ('paid', 'refunded')) = (paid_at is not null and receipt_number is not null)),
  constraint transactions_distinct_parties check (payer_id <> payee_id)
);

create unique index transactions_one_paid_per_request on public.transactions (request_id) where status = 'paid';
create index transactions_listing_idx on public.transactions (listing_id);
create index transactions_payer_idx on public.transactions (payer_id, created_at desc);
create index transactions_payee_idx on public.transactions (payee_id, created_at desc);

create trigger transactions_set_updated_at before update on public.transactions
  for each row execute function public.set_updated_at();

-- Amount, payer and payee must match the listing and its accepted request.
-- On the transition to paid, stamp paid_at and a sequential receipt number (FR-7.2).
create or replace function public.transactions_validate()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  x record;
begin
  if tg_op = 'INSERT' then
    select l.price_amount, l.currency, l.provider_id, r.taker_id, r.status as request_status, r.listing_id
      into x
    from public.requests r join public.listings l on l.id = r.listing_id
    where r.id = new.request_id;

    if x.listing_id is distinct from new.listing_id then
      raise exception 'Request does not belong to this listing' using errcode = '23514';
    end if;
    if x.request_status <> 'accepted' then
      raise exception 'Payment is only possible on an accepted request' using errcode = '23514';
    end if;
    if new.payer_id <> x.taker_id or new.payee_id <> x.provider_id then
      raise exception 'Payer must be the taker and payee the provider' using errcode = '23514';
    end if;
    if new.amount <> x.price_amount or new.currency <> x.currency then
      raise exception 'Amount must equal the listing price' using errcode = '23514';
    end if;
  else
    if (new.listing_id, new.request_id, new.payer_id, new.payee_id, new.amount, new.currency)
       is distinct from (old.listing_id, old.request_id, old.payer_id, old.payee_id, old.amount, old.currency) then
      raise exception 'Transaction details are immutable' using errcode = '42501';
    end if;
  end if;

  if new.status = 'paid' and (tg_op = 'INSERT' or old.status is distinct from 'paid') then
    new.paid_at := coalesce(new.paid_at, now());
    new.receipt_number := 'WL-' || to_char(new.paid_at at time zone 'Asia/Dhaka', 'YYYY') || '-'
                          || lpad(nextval('public.receipt_number_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

create trigger transactions_validate before insert or update on public.transactions
  for each row execute function public.transactions_validate();

-- A for_sale listing cannot be collected until it is paid for.
create or replace function public.listings_collected_requires_payment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'collected' and new.offer_type = 'for_sale'
     and not exists (select 1 from public.transactions t where t.listing_id = new.id and t.status = 'paid') then
    raise exception 'A for-sale listing cannot be marked collected until payment is received'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger listings_collected_requires_payment before insert or update of status on public.listings
  for each row execute function public.listings_collected_requires_payment();

-- ---------------------------------------------------------------------------
-- reviews (FR-8.x): one per party per completed exchange.
-- ---------------------------------------------------------------------------
create table public.reviews (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.requests (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  reviewee_id uuid not null references public.profiles (id) on delete cascade,
  rating      smallint not null check (rating between 1 and 5),
  comment     text check (char_length(comment) <= 1000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (request_id, reviewer_id),
  check (reviewer_id <> reviewee_id)
);

create index reviews_reviewee_idx on public.reviews (reviewee_id, created_at desc);

create trigger reviews_set_updated_at before update on public.reviews
  for each row execute function public.set_updated_at();

create or replace function public.reviews_validate()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  x record;
begin
  select r.taker_id, l.provider_id, p.status as pickup_status into x
  from public.requests r
  join public.listings l on l.id = r.listing_id
  left join public.pickups p on p.request_id = r.id
  where r.id = new.request_id;

  if x.pickup_status is distinct from 'completed' then
    raise exception 'Reviews open once the handover is complete' using errcode = '23514';
  end if;
  if not ((new.reviewer_id = x.taker_id and new.reviewee_id = x.provider_id)
       or (new.reviewer_id = x.provider_id and new.reviewee_id = x.taker_id)) then
    raise exception 'Reviews are between the two parties of the exchange' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger reviews_validate before insert or update on public.reviews
  for each row execute function public.reviews_validate();
