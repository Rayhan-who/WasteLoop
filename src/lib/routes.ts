/**
 * Route access rules, shared by the proxy (src/proxy.ts) and layouts.
 * Route groups — (public), (app), (admin) — do not appear in URLs, so the
 * guard matches URL prefixes.
 */

/** Paths that require a signed-in user: the (app) route group. */
export const APP_PATH_PATTERNS: readonly RegExp[] = [
  /^\/dashboard(\/|$)/,
  /^\/listings\/new(\/|$)/,
  /^\/listings\/[^/]+\/edit(\/|$)/,
  /^\/my-listings(\/|$)/,
  /^\/requests(\/|$)/,
  /^\/interests(\/|$)/,
  /^\/impact(\/|$)/,
  /^\/notifications(\/|$)/,
  /^\/settings(\/|$)/,
];

/** Paths for administrators: the (admin) route group. The role itself is re-checked server-side with is_admin(). */
export const ADMIN_PATH_PATTERN = /^\/admin(\/|$)/;

/** Auth pages a signed-in user is sent away from. */
export const AUTH_PATHS: readonly string[] = ["/login", "/register", "/forgot-password"];

export const LOGIN_PATH = "/login";
export const AFTER_LOGIN_PATH = "/dashboard";

export function isAppPath(pathname: string): boolean {
  return APP_PATH_PATTERNS.some((re) => re.test(pathname));
}

export function isAdminPath(pathname: string): boolean {
  return ADMIN_PATH_PATTERN.test(pathname);
}

export function isProtectedPath(pathname: string): boolean {
  return isAppPath(pathname) || isAdminPath(pathname);
}

/** Only allow same-origin relative redirects (prevents open redirects via ?next=). */
export function safeNextPath(next: string | null | undefined, fallback: string = AFTER_LOGIN_PATH): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
