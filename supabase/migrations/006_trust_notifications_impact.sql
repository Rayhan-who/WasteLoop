-- 006 · Reports, notifications, impact, admin audit log (FR-8.x, FR-9.x, FR-10.x, FR-11.x)
set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- reports: abuse flags on listings or users. This is also the Phase 1
-- fallback for content screening (FR-11.5): manual user reports only.
-- ---------------------------------------------------------------------------
create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type public.report_target not null,
  target_id   uuid not null,
  reason      text not null check (reason in ('spam', 'unsafe_food', 'misleading', 'harassment', 'prohibited_item', 'other')),
  detail      text check (char_length(detail) <= 1000),
  status      public.report_status not null default 'open',
  handled_by  uuid references public.profiles (id) on delete set null,
  handled_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint reports_handled_fields check ((status = 'open') = (handled_at is null))
);

create index reports_status_idx on public.reports (status, created_at);
create index reports_target_idx on public.reports (target_type, target_id);
-- A reporter can have only one open report per target.
create unique index reports_one_open_per_target
  on public.reports (reporter_id, target_type, target_id) where status = 'open';

create trigger reports_set_updated_at before update on public.reports
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- notifications: in-app rows (Supabase Realtime drives the unread badge).
-- title/body are rendered in the recipient's locale at creation time; type
-- and params keep the raw event for re-rendering.
-- ---------------------------------------------------------------------------
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       text not null check (char_length(type) <= 60),
  title      text not null check (char_length(title) <= 200),
  body       text not null default '' check (char_length(body) <= 1000),
  params     jsonb not null default '{}'::jsonb,
  link_url   text check (link_url is null or link_url like '/%'),   -- same-origin paths only
  read_at    timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notifications_user_read_idx on public.notifications (user_id, read_at);
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);

create trigger notifications_set_updated_at before update on public.notifications
  for each row execute function public.set_updated_at();

create table public.notification_preferences (
  user_id           uuid not null references public.profiles (id) on delete cascade,
  notification_type text not null check (char_length(notification_type) <= 60),
  channels          public.notification_channel[] not null default '{in_app}',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  primary key (user_id, notification_type)
);

create trigger notification_preferences_set_updated_at before update on public.notification_preferences
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- impact_records: written when a pickup completes, one row per side (FR-10.x).
-- quantity_kg is normalised with the conversion table documented in the README.
-- ---------------------------------------------------------------------------
create table public.impact_records (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role_side   public.impact_side not null,
  listing_id  uuid not null references public.listings (id) on delete cascade,
  waste_type  public.waste_type not null,
  quantity_kg numeric(12, 2) not null check (quantity_kg >= 0),
  diverted_at timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (listing_id, user_id, role_side)
);

create index impact_records_user_idx on public.impact_records (user_id, diverted_at desc);
create index impact_records_type_idx on public.impact_records (waste_type, diverted_at);

create trigger impact_records_set_updated_at before update on public.impact_records
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- admin_audit_log (FR-11.3): append-only, enforced by trigger for every role,
-- including the service role and the table owner.
-- ---------------------------------------------------------------------------
create table public.admin_audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null check (char_length(action) between 3 and 80),
  target_type text not null check (char_length(target_type) <= 40),
  target_id   uuid,
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index admin_audit_log_created_idx on public.admin_audit_log (created_at desc);
create index admin_audit_log_target_idx on public.admin_audit_log (target_type, target_id);

create or replace function public.admin_audit_log_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- ON DELETE SET NULL of actor_id (profile erasure) is the one permitted update.
  if tg_op = 'UPDATE'
     and new.actor_id is null and old.actor_id is not null
     and (new.action, new.target_type, new.target_id, new.detail, new.created_at)
         is not distinct from (old.action, old.target_type, old.target_id, old.detail, old.created_at) then
    return new;
  end if;
  raise exception 'admin_audit_log is append-only' using errcode = '42501';
end;
$$;

create trigger admin_audit_log_no_update before update on public.admin_audit_log
  for each row execute function public.admin_audit_log_append_only();
create trigger admin_audit_log_no_delete before delete on public.admin_audit_log
  for each row execute function public.admin_audit_log_append_only();
create trigger admin_audit_log_no_truncate before truncate on public.admin_audit_log
  for each statement execute function public.admin_audit_log_append_only();
