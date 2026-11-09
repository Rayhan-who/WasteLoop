"use client";

import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";
import type { Database } from "./database.types";

type BrowserClient = ReturnType<typeof createBrowserClient<Database>>;
let browserClient: BrowserClient | undefined;

/**
 * Browser Supabase client (anon key + the user's session cookie).
 * Used for Realtime subscriptions and direct Storage uploads. All data
 * access is constrained by RLS; mutations go through Server Actions.
 */
export function createClient(): BrowserClient {
  browserClient ??= createBrowserClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
  return browserClient;
}
