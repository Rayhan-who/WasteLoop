import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";
import { AFTER_LOGIN_PATH, AUTH_PATHS, LOGIN_PATH, isProtectedPath } from "@/lib/routes";
import type { Database } from "./database.types";

/**
 * Runs from src/proxy.ts on every page request:
 *  1. refreshes the Supabase session and writes rotated cookies to the response;
 *  2. redirects anonymous users away from (app) and (admin) paths;
 *  3. redirects signed-in users away from login/register.
 *
 * The admin *role* is not checked here (that needs a DB round-trip); the
 * (admin) layout calls is_admin() server-side before rendering anything.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  // Keep getUser() directly after createServerClient: it revalidates the
  // token with Supabase Auth and triggers the cookie refresh above.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  const redirectTo = (path: string, params?: Record<string, string>): NextResponse => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, v);
    const redirect = NextResponse.redirect(url);
    // Carry any refreshed auth cookies across the redirect.
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  };

  if (!user && isProtectedPath(pathname)) {
    return redirectTo(LOGIN_PATH, { next: `${pathname}${search}` });
  }

  if (user && AUTH_PATHS.includes(pathname)) {
    return redirectTo(AFTER_LOGIN_PATH);
  }

  return response;
}
