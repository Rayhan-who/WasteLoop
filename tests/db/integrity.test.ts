/**
 * Database invariants that must hold whatever the application code does:
 * RLS coverage, privilege escalation, FR-7.3, FR-6.1, FR-11.3 and storage.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { as, createTestDb, errorOf, superuser, user, type TestDb } from "./harness";
import { L, R, U } from "./fixtures";

let db: TestDb;
before(async () => {
  db = await createTestDb();
});
after(async () => {
  await db.close();
});

describe("RLS coverage", () => {
  it("every table in public has row level security enabled", async () => {
    const { rows } = await db.query<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
    );
    assert.deepEqual(rows, []);
  });

  it("every table in public has at least one policy", async () => {
    const { rows } = await db.query<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r'
         and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname)`,
    );
    assert.deepEqual(rows, []);
  });
});

describe("privilege escalation", () => {
  it("a user cannot grant themselves the admin role", async () => {
    const msg = await as(db, user(U.sobuj), (tx) =>
      errorOf(tx.query("insert into public.user_roles (user_id, role) values ($1, 'admin')", [U.sobuj])),
    );
    assert.match(msg, /row-level security/);
  });

  it("'admin' in sign-up metadata is ignored", async () => {
    const roles = await as(db, superuser, async (tx) => {
      const id = "00000000-0000-4000-a000-00000000ffff";
      await tx.query(
        `insert into auth.users (id, email, raw_user_meta_data)
         values ($1, 'sneaky@example.org', '{"display_name":"Sneaky","roles":["admin","farmer"]}')`,
        [id],
      );
      return (await tx.query<{ role: string }>("select role from public.user_roles where user_id = $1", [id])).rows;
    });
    assert.deepEqual(roles, [{ role: "farmer" }]);
  });

  it("a user cannot change their own suspension flag", async () => {
    const msg = await as(db, user(U.sobuj), (tx) =>
      errorOf(tx.query("update public.profiles set is_suspended = not is_suspended where id = $1", [U.sobuj])),
    );
    assert.match(msg, /administrator/);
  });

  it("an organisation cannot approve itself", async () => {
    const msg = await as(db, user(U.purnota), (tx) =>
      errorOf(tx.query("update public.organisations set verification_status = 'approved' where owner_id = $1", [U.purnota])),
    );
    assert.match(msg, /administrator/);
  });

  it("a provider cannot remove their own listing or clear a moderation flag", async () => {
    const removed = await as(db, user(U.shapla), (tx) =>
      errorOf(tx.query("update public.listings set status = 'removed' where id = $1", [L.lunchBuffet])),
    );
    assert.match(removed, /moderator/);

    const flagged = await as(db, user(U.shapla), async (tx) => {
      await tx.query("update public.listings set flagged_for_review = true, view_count = 999 where id = $1", [
        L.lunchBuffet,
      ]);
      return (await tx.query<{ flagged_for_review: boolean; view_count: number }>(
        "select flagged_for_review, view_count from public.listings where id = $1",
        [L.lunchBuffet],
      )).rows[0];
    });
    assert.deepEqual(flagged, { flagged_for_review: false, view_count: 0 });
  });

  it("a taker-only account cannot post listings", async () => {
    const msg = await as(db, user(U.sobuj), (tx) =>
      errorOf(
        tx.query(
          `insert into public.listings (provider_id, title, waste_type, quantity_value, quantity_unit, offer_type,
             available_until, pickup_point, pickup_address_exact, pickup_area_label)
           values ($1, 'Test listing', 'edible_food', 1, 'kg', 'free', now() + interval '1 day',
             'SRID=4326;POINT(90.4 23.8)', 'Somewhere 1', 'Savar')`,
          [U.sobuj],
        ),
      ),
    );
    assert.match(msg, /row-level security/);
  });

  it("users cannot write payments directly", async () => {
    const msg = await as(db, user(U.purnota), (tx) =>
      errorOf(
        tx.query(
          `insert into public.transactions (listing_id, request_id, payer_id, payee_id, amount, status)
           values ($1, $2, $3, $4, 300, 'paid')`,
          [L.petBottles, R.petAccepted, U.purnota, U.shapla],
        ),
      ),
    );
    assert.match(msg, /permission denied/);
  });
});

describe("FR-7.3: free and donation listings never produce a charge", () => {
  it("a transaction cannot reference a free listing (composite foreign key)", async () => {
    const msg = await as(db, superuser, (tx) =>
      errorOf(
        tx.query(
          `insert into public.transactions (listing_id, request_id, payer_id, payee_id, amount)
           values ($1, $2, $3, $4, 100)`,
          [L.iftarSurplus, R.iftarDone, U.annadan, U.shapla],
        ),
      ),
    );
    assert.match(msg, /transactions_listing_offer_fk|foreign key/);
  });

  it("a transaction cannot claim a non-sale offer type (check constraint)", async () => {
    const msg = await as(db, superuser, (tx) =>
      errorOf(
        tx.query(
          `insert into public.transactions (listing_id, offer_type, request_id, payer_id, payee_id, amount)
           values ($1, 'free', $2, $3, $4, 100)`,
          [L.iftarSurplus, R.iftarDone, U.annadan, U.shapla],
        ),
      ),
    );
    assert.match(msg, /transactions_only_for_sale/);
  });

  it("a free listing cannot carry a price", async () => {
    const msg = await as(db, superuser, (tx) =>
      errorOf(tx.query("update public.listings set price_amount = 50 where id = $1", [L.lunchBuffet])),
    );
    assert.match(msg, /listings_price_only_for_sale/);
  });

  it("a listing with a payment cannot be switched to free", async () => {
    const msg = await as(db, superuser, (tx) =>
      errorOf(tx.query("update public.listings set offer_type = 'free', price_amount = null where id = $1", [L.hdpeSold])),
    );
    assert.match(msg, /foreign key|violates/);
  });

  it("a for-sale listing cannot be collected before payment", async () => {
    const msg = await as(db, superuser, (tx) =>
      errorOf(tx.query("update public.listings set status = 'collected', collected_at = now() where id = $1", [L.petBottles])),
    );
    assert.match(msg, /payment/);
  });

  it("the amount must equal the listing price", async () => {
    const msg = await as(db, superuser, (tx) =>
      errorOf(
        tx.query(
          `insert into public.transactions (listing_id, request_id, payer_id, payee_id, amount)
           values ($1, $2, $3, $4, 1)`,
          [L.petBottles, R.petAccepted, U.purnota, U.shapla],
        ),
      ),
    );
    assert.match(msg, /listing price/);
  });

  it("paid transactions get sequential receipt numbers (FR-7.2)", async () => {
    const receipt = await as(db, superuser, async (tx) => {
      await tx.query(
        `insert into public.transactions (listing_id, request_id, payer_id, payee_id, amount, status)
         values ($1, $2, $3, $4, 300, 'paid')`,
        [L.petBottles, R.petAccepted, U.purnota, U.shapla],
      );
      return (await tx.query<{ receipt_number: string }>(
        "select receipt_number from public.transactions where request_id = $1",
        [R.petAccepted],
      )).rows[0].receipt_number;
    });
    assert.match(receipt, /^WL-\d{4}-000002$/);
  });
});

describe("exchange invariants", () => {
  it("a pickup must fall inside the availability window (FR-6.1)", async () => {
    const msg = await as(db, superuser, (tx) =>
      errorOf(
        tx.query("update public.pickups set scheduled_at = now() + interval '30 days' where request_id = $1", [
          R.petAccepted,
        ]),
      ),
    );
    assert.match(msg, /availability window/);
  });

  it("a provider cannot request their own listing", async () => {
    const msg = await as(db, superuser, (tx) =>
      errorOf(tx.query("insert into public.requests (listing_id, taker_id) values ($1, $2)", [L.lunchBuffet, U.shapla])),
    );
    assert.match(msg, /own listing/);
  });

  it("reviews open only after the handover is complete", async () => {
    const msg = await as(db, user(U.purnota), (tx) =>
      errorOf(
        tx.query("insert into public.reviews (request_id, reviewer_id, reviewee_id, rating) values ($1, $2, $3, 5)", [
          R.petAccepted,
          U.purnota,
          U.shapla,
        ]),
      ),
    );
    assert.match(msg, /handover is complete/);
  });

  it("only one request per listing can be accepted", async () => {
    const msg = await as(db, superuser, async (tx) => {
      await tx.query("update public.listings set status = 'available' where id = $1", [L.petBottles]);
      await tx.query(
        "insert into public.requests (id, listing_id, taker_id) values ('20000000-0000-4000-a000-0000000000ff', $1, $2)",
        [L.petBottles, U.sobuj],
      );
      return errorOf(
        tx.query("update public.requests set status = 'accepted' where id = '20000000-0000-4000-a000-0000000000ff'"),
      );
    });
    assert.match(msg, /requests_one_accepted_per_listing/);
  });
});

describe("FR-11.3: admin audit log", () => {
  it("admins can append entries as themselves", async () => {
    const n = await as(db, user(U.admin), async (tx) => {
      await tx.query(
        "insert into public.admin_audit_log (actor_id, action, target_type) values ($1, 'user.suspend', 'user')",
        [U.admin],
      );
      return (await tx.query("select 1 from public.admin_audit_log")).rows.length;
    });
    assert.ok(n >= 4);
  });

  it("non-admins can neither write nor read it", async () => {
    const msg = await as(db, user(U.shapla), (tx) =>
      errorOf(
        tx.query("insert into public.admin_audit_log (actor_id, action, target_type) values ($1, 'x.y.z', 'user')", [
          U.shapla,
        ]),
      ),
    );
    assert.match(msg, /row-level security/);
    const { rows } = await as(db, user(U.shapla), (tx) => tx.query("select 1 from public.admin_audit_log"));
    assert.equal(rows.length, 0);
  });

  it("is append-only even for the table owner", async () => {
    const upd = await as(db, superuser, (tx) => errorOf(tx.query("update public.admin_audit_log set action = 'tampered'")));
    assert.match(upd, /append-only/);
    const del = await as(db, superuser, (tx) => errorOf(tx.query("delete from public.admin_audit_log")));
    assert.match(del, /append-only/);
    const trunc = await as(db, superuser, (tx) => errorOf(tx.query("truncate public.admin_audit_log")));
    assert.match(trunc, /append-only/);
  });
});

describe("storage", () => {
  it("users can upload only into their own folder", async () => {
    const own = await as(db, user(U.purnota), async (tx) => {
      await tx.query("insert into storage.objects (bucket_id, name) values ('verification-docs', $1)", [
        `${U.purnota}/licence.pdf`,
      ]);
      return true;
    });
    assert.equal(own, true);

    const msg = await as(db, user(U.purnota), (tx) =>
      errorOf(
        tx.query("insert into storage.objects (bucket_id, name) values ('verification-docs', $1)", [
          `${U.shapla}/forged.pdf`,
        ]),
      ),
    );
    assert.match(msg, /row-level security/);
  });

  it("verification documents are private to the owner and admins", async () => {
    const counts = await as(db, superuser, async (tx) => {
      await tx.query("insert into storage.objects (bucket_id, name) values ('verification-docs', $1)", [
        `${U.purnota}/licence.pdf`,
      ]);
      const read = async (uid: string) => {
        await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, role: "authenticated" })]);
        await tx.exec("set local role authenticated;");
        const n = (await tx.query("select 1 from storage.objects where bucket_id = 'verification-docs'")).rows.length;
        await tx.exec("reset role;");
        return n;
      };
      return { owner: await read(U.purnota), stranger: await read(U.sobuj), admin: await read(U.admin) };
    });
    assert.deepEqual(counts, { owner: 1, stranger: 0, admin: 1 });
  });
});
