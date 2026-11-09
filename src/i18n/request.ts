import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { LOCALE_COOKIE, resolveLocale } from "./config";

/**
 * next-intl without locale-prefixed URLs: the locale comes from a cookie,
 * defaulting to Bangla. Message keys are type-checked (src/global.d.ts) and
 * key parity between en.json and bn.json is enforced by tests/i18n.test.ts.
 */
export default getRequestConfig(async () => {
  const store = await cookies();
  const locale = resolveLocale(store.get(LOCALE_COOKIE)?.value);

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    timeZone: "Asia/Dhaka",
  };
});
