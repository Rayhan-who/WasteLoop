import "server-only";
import { cache } from "react";
import type { UserRole } from "@/lib/domain";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export type CurrentProfile = Pick<
  Tables<"profiles">,
  "id" | "display_name" | "org_name" | "phone" | "email" | "bio" | "general_location" | "locale" | "is_suspended" | "deactivated_at"
> & {
  roles: UserRole[];
  isAdmin: boolean;
};

/**
 * The signed-in user's own profile and roles, or null when signed out.
 * Wrapped in React cache() so the header, layout and page share one query
 * per request.
 */
export const getCurrentProfile = cache(async (): Promise<CurrentProfile | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, org_name, phone, email, bio, general_location, locale, is_suspended, deactivated_at")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);
  if (!profile) return null;

  const roles = (roleRows ?? []).map((r) => r.role);
  return {
    ...profile,
    roles: roles.filter((r): r is UserRole => r !== "admin"),
    isAdmin: roles.includes("admin"),
  };
});
