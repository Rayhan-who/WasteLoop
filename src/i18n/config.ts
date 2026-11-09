/**
 * Locale configuration (SRS §4.7). Bangla is the default for new users.
 * The active locale lives in a cookie so it works before sign-in; once a user
 * is signed in it is also persisted to profiles.locale and restored on login.
 */
export const LOCALES = ["bn", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "bn";
export const LOCALE_COOKIE = "NEXT_LOCALE";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function resolveLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** BCP-47 tags for Intl formatting. bn-BD uses Bengali digits. */
export const INTL_LOCALE: Record<Locale, string> = {
  bn: "bn-BD",
  en: "en-GB",
};
