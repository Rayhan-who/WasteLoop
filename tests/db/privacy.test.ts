/**
 * SRS §4.4 privacy, enforced in the database (Build Prompt §3, §10):
 *  - exact pickup addresses are revealed only after a request is accepted,
 *    and only to the owner, the accepted taker and admins;
 *  - requests and messages are visible only to the parties.
 *
 * Every query below runs as PostgREST would run it for that caller, with RLS on.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Transaction } from "@electric-sql/pglite";
import { anon, as, createTestDb, errorOf, user, type TestDb } from "./harness";
import { L, R, U } from "./fixtures";

type Detail = {
  viewer_relation: string;
  pickup_address_exact: string | null;
  exact_lat: number | null;
  approx_lat: number;
  approx_lng: number;
};

let db: TestDb;
before(async () => {
  db = await createTestDb();
});
after(async () => {
  await db.close();
});

const detail = (tx: Transaction, id: string) =>
  tx.query<Detail>("select * from public.get_listing_detail($1)", [id]);

describe("pickup_address_exact — unauthenticated client", () => {
  it("cannot select the listings table at all", async () => {
    const msg = await as(db, anon, (tx) => errorOf(tx.query("select pickup_address_exact from public.listings")));
    assert.match(msg, /permission denied/);
  });

  it("listings_public does not expose the address column", async () => {
    const cols = await db.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'listings_public'",
    );
    const names = cols.rows.map((c) => c.column_name);
    assert.ok(names.includes("pickup_point"));
    assert.ok(!names.includes("pickup_address_exact"));
    const msg = await as(db, anon, (tx) => errorOf(tx.query("select pickup_address_exact from public.listings_public")));
    assert.match(msg, /column .*pickup_address_exact.* does not exist/);
  });

  it("get_listing_detail returns the public fields with the address withheld", async () => {
    const { rows } = await as(db, anon, (tx) => detail(tx, L.lunchBuffet));
    assert.equal(rows.length, 1);
    assert.equal(rows[0].viewer_relation, "public");
    assert.equal(rows[0].pickup_address_exact, null);
    assert.equal(rows[0].exact_lat, null);
  });

  it("get_listing_detail does not reveal non-public listings", async () => {
    const { rows } = await as(db, anon, (tx) => detail(tx, L.dairyDraft));
    assert.equal(rows.length, 0);
  });
});

describe("pickup_address_exact — signed-in user with no accepted request", () => {
  it("sees no row in the listings table", async () => {
    const { rows } = await as(db, user(U.sobuj), (tx) =>
      tx.query("select pickup_address_exact from public.listings where id = $1", [L.petBottles]),
    );
    assert.equal(rows.length, 0);
  });

  it("gets a null address from get_listing_detail", async () => {
    const { rows } = await as(db, user(U.sobuj), (tx) => detail(tx, L.petBottles));
    assert.equal(rows[0].viewer_relation, "public");
    assert.equal(rows[0].pickup_address_exact, null);
  });

  it("a PENDING request is not enough", async () => {
    const result = await as(db, user(U.annadan), async (tx) => ({
      table: (await tx.query("select 1 from public.listings where id = $1", [L.lunchBuffet])).rows.length,
      detail: (await detail(tx, L.lunchBuffet)).rows[0],
    }));
    assert.equal(result.table, 0);
    assert.equal(result.detail.pickup_address_exact, null);
  });
});

describe("pickup_address_exact — authorised viewers", () => {
  for (const [who, id, relation] of [
    ["the owner", U.shapla, "owner"],
    ["the accepted taker", U.purnota, "accepted_taker"],
    ["an admin", U.admin, "admin"],
  ] as const) {
    it(`${who} sees it`, async () => {
      const { rows } = await as(db, user(id), (tx) => detail(tx, L.petBottles));
      assert.equal(rows[0].viewer_relation, relation);
      assert.match(rows[0].pickup_address_exact ?? "", /Road 9\/A/);
      assert.notEqual(rows[0].exact_lat, null);
    });
  }

  it("the accepted taker can also read the base row", async () => {
    const { rows } = await as(db, user(U.purnota), (tx) =>
      tx.query<{ pickup_address_exact: string }>("select pickup_address_exact from public.listings where id = $1", [
        L.petBottles,
      ]),
    );
    assert.equal(rows.length, 1);
  });
});

describe("public location is coarse", () => {
  it("listings_public snaps the point to the ~500 m grid", async () => {
    const { rows } = await db.query<{ snapped_m: number; on_grid: boolean }>(
      `select st_distance(lp.pickup_point, l.pickup_point) as snapped_m,
              abs(lp.approx_lat / 0.0045 - round(lp.approx_lat / 0.0045)) < 1e-6
          and abs(lp.approx_lng / 0.0045 - round(lp.approx_lng / 0.0045)) < 1e-6 as on_grid
       from public.listings_public lp join public.listings l using (id)`,
    );
    assert.ok(rows.length > 0);
    for (const r of rows) {
      assert.equal(r.on_grid, true);
      assert.ok(r.snapped_m < 400, `snapped ${r.snapped_m} m away`);
    }
    assert.ok(rows.some((r) => r.snapped_m > 1), "at least one point actually moved");
  });

  it("profiles_public exposes no phone or e-mail", async () => {
    const cols = await db.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'profiles_public'",
    );
    const names = cols.rows.map((c) => c.column_name);
    assert.ok(!names.includes("phone") && !names.includes("email"));
  });

  it("a user cannot read another user's full profile", async () => {
    const { rows } = await as(db, user(U.sobuj), (tx) =>
      tx.query("select phone from public.profiles where id = $1", [U.shapla]),
    );
    assert.equal(rows.length, 0);
  });
});

describe("requests and messages", () => {
  it("an unauthenticated client cannot read requests or messages", async () => {
    assert.match(await as(db, anon, (tx) => errorOf(tx.query("select * from public.requests"))), /permission denied/);
    assert.match(await as(db, anon, (tx) => errorOf(tx.query("select * from public.messages"))), /permission denied/);
  });

  it("a wrong user sees neither the request nor its messages", async () => {
    const counts = await as(db, user(U.sobuj), async (tx) => ({
      requests: (await tx.query("select 1 from public.requests where id = $1", [R.petAccepted])).rows.length,
      messages: (await tx.query("select 1 from public.messages where request_id = $1", [R.petAccepted])).rows.length,
    }));
    assert.deepEqual(counts, { requests: 0, messages: 0 });
  });

  it("another provider cannot see requests on someone else's listing", async () => {
    const { rows } = await as(db, user(U.nirob), (tx) =>
      tx.query("select 1 from public.requests where listing_id = $1", [L.petBottles]),
    );
    assert.equal(rows.length, 0);
  });

  for (const [who, id] of [
    ["provider", U.shapla],
    ["taker", U.purnota],
  ] as const) {
    it(`the ${who} sees the request and all three messages`, async () => {
      const counts = await as(db, user(id), async (tx) => ({
        requests: (await tx.query("select 1 from public.requests where id = $1", [R.petAccepted])).rows.length,
        messages: (await tx.query("select 1 from public.messages where request_id = $1", [R.petAccepted])).rows.length,
      }));
      assert.deepEqual(counts, { requests: 1, messages: 3 });
    });
  }

  it("admins can see the request but not the private conversation", async () => {
    const counts = await as(db, user(U.admin), async (tx) => ({
      requests: (await tx.query("select 1 from public.requests where id = $1", [R.petAccepted])).rows.length,
      messages: (await tx.query("select 1 from public.messages where request_id = $1", [R.petAccepted])).rows.length,
    }));
    assert.deepEqual(counts, { requests: 1, messages: 0 });
  });

  it("messaging is closed until the request is accepted (FR-5.3)", async () => {
    const msg = await as(db, user(U.annadan), (tx) =>
      errorOf(
        tx.query("insert into public.messages (request_id, sender_id, body) values ($1, $2, 'hello')", [
          R.lunchPending,
          U.annadan,
        ]),
      ),
    );
    assert.match(msg, /row-level security/);
  });

  it("an outsider cannot post into someone else's conversation", async () => {
    const msg = await as(db, user(U.sobuj), (tx) =>
      errorOf(
        tx.query("insert into public.messages (request_id, sender_id, body) values ($1, $2, 'hi')", [
          R.petAccepted,
          U.sobuj,
        ]),
      ),
    );
    assert.match(msg, /row-level security/);
  });
});
