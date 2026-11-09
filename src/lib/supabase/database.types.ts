/**
 * Supabase database types.
 *
 * Milestone 1 placeholder: the schema is written in milestone 2
 * (supabase/migrations). Regenerate this file after applying migrations:
 *
 *   npx supabase gen types typescript --project-id <ref> > src/lib/supabase/database.types.ts
 *   # or, against a local stack:
 *   npx supabase gen types typescript --local > src/lib/supabase/database.types.ts
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: Record<never, never>;
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
