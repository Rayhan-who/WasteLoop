"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, isLocale } from "@/i18n/config";

/**
 * Language switcher (SRS §4.7). Sets the locale cookie for this browser.
 * Milestone 3 extends this to persist the choice to profiles.locale for
 * signed-in users.
 */
export async function setLocale(locale: string): Promise<void> {
  if (!isLocale(locale)) throw new Error("Unsupported locale");

  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
  });

  revalidatePath("/", "layout");
}
