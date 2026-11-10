-- 011 · Listing helpers (FR-3.x, FR-7.4 fallback)
set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- price_reference: the rule-based fallback for FR-7.4 (fair price suggestion,
-- deferred ML). Median price per unit for the same waste stream and unit,
-- from paid transactions in the last 180 days. Returns a NULL median when
-- there are fewer than 5 samples, so the UI shows nothing rather than a
-- misleading figure. Aggregate only: no individual transaction is exposed,
-- which is why it may run as SECURITY DEFINER over the RLS-protected tables.
-- ---------------------------------------------------------------------------
create or replace function public.price_reference(p_waste_type public.waste_type, p_unit public.quantity_unit)
returns table (median_per_unit numeric, samples integer)
language sql
stable
security definer
set search_path = ''
as $$
  with paid as (
    select t.amount / nullif(l.quantity_value, 0) as per_unit
    from public.transactions t
    join public.listings l on l.id = t.listing_id
    where t.status = 'paid'
      and t.paid_at > now() - interval '180 days'
      and l.waste_type = p_waste_type
      and l.quantity_unit = p_unit
  )
  select
    case when count(*) >= 5
         then round((percentile_cont(0.5) within group (order by per_unit))::numeric, 2)
    end,
    count(*)::integer
  from paid
  where per_unit is not null;
$$;

revoke execute on function public.price_reference(public.waste_type, public.quantity_unit) from public, anon;
grant execute on function public.price_reference(public.waste_type, public.quantity_unit) to authenticated;
