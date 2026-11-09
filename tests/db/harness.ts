/**
 * Database test harness.
 *
 * Runs the real migrations (supabase/migrations/*.sql) and seed
 * (supabase/seed.sql) inside PGlite, which is Postgres compiled to
 * WebAssembly, on top of a small shim of the Supabase-provided schemas
 * (tests/db/supabase-shim.sql). Queries can then be executed as an anonymous
 * visitor, as any signed-in user, or as the service role, exactly as
 * PostgREST would run them, with RLS in force.
 */
import { readdir, readFile } from "node:fs/promises";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { postgis } from "@electric-sql/pglite-postgis";

const ROOT = new URL("../../", import.meta.url);
const MIGRATIONS_DIR = new URL("supabase/migrations/", ROOT);
const SEED_FILE = new URL("supabase/seed.sql", ROOT);
const SHIM_FILE = new URL("tests/db/supabase-shim.sql", ROOT);

const SEARCH_PATH = "set search_path to public, extensions;";

export type TestDb = PGlite;

/** Migration files in apply order (numeric prefix). */
export async function migrationFiles(): Promise<string[]> {
  const names = (await readdir(MIGRATIONS_DIR)).filter((n) => n.endsWith(".sql"));
  return names.sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
}

export async function createTestDb(options: { seed?: boolean } = {}): Promise<TestDb> {
  const db = await PGlite.create({ extensions: { postgis, pgcrypto } });
  await db.exec(SEARCH_PATH);
  await db.exec(await readFile(SHIM_FILE, "utf8"));

  for (const name of await migrationFiles()) {
    try {
      await db.exec(SEARCH_PATH + (await readFile(new URL(name, MIGRATIONS_DIR), "utf8")));
    } catch (error) {
      throw new Error(`Migration ${name} failed: ${(error as Error).message}`, { cause: error });
    }
  }

  if (options.seed ?? true) {
    try {
      await db.exec(SEARCH_PATH + (await readFile(SEED_FILE, "utf8")));
    } catch (error) {
      throw new Error(`seed.sql failed: ${(error as Error).message}`, { cause: error });
    }
  }
  await db.exec(SEARCH_PATH);
  return db;
}

export type Actor =
  | { role: "anon" }
  | { role: "authenticated"; userId: string }
  | { role: "service_role" }
  /** The migration/table owner: no end-user JWT, RLS bypassed. For checking constraints that must hold even for trusted code. */
  | { role: "superuser" };

export const anon: Actor = { role: "anon" };
export const serviceRole: Actor = { role: "service_role" };
export const superuser: Actor = { role: "superuser" };
export const user = (userId: string): Actor => ({ role: "authenticated", userId });

/**
 * Run `fn` inside a transaction as `actor`, the way PostgREST does: SET LOCAL
 * ROLE plus request.jwt.claims. The transaction is always rolled back, so
 * tests never leak writes into each other.
 */
export async function as<T>(db: TestDb, actor: Actor, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  let result: T | undefined;
  let failure: unknown;
  await db
    .transaction(async (tx) => {
      if (actor.role !== "superuser") {
        const claims =
          actor.role === "authenticated" ? { sub: actor.userId, role: "authenticated" } : { role: actor.role };
        await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
        await tx.exec(`set local role ${actor.role};`);
      }
      try {
        result = await fn(tx);
      } catch (error) {
        failure = error;
      }
      await tx.rollback();
    })
    .catch((error: unknown) => {
      // PGlite rejects the transaction promise after an explicit rollback; ignore that.
      if (!/rollback/i.test(String(error))) failure ??= error;
    });
  if (failure !== undefined) throw failure;
  return result as T;
}

/** Postgres error message from a rejected query, for assertions. */
export async function errorOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error("Expected the query to fail, but it succeeded");
}
