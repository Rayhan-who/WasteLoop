/**
 * Generates src/lib/supabase/database.types.ts from the migrations.
 *
 *   npm run db:types
 *
 * Applies supabase/migrations to an in-memory PGlite database (see
 * tests/db/harness.ts), introspects the public schema, and writes types in
 * the same shape as `supabase gen types typescript`, so supabase-js queries
 * are fully typed without a running Supabase project. Once a project exists,
 * `npx supabase gen types typescript --project-id <ref>` produces an
 * equivalent file.
 */
import { writeFile } from "node:fs/promises";
import { createTestDb } from "../tests/db/harness";

const OUT = new URL("../src/lib/supabase/database.types.ts", import.meta.url);

type Col = {
  rel: string;
  kind: "r" | "v";
  name: string;
  nullable: boolean;
  has_default: boolean;
  typname: string;
  typtype: string;
  elem_typname: string | null;
  elem_typtype: string | null;
};

type Fk = { conname: string; tbl: string; cols: string[]; ref: string; refcols: string[]; one_to_one: boolean };

type Fn = {
  name: string;
  arg_names: string[] | null;
  arg_types: string[];
  arg_typtypes: string[];
  n_defaults: number;
  returns_set: boolean;
  ret_typname: string;
  ret_typtype: string;
  out_names: string[] | null;
  out_types: string[] | null;
  out_typtypes: string[] | null;
};

const STRING = new Set(["uuid", "text", "varchar", "bpchar", "char", "name", "citext", "date", "time", "timetz", "timestamp", "timestamptz", "interval", "inet"]);
const NUMBER = new Set(["int2", "int4", "int8", "float4", "float8", "numeric", "oid"]);

function scalar(typname: string, typtype: string): string {
  if (typtype === "e") return `Database["public"]["Enums"]["${typname}"]`;
  if (STRING.has(typname)) return "string";
  if (NUMBER.has(typname)) return "number";
  if (typname === "bool") return "boolean";
  if (typname === "json" || typname === "jsonb") return "Json";
  if (typname === "void") return "undefined";
  return "unknown"; // geography, geometry and other extension types
}

function tsType(typname: string, typtype: string, elemName: string | null, elemType: string | null): string {
  if (elemName && elemType) return `${scalar(elemName, elemType)}[]`;
  // pg array type names start with "_" (e.g. "_text") when typelem lookup is unavailable
  if (typname.startsWith("_")) return `${scalar(typname.slice(1), typtype)}[]`;
  return scalar(typname, typtype);
}

const ind = (n: number) => "  ".repeat(n);

