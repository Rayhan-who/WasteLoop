-- 002 · Enums
-- Mirrored 1:1 in src/lib/domain.ts. Keep the order identical.

create type public.user_role as enum ('provider', 'farmer', 'energy_plant', 'recycler', 'charity', 'admin');
create type public.waste_type as enum ('edible_food', 'organic_compostable', 'plastic_recyclable', 'energy_feedstock');
create type public.listing_offer_type as enum ('free', 'donation', 'for_sale');
create type public.listing_status as enum ('draft', 'available', 'reserved', 'collected', 'expired', 'paused', 'removed');
create type public.request_status as enum ('pending', 'accepted', 'declined', 'cancelled', 'withdrawn');
create type public.pickup_status as enum ('proposed', 'confirmed', 'rescheduled', 'completed', 'cancelled');
create type public.verification_status as enum ('unsubmitted', 'pending', 'approved', 'rejected', 'more_info');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');
create type public.notification_channel as enum ('in_app', 'email', 'sms');

-- Supporting enums not named in the brief but implied by the column specs.
create type public.quantity_unit as enum ('kg', 'litre', 'item', 'bag');
create type public.report_target as enum ('listing', 'user');
create type public.report_status as enum ('open', 'actioned', 'dismissed');
create type public.impact_side as enum ('provider', 'taker');
