"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { resolveLocale } from "@/i18n/config";
import { getLocaleCookie, setLocaleCookie } from "@/i18n/cookie";
import { mapAuthError } from "@/lib/auth-errors";
import { publicEnv } from "@/lib/env";
import { AFTER_LOGIN_PATH, safeNextPath } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors } from "@/lib/validation/common";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  type ForgotPasswordInput,
  type LoginInput,
  type RegisterInput,
  type ResetPasswordInput,
} from "@/lib/validation/auth";
import { fail, type ActionResult } from "./result";

/** Origin of the current request, so e-mail links work on preview deployments too. */
async function requestOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : publicEnv.siteUrl;
}

/**
 * FR-1.1 / FR-1.2: create an account with one or more self-chosen roles.
 * Profile and roles are created by the handle_new_user() trigger from the
 * sign-up metadata; the trigger drops any attempt to claim 'admin'.
 */
export async function registerAction(input: RegisterInput): Promise<ActionResult<{ needsConfirmation: boolean }>> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return fail("validation", fieldErrors(parsed.error));
  const v = parsed.data;

  const locale = v.locale ?? resolveLocale(await getLocaleCookie());
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: v.email,
    password: v.password,
    options: {
      emailRedirectTo: `${await requestOrigin()}/auth/confirm?next=${encodeURIComponent(AFTER_LOGIN_PATH)}`,
      data: {
        display_name: v.displayName,
        org_name: v.orgName ?? null,
        phone: v.phone ?? null,
        roles: v.roles,
        locale,
      },
    },
  });

  if (error) {
    console.error("registerAction", error.code, error.message);
    return fail(mapAuthError(error));
  }

  // With e-mail confirmation on, Supabase returns no session (and, for an
  // address that is already registered, a user with no identities, so the
  // response does not reveal which addresses exist). Both cases: "check your inbox".
  if (!data.session) return { ok: true, data: { needsConfirmation: true } };

  await setLocaleCookie(locale);
  revalidatePath("/", "layout");
  redirect(AFTER_LOGIN_PATH);
}

/**
 * Sign in. Suspended accounts are signed straight back out. A deactivated
 * account is reactivated by signing in again, and the user is told so.
 * The user's saved language is restored.
 */
export async function loginAction(input: LoginInput): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return fail("validation", fieldErrors(parsed.error));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error || !data.user) {
    if (error && error.code !== "invalid_credentials") console.error("loginAction", error.code, error.message);
    return fail(mapAuthError(error));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("locale, is_suspended, deactivated_at")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profile?.is_suspended) {
    await supabase.auth.signOut();
    return fail("accountSuspended");
  }

  let target = safeNextPath(parsed.data.next);
  if (profile?.deactivated_at) {
    await supabase.from("profiles").update({ deactivated_at: null }).eq("id", data.user.id);
    target = `${AFTER_LOGIN_PATH}?reactivated=1`;
  }

  if (profile?.locale) await setLocaleCookie(resolveLocale(profile.locale));
  revalidatePath("/", "layout");
  redirect(target);
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * Send a password-reset link. Always reports success (unless rate-limited)
 * so the form cannot be used to discover which e-mail addresses have accounts.
 */
export async function forgotPasswordAction(input: ForgotPasswordInput): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return fail("validation", fieldErrors(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await requestOrigin()}/auth/confirm?next=${encodeURIComponent("/reset-password")}`,
  });
  if (error) {
    const code = mapAuthError(error);
    if (code === "rateLimited") return fail(code);
    console.error("forgotPasswordAction", error.code, error.message);
  }
  return { ok: true };
}

/** Set a new password. Requires the session created by the recovery link. */
export async function resetPasswordAction(input: ResetPasswordInput): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return fail("validation", fieldErrors(parsed.error));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("sessionExpired");

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    console.error("resetPasswordAction", error.code, error.message);
    return fail(mapAuthError(error));
  }
  return { ok: true };
}
