/** Migration 010 and the account lifecycle (FR-1.x). */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { as, createTestDb, errorOf, superuser, user, type TestDb } from "./harness";
import { U } from "./fixtures";

let db: TestDb;
before(async () => {
  db = await createTestDb();
});
after(async () => {
  await db.close();
});

const NEW_USER = "00000000-0000-4000-a000-00000000aaaa";

describe("sign-up trigger (handle_new_user)", () => {
  it("creates the profile with name, phone, locale and chosen roles", async () => {
    const result = await as(db, superuser, async (tx) => {
      await tx.query(
        `insert into auth.users (id, email, raw_user_meta_data) values ($1, 'new@example.org',
         '{"display_name":"Nadia","org_name":"Nadia Foods","phone":"+8801711000999","roles":["provider","charity"],"locale":"en"}')`,
        [NEW_USER],
      );
      const profile = (
        await tx.query<{ display_name: string; org_name: string; phone: string; locale: string; email: string }>(
          "select display_name, org_name, phone, locale, email from public.profiles where id = $1",
          [NEW_USER],
        )
      ).rows[0];
      const roles = (await tx.query<{ role: string }>("select role from public.user_roles where user_id = $1 order by role", [NEW_USER])).rows;
      return { profile, roles: roles.map((r) => r.role) };
    });
    assert.deepEqual(result.profile, {
      display_name: "Nadia",
      org_name: "Nadia Foods",
      phone: "+8801711000999",
      locale: "en",
      email: "new@example.org",
    });
    assert.deepEqual(result.roles, ["provider", "charity"]);
  });

  it("defaults to Bangla and derives a name from the e-mail", async () => {
    const profile = await as(db, superuser, async (tx) => {
      await tx.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, 'rahim@example.org', '{}')", [NEW_USER]);
      return (await tx.query<{ display_name: string; locale: string }>("select display_name, locale from public.profiles where id = $1", [NEW_USER])).rows[0];
    });
    assert.deepEqual(profile, { display_name: "rahim", locale: "bn" });
  });
});

describe("e-mail sync", () => {
  it("copies a confirmed e-mail change from auth.users to the profile", async () => {
    const email = await as(db, superuser, async (tx) => {
      await tx.query("update auth.users set email = 'farhana.new@example.org' where id = $1", [U.shapla]);
      return (await tx.query<{ email: string }>("select email from public.profiles where id = $1", [U.shapla])).rows[0].email;
    });
    assert.equal(email, "farhana.new@example.org");
  });

  it("users cannot change profiles.email directly", async () => {
    const msg = await as(db, user(U.shapla), (tx) =>
      errorOf(tx.query("update public.profiles set email = 'spoof@example.org' where id = $1", [U.shapla])),
    );
    assert.match(msg, /managed by authentication/);
  });
});

describe("deactivation and reactivation", () => {
  it("a user can deactivate and reactivate their own profile", async () => {
    const states = await as(db, user(U.sobuj), async (tx) => {
      await tx.query("update public.profiles set deactivated_at = now() where id = $1", [U.sobuj]);
      const off = (await tx.query<{ d: boolean }>("select deactivated_at is not null as d from public.profiles where id = $1", [U.sobuj])).rows[0].d;
      await tx.query("update public.profiles set deactivated_at = null where id = $1", [U.sobuj]);
      const on = (await tx.query<{ d: boolean }>("select deactivated_at is not null as d from public.profiles where id = $1", [U.sobuj])).rows[0].d;
      return { off, on };
    });
    assert.deepEqual(states, { off: true, on: false });
  });

  it("a deactivated provider disappears from public views and cannot post", async () => {
    const result = await as(db, superuser, async (tx) => {
      await tx.query("update public.profiles set deactivated_at = now() where id = $1", [U.utsob]);
      const listings = (await tx.query("select 1 from public.listings_public where provider_id = $1", [U.utsob])).rows.length;
      const profiles = (await tx.query("select 1 from public.profiles_public where id = $1", [U.utsob])).rows.length;
      return { listings, profiles };
    });
    assert.deepEqual(result, { listings: 0, profiles: 0 });
  });
});

describe("data removal requests", () => {
  it("a user can file one open request for themselves", async () => {
    const n = await as(db, user(U.sobuj), async (tx) => {
      await tx.query("insert into public.data_removal_requests (user_id, reason) values ($1, 'Closing the farm')", [U.sobuj]);
      return (await tx.query("select 1 from public.data_removal_requests")).rows.length;
    });
    assert.equal(n, 1);
  });

  it("a second open request is rejected", async () => {
    const msg = await as(db, user(U.sobuj), async (tx) => {
      await tx.query("insert into public.data_removal_requests (user_id) values ($1)", [U.sobuj]);
      return errorOf(tx.query("insert into public.data_removal_requests (user_id) values ($1)", [U.sobuj]));
    });
    assert.match(msg, /data_removal_requests_one_open/);
  });

  it("a user cannot file a request for someone else", async () => {
    const other = await as(db, user(U.sobuj), (tx) =>
      errorOf(tx.query("insert into public.data_removal_requests (user_id) values ($1)", [U.shapla])),
    );
    assert.match(other, /row-level security/);
  });

  it("other users cannot see it; admins can", async () => {
    const counts = await as(db, superuser, async (tx) => {
      await tx.query("insert into public.data_removal_requests (user_id) values ($1)", [U.sobuj]);
      const count = async (uid: string) => {
        await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, role: "authenticated" })]);
        await tx.exec("set local role authenticated;");
        const n = (await tx.query("select 1 from public.data_removal_requests")).rows.length;
        await tx.exec("reset role;");
        return n;
      };
      return { owner: await count(U.sobuj), stranger: await count(U.shapla), admin: await count(U.admin) };
    });
    assert.deepEqual(counts, { owner: 1, stranger: 0, admin: 1 });
  });

  it("survives erasure of the user as an anonymised record", async () => {
    const row = await as(db, superuser, async (tx) => {
      await tx.query("insert into public.data_removal_requests (user_id, email_snapshot) values ($1, 'sobuj@wasteloop.test')", [U.sobuj]);
      // Erasing the auth user cascades to the profile; the request row keeps the record.
      await tx.query("delete from public.reviews where reviewer_id = $1 or reviewee_id = $1", [U.sobuj]);
      await tx.query("delete from public.impact_records where user_id = $1", [U.sobuj]);
      await tx.query("delete from auth.users where id = $1", [U.sobuj]);
      return (await tx.query<{ user_id: string | null; email_snapshot: string }>("select user_id, email_snapshot from public.data_removal_requests")).rows[0];
    });
    assert.deepEqual(row, { user_id: null, email_snapshot: "sobuj@wasteloop.test" });
  });
});
