import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";
import { REMEMBER_COOKIE, isSessionOnly, withSessionPolicy } from "./cookie-policy";
import type { Database } from "./database.types";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Acts as the signed-in user (anon key + session cookie), so RLS applies.
 * Create one per request; never share across requests.
 *
 * `sessionOnly` overrides the remember-me cookie (used by the login action,
 * which decides it before that cookie exists on the request).
 */
export async function createClient(options: { sessionOnly?: boolean } = {}) {
  const cookieStore = await cookies();
  const sessionOnly = options.sessionOnly ?? isSessionOnly(cookieStore.get(REMEMBER_COOKIE)?.value);

  return createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options: cookieOptions } of cookiesToSet) {
            cookieStore.set(name, value, withSessionPolicy(value, cookieOptions, sessionOnly));
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Safe to ignore: the proxy (src/proxy.ts) refreshes the session.
        }
      },
    },
  });
}

/** The verified current user (validated against Supabase Auth), or null. */
export async function getCurrentUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}
