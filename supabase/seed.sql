-- =============================================================================
-- WasteLoop demo seed. Applied by `supabase db reset` after the migrations.
--
-- All demo accounts share the password:  WasteLoop#2026
--
--   admin@wasteloop.test     Administrator
--   shapla@wasteloop.test    Provider  · Shapla Restaurant, Dhanmondi
--   nirob@wasteloop.test     Provider  · Nirob Super Shop, Mirpur
--   utsob@wasteloop.test     Provider  · Utsob Caterers, Gulshan
--   sobuj@wasteloop.test     Farmer    · Sobuj Krishi Khamar, Savar
--   biopower@wasteloop.test  Energy    · Dhaka BioPower Ltd, Keraniganj
--   purnota@wasteloop.test   Recycler  · Purnota Recyclers, Kamrangirchar
--   annadan@wasteloop.test   Charity   · Annadan Foundation, Mohammadpur
--
-- All organisations are fictional. Times are relative to now() so the demo
-- stays live whenever the seed is applied.
-- =============================================================================
set search_path = public, extensions;

-- -----------------------------------------------------------------------------
-- Auth users (+ email identities). handle_new_user() creates each profile and
-- the self-service roles listed in raw_user_meta_data.
-- -----------------------------------------------------------------------------
with demo (id, email, display_name, org_name, roles, locale) as (
  values
    ('00000000-0000-4000-a000-000000000001'::uuid, 'admin@wasteloop.test',    'WasteLoop Admin',  null,                   '[]',              'en'),
    ('00000000-0000-4000-a000-000000000101'::uuid, 'shapla@wasteloop.test',   'Farhana Akter',    'Shapla Restaurant',    '["provider"]',    'bn'),
    ('00000000-0000-4000-a000-000000000102'::uuid, 'nirob@wasteloop.test',    'Mahmud Hasan',     'Nirob Super Shop',     '["provider"]',    'bn'),
    ('00000000-0000-4000-a000-000000000103'::uuid, 'utsob@wasteloop.test',    'Tanvir Rahman',    'Utsob Caterers',       '["provider"]',    'en'),
    ('00000000-0000-4000-a000-000000000201'::uuid, 'sobuj@wasteloop.test',    'Abdul Karim',      'Sobuj Krishi Khamar',  '["farmer"]',      'bn'),
    ('00000000-0000-4000-a000-000000000202'::uuid, 'biopower@wasteloop.test', 'Nusrat Jahan',     'Dhaka BioPower Ltd',   '["energy_plant"]','en'),
    ('00000000-0000-4000-a000-000000000203'::uuid, 'purnota@wasteloop.test',  'Rafiq Uddin',      'Purnota Recyclers',    '["recycler"]',    'bn'),
    ('00000000-0000-4000-a000-000000000204'::uuid, 'annadan@wasteloop.test',  'Sadia Islam',      'Annadan Foundation',   '["charity","provider"]', 'bn')
)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  created_at, updated_at
)
select
  '00000000-0000-0000-0000-000000000000', d.id, 'authenticated', 'authenticated', d.email,
  extensions.crypt('WasteLoop#2026', extensions.gen_salt('bf')), now() - interval '60 days',
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('display_name', d.display_name, 'org_name', d.org_name, 'roles', d.roles::jsonb, 'locale', d.locale),
  '', '', '', '',
  now() - interval '60 days', now() - interval '60 days'
from demo d;

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id::text, u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), u.created_at, u.created_at
from auth.users u
where u.email like '%@wasteloop.test';

-- Admin is granted here, never through sign-up metadata.
insert into public.user_roles (user_id, role) values ('00000000-0000-4000-a000-000000000001', 'admin');

-- -----------------------------------------------------------------------------
-- Profile details. approx_point is snapped to the ~500 m grid by trigger.
-- -----------------------------------------------------------------------------
update public.profiles p set
  general_location = v.loc,
  approx_point     = ('SRID=4326;POINT(' || v.lng || ' ' || v.lat || ')')::geography,
  phone            = v.phone,
  bio              = v.bio
