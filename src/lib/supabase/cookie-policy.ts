/**
 * "Remember me" (login page). When the user does not tick it, Supabase's auth
 * cookies are written as session cookies — no Max-Age / Expires — so the
 * browser drops them when it closes. The choice itself is remembered in a
 * small long-lived cookie that the proxy and server client both read.
 */
export const REMEMBER_COOKIE = "wl_remember";
export const REMEMBER_COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

type CookieOptions = { maxAge?: number; expires?: Date; [key: string]: unknown };

/** Whether auth cookies should be session-only for this request. */
export function isSessionOnly(rememberCookieValue: string | undefined): boolean {
  return rememberCookieValue === "0";
}

/**
 * Apply the remember-me policy to an auth cookie about to be written.
 * Deletions (empty value / Max-Age 0) are passed through untouched.
 */
export function withSessionPolicy<T extends CookieOptions>(value: string, options: T, sessionOnly: boolean): T {
  if (!sessionOnly || value === "" || options.maxAge === 0) return options;
  const rest = { ...options };
  delete rest.maxAge;
  delete rest.expires;
  return rest;
}
