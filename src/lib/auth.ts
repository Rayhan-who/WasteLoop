import "server-only";
import { notFound, redirect } from "next/navigation";
import { LOGIN_PATH } from "@/lib/routes";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

/**
 * Server-side authorisation helpers for layouts, pages and Server Actions.
 * The proxy only checks that a session exists; these re-check on the server
 * where the work happens, because a proxy must never be the only guard.
 */

/** The signed-in user, or a redirect to /login. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect(LOGIN_PATH);
  return user;
}

/** Whether the current user is an admin, via the is_admin() SQL helper (never a JWT claim). */
export async function isAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_admin");
  return !error && data === true;
}

/**
 * The signed-in admin. Non-admins get a 404 rather than a 403, so the
 * existence of admin pages is not advertised.
 */
export async function requireAdmin() {
  const user = await requireUser();
  if (!(await isAdmin())) notFound();
  return user;
}
