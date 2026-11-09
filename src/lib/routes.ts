/**
 * Route access rules, shared by the proxy (src/proxy.ts) and layouts.
 *
 * Login-first (product decision, README → Decisions): every page requires a
 * signed-in user EXCEPT the few listed here. Deny-by-default means a page
 * added later is protected automatically.
 */

/** The only pages reachable without signing in. */
export const PUBLIC_PATH_PATTERNS: readonly RegExp[] = [
  /^\/login$/,
  /^\/register$/,
  /^\/forgot-password$/,
  /^\/reset-password$/, // needs the session created by the recovery link; shows "link expired" without one
  /^\/auth\//, // e-mail confirmation / recovery callback
];

/** Paths for administrators: the (admin) route group. The role itself is re-checked server-side with is_admin(). */
export const ADMIN_PATH_PATTERN = /^\/admin(\/|$)/;

/** Auth pages a signed-in user is sent away from. */
export const AUTH_PATHS: readonly string[] = ["/login", "/register", "/forgot-password"];

export const LOGIN_PATH = "/login";
export const AFTER_LOGIN_PATH = "/dashboard";

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PATTERNS.some((re) => re.test(pathname));
}

export function isAdminPath(pathname: string): boolean {
  return ADMIN_PATH_PATTERN.test(pathname);
}

/** Everything that is not explicitly public needs a signed-in user. */
export function isProtectedPath(pathname: string): boolean {
  return !isPublicPath(pathname);
}

/** Only allow same-origin relative redirects (prevents open redirects via ?next=). */
export function safeNextPath(next: string | null | undefined, fallback: string = AFTER_LOGIN_PATH): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
