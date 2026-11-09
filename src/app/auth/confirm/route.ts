import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { setLocaleCookie } from "@/i18n/cookie";
import { resolveLocale } from "@/i18n/config";
import { AFTER_LOGIN_PATH, LOGIN_PATH, safeNextPath } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES: readonly EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

/**
 * Landing point for Supabase Auth e-mail links (sign-up confirmation,
 * password recovery, e-mail change). This is an auth callback, the one kind
 * of Route Handler besides webhooks and cron that the app uses, because an
 * e-mail link can only issue a GET (README → Decisions).
 *
 * Supports both link styles:
 *   ?token_hash=…&type=…   (recommended SSR template)
 *   ?code=…                (PKCE redirect)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"), AFTER_LOGIN_PATH);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");

  const supabase = await createClient();
  let ok = false;

  if (tokenHash && type && (OTP_TYPES as readonly string[]).includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type: type as EmailOtpType, token_hash: tokenHash });
    ok = !error;
    if (error) console.error("auth/confirm verifyOtp", error.code);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
    if (error) console.error("auth/confirm exchangeCode", error.code);
  }

  if (!ok) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    url.search = "?error=link_expired";
    return NextResponse.redirect(url);
  }

  // Restore the user's saved language on the device that opened the link.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("locale").eq("id", user.id).maybeSingle();
    if (profile?.locale) await setLocaleCookie(resolveLocale(profile.locale));
  }

  const url = request.nextUrl.clone();
  const [pathname, query] = next.split("?");
  url.pathname = pathname;
  url.search = query ? `?${query}` : "";
  return NextResponse.redirect(url);
}
