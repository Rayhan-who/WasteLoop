"use server";

import { revalidatePath } from "next/cache";
import { isLocale } from "@/i18n/config";
import { setLocaleCookie } from "@/i18n/cookie";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

/**
 * Language switcher (SRS §4.7). Sets the locale cookie for this browser and,
 * for a signed-in user, saves it to profiles.locale so it follows them to
 * other devices (restored at login).
 */
export async function setLocale(locale: string): Promise<void> {
  if (!isLocale(locale)) throw new Error("Unsupported locale");

  await setLocaleCookie(locale);

  const user = await getCurrentUser();
  if (user) {
    const supabase = await createClient();
    // Best effort: a failure here must not block switching the UI language.
    const { error } = await supabase.from("profiles").update({ locale }).eq("id", user.id);
    if (error) console.error("setLocale: could not persist profile locale", error);
  }

  revalidatePath("/", "layout");
}