from (values
  ('00000000-0000-4000-a000-000000000001'::uuid, 'Dhaka',                 90.4125, 23.8103, null,             'Platform moderation team.'),
  ('00000000-0000-4000-a000-000000000101'::uuid, 'Dhanmondi, Dhaka',      90.3740, 23.7553, '+8801711000101', 'Family restaurant serving Bangladeshi lunch and dinner since 2009.'),
  ('00000000-0000-4000-a000-000000000102'::uuid, 'Mirpur, Dhaka',         90.3687, 23.8069, '+8801711000102', 'Neighbourhood super shop with two branches in Mirpur.'),
  ('00000000-0000-4000-a000-000000000103'::uuid, 'Gulshan, Dhaka',        90.4168, 23.7808, '+8801711000103', 'Event and corporate catering across Dhaka.'),
  ('00000000-0000-4000-a000-000000000201'::uuid, 'Savar, Dhaka',          90.2667, 23.8583, '+8801711000201', 'Vegetable farm and compost yard. We collect organic waste for compost and cattle feed.'),
  ('00000000-0000-4000-a000-000000000202'::uuid, 'Keraniganj, Dhaka',     90.3450, 23.6980, '+8801711000202', 'Anaerobic digestion plant turning organic waste and used oil into biogas.'),
  ('00000000-0000-4000-a000-000000000203'::uuid, 'Kamrangirchar, Dhaka',  90.3700, 23.7130, '+8801711000203', 'Buyers of sorted plastics: PET, HDPE and film.'),
  ('00000000-0000-4000-a000-000000000204'::uuid, 'Mohammadpur, Dhaka',    90.3589, 23.7662, '+8801711000204', 'Community kitchen feeding 300 people a day from donated food.')
) as v (id, loc, lng, lat, phone, bio)
where p.id = v.id;

-- -----------------------------------------------------------------------------
-- Organisations (FR-2.x). A mix of states so the admin queue has work.
-- -----------------------------------------------------------------------------
insert into public.organisations
  (owner_id, legal_name, registration_number, document_path, verification_status, submitted_at, reviewed_by, reviewed_at, reviewer_note)
values
  ('00000000-0000-4000-a000-000000000101', 'Shapla Restaurant',       'TRAD/DNCC/2009/04411', '00000000-0000-4000-a000-000000000101/trade-licence.pdf', 'approved',  now() - interval '50 days', '00000000-0000-4000-a000-000000000001', now() - interval '49 days', null),
  ('00000000-0000-4000-a000-000000000102', 'Nirob Super Shop',        'TRAD/DNCC/2015/11872', '00000000-0000-4000-a000-000000000102/trade-licence.pdf', 'approved',  now() - interval '45 days', '00000000-0000-4000-a000-000000000001', now() - interval '44 days', null),
  ('00000000-0000-4000-a000-000000000103', 'Utsob Caterers Ltd',      'C-178245/2018',        '00000000-0000-4000-a000-000000000103/incorporation.pdf', 'approved',  now() - interval '40 days', '00000000-0000-4000-a000-000000000001', now() - interval '39 days', null),
  ('00000000-0000-4000-a000-000000000201', 'Sobuj Krishi Khamar',     'DAE/SAV/2020/0093',    '00000000-0000-4000-a000-000000000201/farm-registration.pdf', 'approved', now() - interval '30 days', '00000000-0000-4000-a000-000000000001', now() - interval '29 days', null),
  ('00000000-0000-4000-a000-000000000202', 'Dhaka BioPower Ltd',      'C-201554/2021',        '00000000-0000-4000-a000-000000000202/incorporation.pdf', 'more_info', now() - interval '6 days',  '00000000-0000-4000-a000-000000000001', now() - interval '5 days',  'Please upload your Department of Environment clearance certificate.'),
  ('00000000-0000-4000-a000-000000000203', 'Purnota Recyclers',       'TRAD/DSCC/2019/22310', '00000000-0000-4000-a000-000000000203/trade-licence.pdf', 'pending',   now() - interval '1 day',   null, null, null),
  ('00000000-0000-4000-a000-000000000204', 'Annadan Foundation',      'NGOAB/1523',           '00000000-0000-4000-a000-000000000204/ngo-registration.pdf', 'approved', now() - interval '35 days', '00000000-0000-4000-a000-000000000001', now() - interval '34 days', null);

