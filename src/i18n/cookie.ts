import "server-only";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, type Locale } from "./config";

/** Persist the UI language for this browser. Callable from Server Actions and Route Handlers. */
export async function setLocaleCookie(locale: Locale): Promise<void> {
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, { path: "/", maxAge: LOCALE_COOKIE_MAX_AGE, sameSite: "lax" });
}

export async function getLocaleCookie(): Promise<string | undefined> {
  return (await cookies()).get(LOCALE_COOKIE)?.value;
}
