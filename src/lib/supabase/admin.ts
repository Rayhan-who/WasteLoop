import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import type { Database } from "./database.types";

/**
 * SERVICE ROLE client — bypasses Row Level Security.
 *
 * Allowed callers (Build Prompt §1): admin-only server paths, after
 * `is_admin()` has been checked, and cron Route Handlers after the
 * CRON_SECRET check. The "server-only" import makes any client-side import
 * a build error. Never pass this client, or unfiltered data it reads, to
 * the browser.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(publicEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