-- -----------------------------------------------------------------------------
-- Listings. All are inserted as 'available' (or draft) so requests can be
-- created against them; final statuses are applied further down.
-- -----------------------------------------------------------------------------
insert into public.listings
  (id, provider_id, title, description, waste_type, quantity_value, quantity_unit, offer_type, price_amount,
   available_from, available_until, pickup_point, pickup_address_exact, pickup_area_label, status, created_at)
values
  -- Shapla Restaurant · Dhanmondi
  ('10000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000101',
   'Lunch buffet surplus: rice, dal and chicken curry', 'Cooked today at noon, kept in covered steel trays. Please bring your own containers.',
   'edible_food', 15, 'kg', 'free', null, now() - interval '1 hour', now() + interval '6 hours',
   'SRID=4326;POINT(90.37412 23.75538)', 'House 41, Road 27 (old), Dhanmondi, Dhaka 1209 — kitchen entrance at the back', 'Dhanmondi 27', 'available', now() - interval '1 hour'),
  ('10000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000101',
   'Vegetable peels and trimmings', 'Onion, potato and gourd peels from today''s prep. Sorted, no plastic.',
   'organic_compostable', 25, 'kg', 'free', null, now() - interval '2 hours', now() + interval '2 days',
   'SRID=4326;POINT(90.37390 23.75561)', 'House 41, Road 27 (old), Dhanmondi, Dhaka 1209 — service lane', 'Dhanmondi 27', 'available', now() - interval '2 hours'),
  ('10000000-0000-4000-a000-000000000003', '00000000-0000-4000-a000-000000000101',
   'Used cooking oil, filtered', 'Soybean oil from deep frying, filtered and stored in 5-litre jerrycans.',
   'energy_feedstock', 20, 'litre', 'for_sale', 1200, now() - interval '1 day', now() + interval '7 days',
   'SRID=4326;POINT(90.37201 23.74655)', 'Shop 3, Road 9/A, Dhanmondi, Dhaka 1209', 'Dhanmondi 9/A', 'available', now() - interval '1 day'),
  ('10000000-0000-4000-a000-000000000004', '00000000-0000-4000-a000-000000000101',
   'Bread and naan baked this morning', 'About 40 pieces of naan and bread rolls, packed in paper bags.',
   'edible_food', 40, 'item', 'donation', null, now() - interval '30 minutes', now() + interval '8 hours',
   'SRID=4326;POINT(90.37425 23.75512)', 'House 41, Road 27 (old), Dhanmondi, Dhaka 1209 — front counter', 'Dhanmondi 27', 'available', now() - interval '30 minutes'),
  ('10000000-0000-4000-a000-000000000005', '00000000-0000-4000-a000-000000000101',
   'Clean PET bottles', 'Rinsed water and soft-drink bottles, caps removed, in six sacks.',
   'plastic_recyclable', 6, 'bag', 'for_sale', 300, now() - interval '2 days', now() + interval '10 days',
   'SRID=4326;POINT(90.37230 23.74630)', 'Shop 3, Road 9/A, Dhanmondi, Dhaka 1209 — storeroom', 'Dhanmondi 9/A', 'available', now() - interval '2 days'),
  ('10000000-0000-4000-a000-000000000006', '00000000-0000-4000-a000-000000000101',
   'Iftar surplus: piyaju, beguni and khichuri', 'Leftover iftar items from a large booking.',
   'edible_food', 30, 'kg', 'free', null, now() - interval '12 days', now() - interval '11 days 18 hours',
   'SRID=4326;POINT(90.37412 23.75538)', 'House 41, Road 27 (old), Dhanmondi, Dhaka 1209 — kitchen entrance at the back', 'Dhanmondi 27', 'available', now() - interval '12 days'),

  -- Nirob Super Shop · Mirpur
  ('10000000-0000-4000-a000-000000000007', '00000000-0000-4000-a000-000000000102',
   'Near-date packaged biscuits and juice', 'Sealed packs, best-before in 5 days. Mixed brands.',
   'edible_food', 30, 'item', 'donation', null, now() - interval '3 hours', now() + interval '3 days',
   'SRID=4326;POINT(90.36871 23.80694)', 'Nirob Super Shop, Plot 12, Section 10, Mirpur, Dhaka 1216 — loading bay', 'Mirpur 10', 'available', now() - interval '3 hours'),
  ('10000000-0000-4000-a000-000000000008', '00000000-0000-4000-a000-000000000102',
   'Spoiled fruit and vegetables', 'Bruised tomatoes, bananas and leafy vegetables. Good for compost or cattle feed.',
   'organic_compostable', 60, 'kg', 'free', null, now() - interval '5 hours', now() + interval '2 days',
   'SRID=4326;POINT(90.36850 23.80720)', 'Nirob Super Shop, Plot 12, Section 10, Mirpur, Dhaka 1216 — back gate', 'Mirpur 10', 'available', now() - interval '5 hours'),
  ('10000000-0000-4000-a000-000000000009', '00000000-0000-4000-a000-000000000102',
   'Plastic crates and stretch film', 'Cracked HDPE crates and used stretch wrap from deliveries.',
   'plastic_recyclable', 12, 'bag', 'for_sale', 450, now() - interval '1 day', now() + interval '14 days',
   'SRID=4326;POINT(90.35370 23.79560)', 'Nirob Super Shop (branch), Road 2, Section 1, Mirpur, Dhaka 1216', 'Mirpur 1', 'available', now() - interval '1 day'),
  ('10000000-0000-4000-a000-000000000010', '00000000-0000-4000-a000-000000000102',
   'Wilted leafy greens', 'Spinach and red amaranth past shelf life.',
   'organic_compostable', 18, 'kg', 'free', null, now() - interval '1 day', now() + interval '3 days',
   'SRID=4326;POINT(90.35390 23.79540)', 'Nirob Super Shop (branch), Road 2, Section 1, Mirpur, Dhaka 1216', 'Mirpur 1', 'available', now() - interval '1 day'),
  ('10000000-0000-4000-a000-000000000011', '00000000-0000-4000-a000-000000000102',
   'Yoghurt and milk close to date', 'Draft: confirming quantity with the dairy supplier.',
   'edible_food', 24, 'item', 'donation', null, now(), now() + interval '2 days',
   'SRID=4326;POINT(90.36871 23.80694)', 'Nirob Super Shop, Plot 12, Section 10, Mirpur, Dhaka 1216', 'Mirpur 10', 'draft', now() - interval '20 minutes'),
  ('10000000-0000-4000-a000-000000000012', '00000000-0000-4000-a000-000000000102',
   'Sorted HDPE containers', 'Oil and detergent containers, rinsed and sorted.',
   'plastic_recyclable', 8, 'bag', 'for_sale', 600, now() - interval '9 days', now() - interval '4 days',
   'SRID=4326;POINT(90.36871 23.80694)', 'Nirob Super Shop, Plot 12, Section 10, Mirpur, Dhaka 1216 — loading bay', 'Mirpur 10', 'available', now() - interval '9 days'),
  ('10000000-0000-4000-a000-000000000013', '00000000-0000-4000-a000-000000000102',
   'Fish section offcuts for biogas', 'Heads, scales and trimmings from the fish counter.',
   'energy_feedstock', 45, 'kg', 'free', null, now() - interval '5 days', now() - interval '3 days',
   'SRID=4326;POINT(90.36860 23.80700)', 'Nirob Super Shop, Plot 12, Section 10, Mirpur, Dhaka 1216 — cold room', 'Mirpur 10', 'available', now() - interval '5 days'),

  -- Utsob Caterers · Gulshan, Banani, Bashundhara, Uttara
  ('10000000-0000-4000-a000-000000000014', '00000000-0000-4000-a000-000000000103',
   'Corporate event: 50 boxed meals', 'Polao, roast chicken and salad in sealed boxes from a cancelled seminar.',
   'edible_food', 50, 'item', 'free', null, now() - interval '1 hour', now() + interval '5 hours',
   'SRID=4326;POINT(90.40660 23.79370)', 'Banani Convention Hall, Road 11, Banani, Dhaka 1213 — service gate', 'Banani', 'available', now() - interval '1 hour'),
  ('10000000-0000-4000-a000-000000000015', '00000000-0000-4000-a000-000000000103',
   'Grease trap waste', 'Collected from our central kitchen grease traps, in sealed drums.',
   'energy_feedstock', 100, 'kg', 'free', null, now() - interval '1 day', now() + interval '5 days',
   'SRID=4326;POINT(90.41680 23.78080)', 'Utsob central kitchen, Road 35, Gulshan 1, Dhaka 1212', 'Gulshan 1', 'available', now() - interval '1 day'),
  ('10000000-0000-4000-a000-000000000016', '00000000-0000-4000-a000-000000000103',
   'Coconut shells and banana leaves', 'From a wedding reception. No plastic mixed in.',
   'organic_compostable', 35, 'kg', 'free', null, now() - interval '6 hours', now() + interval '4 days',
   'SRID=4326;POINT(90.45260 23.81930)', 'ICCB Hall 4, Bashundhara R/A, Dhaka 1229 — vendor exit', 'Bashundhara R/A', 'available', now() - interval '6 hours'),
  ('10000000-0000-4000-a000-000000000017', '00000000-0000-4000-a000-000000000103',
   'Bulk food waste for biogas', 'Mixed cooked food waste from three events, about 200 kg in bins.',
   'energy_feedstock', 200, 'kg', 'for_sale', 800, now() - interval '1 day', now() + interval '6 days',
   'SRID=4326;POINT(90.41700 23.78100)', 'Utsob central kitchen, Road 35, Gulshan 1, Dhaka 1212 — bin store', 'Gulshan 1', 'available', now() - interval '1 day'),
  ('10000000-0000-4000-a000-000000000018', '00000000-0000-4000-a000-000000000103',
   'Kacchi biryani from a cancelled event', 'Freshly cooked, kept hot in deg pots.',
   'edible_food', 25, 'kg', 'free', null, now() - interval '8 days', now() - interval '7 days 20 hours',
   'SRID=4326;POINT(90.39550 23.86870)', 'Uttara Community Centre, Sector 7, Uttara, Dhaka 1230', 'Uttara Sector 7', 'available', now() - interval '8 days'),
  ('10000000-0000-4000-a000-000000000019', '00000000-0000-4000-a000-000000000103',
   'Event flowers and food scraps', 'Marigold garlands and kitchen scraps after a holud ceremony.',
   'organic_compostable', 80, 'kg', 'free', null, now() - interval '6 days', now() - interval '4 days',
   'SRID=4326;POINT(90.45240 23.81950)', 'ICCB Hall 2, Bashundhara R/A, Dhaka 1229 — vendor exit', 'Bashundhara R/A', 'available', now() - interval '6 days'),
  ('10000000-0000-4000-a000-000000000020', '00000000-0000-4000-a000-000000000103',
   'Disposable plates and cups (clean)', 'Unused paper-plastic plates and cups left over from stock.',
   'plastic_recyclable', 10, 'bag', 'free', null, now() - interval '2 days', now() + interval '9 days',
   'SRID=4326;POINT(90.41720 23.78060)', 'Utsob central kitchen, Road 35, Gulshan 1, Dhaka 1212 — store', 'Gulshan 1', 'available', now() - interval '2 days');

