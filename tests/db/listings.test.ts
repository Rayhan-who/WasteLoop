/** Milestone 4: creating listings under RLS, photos, and the FR-7.4 price fallback. */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { anon, as, createTestDb, errorOf, superuser, user, type TestDb } from "./harness";
import { U } from "./fixtures";

let db: TestDb;
before(async () => {
  db = await createTestDb();
});
after(async () => {
  await db.close();
});

const NEW_LISTING = `insert into public.listings
  (provider_id, title, waste_type, quantity_value, quantity_unit, offer_type, price_amount,
   available_from, available_until, pickup_point, pickup_address_exact, pickup_area_label, status)
  values ($1, 'Fresh test listing', 'organic_compostable', 12, 'kg', 'free', null,
   now(), now() + interval '1 day', 'SRID=4326;POINT(90.3740 23.7553)', 'House 1, Road 1, Dhanmondi', 'Dhanmondi', $2)
  returning id`;

describe("creating listings (FR-3.1)", () => {
  it("a provider can publish a listing, and it appears publicly with a snapped point", async () => {
    const result = await as(db, user(U.shapla), async (tx) => {
      const { rows } = await tx.query<{ id: string }>(NEW_LISTING, [U.shapla, "available"]);
      const pub = await tx.query<{ approx_lat: number }>("select approx_lat from public.listings_public where id = $1", [rows[0].id]);
      return { public: pub.rows.length, lat: pub.rows[0]?.approx_lat };
    });
    assert.equal(result.public, 1);
    assert.notEqual(result.lat, 23.7553);
  });

  it("a draft is visible to its owner but not in the marketplace", async () => {
    const result = await as(db, user(U.shapla), async (tx) => {
      const { rows } = await tx.query<{ id: string }>(NEW_LISTING, [U.shapla, "draft"]);
      const own = await tx.query("select 1 from public.listings where id = $1", [rows[0].id]);
      const pub = await tx.query("select 1 from public.listings_public where id = $1", [rows[0].id]);
      return { own: own.rows.length, pub: pub.rows.length };
    });
    assert.deepEqual(result, { own: 1, pub: 0 });
  });

  it("a provider cannot create a listing for someone else", async () => {
    const msg = await as(db, user(U.shapla), (tx) => errorOf(tx.query(NEW_LISTING, [U.nirob, "available"])));
    assert.match(msg, /row-level security/);
  });

  it("a new listing cannot start reserved, collected or removed", async () => {
    const msg = await as(db, user(U.shapla), (tx) => errorOf(tx.query(NEW_LISTING, [U.shapla, "reserved"])));
    assert.match(msg, /draft or available/);
  });
});

describe("listing photos", () => {
  it("the owner can attach photos; another user cannot", async () => {
    const lunch = "10000000-0000-4000-a000-000000000001"; // seeded, owned by Shapla
    const ok = await as(db, user(U.shapla), async (tx) => {
      await tx.query("insert into public.listing_photos (listing_id, storage_path, sort_order) values ($1, $2, 0)", [lunch, `${U.shapla}/a.webp`]);
      return (await tx.query("select 1 from public.listing_photos where listing_id = $1", [lunch])).rows.length;
    });
    assert.equal(ok, 1);
    const msg = await as(db, user(U.nirob), (tx) =>
      errorOf(tx.query("insert into public.listing_photos (listing_id, storage_path, sort_order) values ($1, $2, 0)", [lunch, `${U.nirob}/b.webp`])),
    );
    assert.match(msg, /row-level security/);
  });

  it("photos of public listings are readable by anyone signed in", async () => {
    const n = await as(db, superuser, async (tx) => {
      await tx.query("insert into public.listing_photos (listing_id, storage_path, sort_order) values ($1, $2, 0)", [
        "10000000-0000-4000-a000-000000000001",
        `${U.shapla}/c.webp`,
      ]);
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: U.sobuj, role: "authenticated" })]);
      await tx.exec("set local role authenticated;");
      return (await tx.query("select 1 from public.listing_photos where storage_path = $1", [`${U.shapla}/c.webp`])).rows.length;
    });
    assert.equal(n, 1);
  });
});

describe("price_reference (FR-7.4 fallback)", () => {
  /** Create `n` paid sales of plastic in bags, priced 100, 200, … per bag (1 bag each). */
  async function seedSales(tx: Parameters<Parameters<typeof as>[2]>[0], n: number) {
    for (let i = 1; i <= n; i++) {
      const { rows } = await tx.query<{ id: string }>(
        `insert into public.listings (provider_id, title, waste_type, quantity_value, quantity_unit, offer_type, price_amount,
           available_from, available_until, pickup_point, pickup_address_exact, pickup_area_label, status)
         values ($1, 'Sale ' || $2, 'plastic_recyclable', 1, 'bag', 'for_sale', $3, now() - interval '2 days', now() + interval '2 days',
           'SRID=4326;POINT(90.37 23.80)', 'Somewhere 1', 'Mirpur', 'available') returning id`,
        [U.nirob, i, i * 100],
      );
      const req = await tx.query<{ id: string }>("insert into public.requests (listing_id, taker_id) values ($1, $2) returning id", [rows[0].id, U.purnota]);
      await tx.query("update public.requests set status = 'accepted' where id = $1", [req.rows[0].id]);
      await tx.query(
        "insert into public.transactions (listing_id, request_id, payer_id, payee_id, amount, status) values ($1, $2, $3, $4, $5, 'paid')",
        [rows[0].id, req.rows[0].id, U.purnota, U.nirob, i * 100],
      );
    }
  }

  const reference = async (tx: Parameters<Parameters<typeof as>[2]>[0]) => {
    await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: U.shapla, role: "authenticated" })]);
    await tx.exec("set local role authenticated;");
    return (
      await tx.query<{ median_per_unit: string | null; samples: number }>("select * from public.price_reference('plastic_recyclable', 'bag')")
    ).rows[0];
  };

  it("shows nothing with fewer than 5 sales", async () => {
    const row = await as(db, superuser, async (tx) => {
      await seedSales(tx, 3);
      return reference(tx);
    });
    // The seed already has one paid HDPE sale (8 bags for 600 = 75/bag), so 4 samples in total.
    assert.equal(row.median_per_unit, null);
    assert.equal(row.samples, 4);
  });

  it("returns the median per unit once there are 5 or more sales", async () => {
    const row = await as(db, superuser, async (tx) => {
      await seedSales(tx, 5);
      return reference(tx);
    });
    // Samples: 75 (seed), 100, 200, 300, 400, 500 → median 250.
    assert.equal(row.samples, 6);
    assert.equal(Number(row.median_per_unit), 250);
  });

  it("is not available to anonymous callers", async () => {
    const msg = await as(db, anon, (tx) => errorOf(tx.query("select * from public.price_reference('plastic_recyclable', 'bag')")));
    assert.match(msg, /permission denied/);
  });
});