async function main() {
  const db = await createTestDb({ seed: false });

  const cols = (
    await db.query<Col>(`
      select c.relname as rel, c.relkind as kind, a.attname as name,
             not a.attnotnull as nullable,
             (a.atthasdef or a.attidentity <> '' or a.attgenerated <> '') as has_default,
             t.typname, t.typtype::text as typtype,
             et.typname as elem_typname, et.typtype::text as elem_typtype
      from pg_attribute a
      join pg_class c on c.oid = a.attrelid
      join pg_namespace n on n.oid = c.relnamespace
      join pg_type t on t.oid = a.atttypid
      left join pg_type et on et.oid = t.typelem and t.typcategory = 'A'
      where n.nspname = 'public' and c.relkind in ('r', 'v') and a.attnum > 0 and not a.attisdropped
      order by c.relname, a.attnum`)
  ).rows;

  const enums = (
    await db.query<{ name: string; labels: string[] }>(`
      select t.typname as name, array_agg(e.enumlabel order by e.enumsortorder) as labels
      from pg_type t join pg_enum e on e.enumtypid = t.oid join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public' group by t.typname order by t.typname`)
  ).rows;

  const fks = (
    await db.query<Fk>(`
      select con.conname, cl.relname as tbl,
             array(select a.attname from unnest(con.conkey) with ordinality k(n, o)
                   join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.n order by k.o) as cols,
             rcl.relname as ref,
             array(select a.attname from unnest(con.confkey) with ordinality k(n, o)
                   join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.n order by k.o) as refcols,
             exists (select 1 from pg_index i where i.indrelid = con.conrelid and i.indisunique
                     and i.indpred is null and (select array_agg(x order by x) from unnest(i.indkey::int2[]) x)
                         = (select array_agg(x order by x) from unnest(con.conkey) x)) as one_to_one
      from pg_constraint con
      join pg_class cl on cl.oid = con.conrelid
      join pg_namespace n on n.oid = cl.relnamespace
      join pg_class rcl on rcl.oid = con.confrelid
      join pg_namespace rn on rn.oid = rcl.relnamespace
      where con.contype = 'f' and n.nspname = 'public' and rn.nspname = 'public'
      order by cl.relname, con.conname`)
  ).rows;

  const fns = (
    await db.query<Fn>(`
      select p.proname as name,
             p.proargnames as arg_names,
             array(select t.typname from unnest(p.proargtypes) with ordinality a(oid, o) join pg_type t on t.oid = a.oid order by a.o) as arg_types,
             array(select t.typtype::text from unnest(p.proargtypes) with ordinality a(oid, o) join pg_type t on t.oid = a.oid order by a.o) as arg_typtypes,
             p.pronargdefaults as n_defaults,
             p.proretset as returns_set,
             rt.typname as ret_typname, rt.typtype::text as ret_typtype,
             case when p.proallargtypes is null then null else
               array(select p.proargnames[o] from unnest(p.proargmodes) with ordinality m(mode, o) where m.mode in ('o', 't') order by o) end as out_names,
             case when p.proallargtypes is null then null else
               array(select t.typname from unnest(p.proallargtypes) with ordinality a(oid, o)
                     join pg_type t on t.oid = a.oid where p.proargmodes[o] in ('o', 't') order by o) end as out_types,
             case when p.proallargtypes is null then null else
               array(select t.typtype::text from unnest(p.proallargtypes) with ordinality a(oid, o)
                     join pg_type t on t.oid = a.oid where p.proargmodes[o] in ('o', 't') order by o) end as out_typtypes
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      join pg_type rt on rt.oid = p.prorettype
      where n.nspname = 'public'
        and rt.typname <> 'trigger'
        and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
      order by p.proname`)
  ).rows;

  await db.close();

  const byRel = new Map<string, Col[]>();
  for (const c of cols) byRel.set(c.rel, [...(byRel.get(c.rel) ?? []), c]);

  const relationships = (rel: string, level: number): string => {
    const own = fks.filter((f) => f.tbl === rel);
    if (own.length === 0) return `${ind(level)}Relationships: []`;
    const items = own.map(
      (f) =>
        `${ind(level + 1)}{\n` +
        `${ind(level + 2)}foreignKeyName: "${f.conname}"\n` +
        `${ind(level + 2)}columns: [${f.cols.map((c) => `"${c}"`).join(", ")}]\n` +
        `${ind(level + 2)}isOneToOne: ${f.one_to_one}\n` +
        `${ind(level + 2)}referencedRelation: "${f.ref}"\n` +
        `${ind(level + 2)}referencedColumns: [${f.refcols.map((c) => `"${c}"`).join(", ")}]\n` +
        `${ind(level + 1)}},`,
    );
    return `${ind(level)}Relationships: [\n${items.join("\n")}\n${ind(level)}]`;
  };

  const colType = (c: Col) => tsType(c.typname, c.typtype, c.elem_typname, c.elem_typtype);

  const tableBlock = (rel: string, list: Col[]): string => {
    const row = list.map((c) => `${ind(5)}${c.name}: ${colType(c)}${c.nullable ? " | null" : ""}`).join("\n");
    const insert = list
      .map((c) => `${ind(5)}${c.name}${c.nullable || c.has_default ? "?" : ""}: ${colType(c)}${c.nullable ? " | null" : ""}`)
      .join("\n");
    const update = list.map((c) => `${ind(5)}${c.name}?: ${colType(c)}${c.nullable ? " | null" : ""}`).join("\n");
    return (
      `${ind(3)}${rel}: {\n` +
      `${ind(4)}Row: {\n${row}\n${ind(4)}}\n` +
      `${ind(4)}Insert: {\n${insert}\n${ind(4)}}\n` +
      `${ind(4)}Update: {\n${update}\n${ind(4)}}\n` +
      `${relationships(rel, 4)}\n` +
      `${ind(3)}}`
    );
  };

  const viewBlock = (rel: string, list: Col[]): string => {
    const row = list.map((c) => `${ind(5)}${c.name}: ${colType(c)} | null`).join("\n");
    return `${ind(3)}${rel}: {\n${ind(4)}Row: {\n${row}\n${ind(4)}}\n${ind(4)}Relationships: []\n${ind(3)}}`;
  };

  const tables = [...byRel].filter(([, l]) => l[0].kind === "r").map(([r, l]) => tableBlock(r, l));
  const views = [...byRel].filter(([, l]) => l[0].kind === "v").map(([r, l]) => viewBlock(r, l));

  const fnBlock = (f: Fn): string => {
    const nArgs = f.arg_types.length;
    const args =
      nArgs === 0
        ? "Record<PropertyKey, never>"
        : `{\n${f.arg_types
            .map((t, i) => {
              const optional = i >= nArgs - f.n_defaults ? "?" : "";
              return `${ind(5)}${f.arg_names?.[i] ?? `arg${i}`}${optional}: ${scalar(t, f.arg_typtypes[i])}`;
            })
            .join("\n")}\n${ind(4)}}`;
    let returns: string;
    if (f.out_names && f.out_names.length > 0 && f.out_types && f.out_typtypes) {
      const fields = f.out_names
        // Table-function columns may be NULL (e.g. get_listing_detail withholds the address).
        .map((n, i) => `${ind(5)}${n}: ${scalar(f.out_types![i], f.out_typtypes![i])} | null`)
        .join("\n");
      returns = `{\n${fields}\n${ind(4)}}${f.returns_set ? "[]" : ""}`;
    } else {
      returns = `${scalar(f.ret_typname, f.ret_typtype)}${f.returns_set ? "[]" : ""}`;
    }
    return `${ind(3)}${f.name}: {\n${ind(4)}Args: ${args}\n${ind(4)}Returns: ${returns}\n${ind(3)}}`;
  };

  const enumBlock = enums.map((e) => `${ind(3)}${e.name}: ${e.labels.map((l) => `"${l}"`).join(" | ")}`).join("\n");

  const out = `/**
 * Supabase database types. GENERATED by scripts/gen-db-types.ts from
 * supabase/migrations. Do not edit by hand: run \`npm run db:types\`.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
${tables.join("\n")}
    }
    Views: {
${views.join("\n")}
    }
    Functions: {
${fns.map(fnBlock).join("\n")}
    }
    Enums: {
${enumBlock}
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
export type Views<T extends keyof PublicSchema["Views"]> = PublicSchema["Views"][T]["Row"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
`;

  await writeFile(OUT, out, "utf8");
  console.log(`Wrote ${fileURLToPathSafe(OUT)} (${tables.length} tables, ${views.length} views, ${fns.length} functions, ${enums.length} enums)`);
}

function fileURLToPathSafe(url: URL): string {
  return decodeURIComponent(url.pathname);
}

await main();