-- -----------------------------------------------------------------------------
-- Requests
-- -----------------------------------------------------------------------------
insert into public.requests (id, listing_id, taker_id, message, created_at) values
  -- in progress: accepted, chatting, pickup booked for tomorrow
  ('20000000-0000-4000-a000-000000000005', '10000000-0000-4000-a000-000000000005', '00000000-0000-4000-a000-000000000203', 'We buy PET. Can collect tomorrow morning with a van.', now() - interval '1 day'),
  -- completed exchanges
  ('20000000-0000-4000-a000-000000000006', '10000000-0000-4000-a000-000000000006', '00000000-0000-4000-a000-000000000204', 'We can pick this up within the hour for our evening meal.', now() - interval '12 days'),
  ('20000000-0000-4000-a000-000000000012', '10000000-0000-4000-a000-000000000012', '00000000-0000-4000-a000-000000000203', 'Interested in all eight bags.', now() - interval '8 days'),
  ('20000000-0000-4000-a000-000000000018', '10000000-0000-4000-a000-000000000018', '00000000-0000-4000-a000-000000000204', 'Our volunteers are in Uttara and can come now.', now() - interval '8 days'),
  ('20000000-0000-4000-a000-000000000019', '10000000-0000-4000-a000-000000000019', '00000000-0000-4000-a000-000000000201', 'Perfect for our compost pits.', now() - interval '6 days'),
  -- declined
  ('20000000-0000-4000-a000-000000000118', '10000000-0000-4000-a000-000000000018', '00000000-0000-4000-a000-000000000201', 'Could use it as cattle feed.', now() - interval '8 days'),
  -- pending, awaiting the provider
  ('20000000-0000-4000-a000-000000000001', '10000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000204', 'We feed 300 people tonight. Can collect at 5 pm.', now() - interval '20 minutes'),
  ('20000000-0000-4000-a000-000000000016', '10000000-0000-4000-a000-000000000016', '00000000-0000-4000-a000-000000000201', 'Can collect on Thursday.', now() - interval '3 hours'),
  ('20000000-0000-4000-a000-000000000017', '10000000-0000-4000-a000-000000000017', '00000000-0000-4000-a000-000000000202', 'We can take the full 200 kg.', now() - interval '4 hours');

update public.requests set status = 'accepted', decided_at = created_at + interval '30 minutes'
where id in ('20000000-0000-4000-a000-000000000005', '20000000-0000-4000-a000-000000000006',
             '20000000-0000-4000-a000-000000000012', '20000000-0000-4000-a000-000000000018',
             '20000000-0000-4000-a000-000000000019');

update public.requests set status = 'declined', decided_at = created_at + interval '35 minutes'
where id = '20000000-0000-4000-a000-000000000118';

-- -----------------------------------------------------------------------------
-- Messages (only on accepted requests, FR-5.3)
-- -----------------------------------------------------------------------------
insert into public.messages (request_id, sender_id, body, read_at, created_at) values
  ('20000000-0000-4000-a000-000000000005', '00000000-0000-4000-a000-000000000101', 'Accepted. The bottles are in our Road 9/A storeroom.', now() - interval '22 hours', now() - interval '23 hours'),
  ('20000000-0000-4000-a000-000000000005', '00000000-0000-4000-a000-000000000203', 'Thanks. Is 10 am tomorrow OK?', now() - interval '21 hours', now() - interval '22 hours'),
  ('20000000-0000-4000-a000-000000000005', '00000000-0000-4000-a000-000000000101', '10 am works. Ask for the manager at the counter.', null, now() - interval '20 hours'),
  ('20000000-0000-4000-a000-000000000006', '00000000-0000-4000-a000-000000000204', 'On our way, 15 minutes.', now() - interval '11 days 22 hours', now() - interval '11 days 23 hours'),
  ('20000000-0000-4000-a000-000000000012', '00000000-0000-4000-a000-000000000203', 'Paid through the app. Coming at 3 pm.', now() - interval '6 days', now() - interval '7 days');

-- -----------------------------------------------------------------------------
-- Pickups (inside each listing's availability window, FR-6.1)
-- -----------------------------------------------------------------------------
insert into public.pickups
  (request_id, scheduled_at, status, proposed_by, provider_confirmed, taker_confirmed, completed_at, created_at) values
  ('20000000-0000-4000-a000-000000000005', date_trunc('hour', now()) + interval '1 day', 'confirmed',
   '00000000-0000-4000-a000-000000000203', false, false, null, now() - interval '22 hours'),
  ('20000000-0000-4000-a000-000000000006', now() - interval '11 days 22 hours', 'completed',
   '00000000-0000-4000-a000-000000000204', true, true, now() - interval '11 days 21 hours', now() - interval '11 days 23 hours'),
  ('20000000-0000-4000-a000-000000000012', now() - interval '6 days', 'completed',
   '00000000-0000-4000-a000-000000000203', true, true, now() - interval '6 days' + interval '40 minutes', now() - interval '7 days'),
  ('20000000-0000-4000-a000-000000000018', now() - interval '7 days 23 hours', 'completed',
   '00000000-0000-4000-a000-000000000204', true, true, now() - interval '7 days 22 hours', now() - interval '8 days'),
  ('20000000-0000-4000-a000-000000000019', now() - interval '5 days', 'completed',
   '00000000-0000-4000-a000-000000000201', true, true, now() - interval '5 days' + interval '1 hour', now() - interval '6 days');

-- -----------------------------------------------------------------------------
-- Payment for the one completed sale (receipt number assigned by trigger).
-- -----------------------------------------------------------------------------
insert into public.transactions
  (listing_id, request_id, payer_id, payee_id, amount, currency, status, provider, provider_ref, paid_at, created_at)
values
  ('10000000-0000-4000-a000-000000000012', '20000000-0000-4000-a000-000000000012',
   '00000000-0000-4000-a000-000000000203', '00000000-0000-4000-a000-000000000102',
   600, 'BDT', 'paid', 'mock', 'mock_seed_0001', now() - interval '7 days', now() - interval '7 days');

-- -----------------------------------------------------------------------------
-- Final listing statuses.
-- -----------------------------------------------------------------------------
update public.listings set status = 'reserved' where id = '10000000-0000-4000-a000-000000000005';
update public.listings set status = 'paused'   where id = '10000000-0000-4000-a000-000000000010';
update public.listings set status = 'expired'  where id = '10000000-0000-4000-a000-000000000013';

update public.listings l set status = 'collected', collected_at = p.completed_at
from public.requests r join public.pickups p on p.request_id = r.id
where r.listing_id = l.id and p.status = 'completed';

-- -----------------------------------------------------------------------------
-- Reviews, both directions, for each completed exchange (FR-8.x).
-- -----------------------------------------------------------------------------
insert into public.reviews (request_id, reviewer_id, reviewee_id, rating, comment, created_at) values
  ('20000000-0000-4000-a000-000000000006', '00000000-0000-4000-a000-000000000204', '00000000-0000-4000-a000-000000000101', 5, 'Food was well packed and still warm. Thank you!', now() - interval '11 days'),
  ('20000000-0000-4000-a000-000000000006', '00000000-0000-4000-a000-000000000101', '00000000-0000-4000-a000-000000000204', 5, 'Arrived on time and brought their own containers.', now() - interval '11 days'),
  ('20000000-0000-4000-a000-000000000012', '00000000-0000-4000-a000-000000000203', '00000000-0000-4000-a000-000000000102', 4, 'Well sorted, two bags had labels still on.', now() - interval '6 days'),
  ('20000000-0000-4000-a000-000000000012', '00000000-0000-4000-a000-000000000102', '00000000-0000-4000-a000-000000000203', 5, 'Paid promptly and collected as agreed.', now() - interval '6 days'),
  ('20000000-0000-4000-a000-000000000018', '00000000-0000-4000-a000-000000000204', '00000000-0000-4000-a000-000000000103', 5, 'Fed 120 people that night.', now() - interval '7 days'),
  ('20000000-0000-4000-a000-000000000018', '00000000-0000-4000-a000-000000000103', '00000000-0000-4000-a000-000000000204', 4, 'Quick pickup, a little late.', now() - interval '7 days'),
  ('20000000-0000-4000-a000-000000000019', '00000000-0000-4000-a000-000000000201', '00000000-0000-4000-a000-000000000103', 5, 'Clean organic waste, no plastic. Great partner.', now() - interval '4 days'),
  ('20000000-0000-4000-a000-000000000019', '00000000-0000-4000-a000-000000000103', '00000000-0000-4000-a000-000000000201', 5, 'Took everything, left the area clean.', now() - interval '4 days');

-- -----------------------------------------------------------------------------
-- Impact (FR-10.x): one row per side. Bags are counted at 5 kg each
-- (see the conversion table in the README).
-- -----------------------------------------------------------------------------
insert into public.impact_records (user_id, role_side, listing_id, waste_type, quantity_kg, diverted_at)
select x.user_id, x.side::public.impact_side, x.listing_id, l.waste_type, x.kg, p.completed_at
from (values
  ('00000000-0000-4000-a000-000000000101'::uuid, 'provider', '10000000-0000-4000-a000-000000000006'::uuid, 30::numeric),
  ('00000000-0000-4000-a000-000000000204'::uuid, 'taker',    '10000000-0000-4000-a000-000000000006'::uuid, 30),
  ('00000000-0000-4000-a000-000000000102'::uuid, 'provider', '10000000-0000-4000-a000-000000000012'::uuid, 40),
  ('00000000-0000-4000-a000-000000000203'::uuid, 'taker',    '10000000-0000-4000-a000-000000000012'::uuid, 40),
  ('00000000-0000-4000-a000-000000000103'::uuid, 'provider', '10000000-0000-4000-a000-000000000018'::uuid, 25),
  ('00000000-0000-4000-a000-000000000204'::uuid, 'taker',    '10000000-0000-4000-a000-000000000018'::uuid, 25),
  ('00000000-0000-4000-a000-000000000103'::uuid, 'provider', '10000000-0000-4000-a000-000000000019'::uuid, 80),
  ('00000000-0000-4000-a000-000000000201'::uuid, 'taker',    '10000000-0000-4000-a000-000000000019'::uuid, 80)
) as x (user_id, side, listing_id, kg)
join public.listings l on l.id = x.listing_id
join public.requests r on r.listing_id = l.id and r.status = 'accepted'
join public.pickups p on p.request_id = r.id;

-- -----------------------------------------------------------------------------
-- Saved interests (FR-4.3)
-- -----------------------------------------------------------------------------
insert into public.saved_interests (user_id, label, waste_types, max_distance_km, centre_point, offer_types) values
  ('00000000-0000-4000-a000-000000000204', 'Cooked food near the kitchen', '{edible_food}', 6,
   'SRID=4326;POINT(90.3589 23.7662)', '{free,donation}'),
  ('00000000-0000-4000-a000-000000000201', 'Compostables anywhere in Dhaka', '{organic_compostable}', 30,
   'SRID=4326;POINT(90.2667 23.8583)', '{}'),
  ('00000000-0000-4000-a000-000000000202', 'Biogas feedstock', '{energy_feedstock,organic_compostable}', 25,
   'SRID=4326;POINT(90.3450 23.6980)', '{}');

-- -----------------------------------------------------------------------------
-- Reports and the matching audit trail (FR-11.x)
-- -----------------------------------------------------------------------------
insert into public.reports (reporter_id, target_type, target_id, reason, detail, status, handled_by, handled_at, created_at) values
  ('00000000-0000-4000-a000-000000000201', 'listing', '10000000-0000-4000-a000-000000000020', 'misleading',
   'Photos show used plates, not clean ones.', 'open', null, null, now() - interval '5 hours'),
  ('00000000-0000-4000-a000-000000000203', 'listing', '10000000-0000-4000-a000-000000000009', 'other',
   'Price seems high for film wrap.', 'dismissed', '00000000-0000-4000-a000-000000000001', now() - interval '12 hours', now() - interval '1 day');

insert into public.admin_audit_log (actor_id, action, target_type, target_id, detail, created_at) values
  ('00000000-0000-4000-a000-000000000001', 'organisation.approve', 'organisation',
   (select id from public.organisations where owner_id = '00000000-0000-4000-a000-000000000101'), '{}', now() - interval '49 days'),
  ('00000000-0000-4000-a000-000000000001', 'organisation.request_more_info', 'organisation',
   (select id from public.organisations where owner_id = '00000000-0000-4000-a000-000000000202'),
   '{"note":"Please upload your Department of Environment clearance certificate."}', now() - interval '5 days'),
  ('00000000-0000-4000-a000-000000000001', 'report.dismiss', 'report',
   (select id from public.reports where status = 'dismissed' limit 1), '{"reason":"Pricing is up to the provider."}', now() - interval '12 hours');

-- -----------------------------------------------------------------------------
-- A few notifications so the badge and inbox are not empty.
-- -----------------------------------------------------------------------------
insert into public.notifications (user_id, type, title, body, link_url, read_at, created_at) values
  ('00000000-0000-4000-a000-000000000101', 'request.new', 'নতুন অনুরোধ', 'Annadan Foundation আপনার "Lunch buffet surplus" চেয়েছে।',
   '/requests/20000000-0000-4000-a000-000000000001', null, now() - interval '20 minutes'),
  ('00000000-0000-4000-a000-000000000203', 'request.accepted', 'অনুরোধ গৃহীত হয়েছে', 'Shapla Restaurant আপনার অনুরোধ গ্রহণ করেছে।',
   '/requests/20000000-0000-4000-a000-000000000005', now() - interval '22 hours', now() - interval '23 hours'),
  ('00000000-0000-4000-a000-000000000203', 'message.new', 'নতুন বার্তা', 'Shapla Restaurant: 10 am works. Ask for the manager at the counter.',
   '/requests/20000000-0000-4000-a000-000000000005', null, now() - interval '20 hours'),
  ('00000000-0000-4000-a000-000000000103', 'request.new', 'New request', 'Dhaka BioPower Ltd asked for "Bulk food waste for biogas".',
   '/requests/20000000-0000-4000-a000-000000000017', null, now() - interval '4 hours');
