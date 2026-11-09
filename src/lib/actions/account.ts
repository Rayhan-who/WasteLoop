"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { UserRole } from "@/lib/domain";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { fieldErrors } from "@/lib/validation/common";
import {
  deactivateSchema,
  isDeactivateConfirmation,
  profileSchema,
  rolesSchema,
  type DeactivateInput,
  type ProfileInput,
  type RolesInput,
} from "@/lib/validation/profile";
import { fail, type ActionResult } from "./result";

/** FR-1.x: edit display name, organisation, phone, bio and general location. */
export async function updateProfileAction(input: ProfileInput): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return fail("validation", fieldErrors(parsed.error));

  const user = await getCurrentUser();
  if (!user) return fail("sessionExpired");

  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: v.displayName,
      org_name: v.orgName ?? null,
      phone: v.phone ?? null,
      bio: v.bio ?? null,
      general_location: v.generalLocation ?? null,
    })
    .eq("id", user.id);

  if (error) {
    console.error("updateProfileAction", error);
    return fail("generic");
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * FR-1.2: change which self-service roles the user holds. At least one must
 * remain. The admin role is never touched here (RLS also forbids it).
 */
export async function updateRolesAction(input: RolesInput): Promise<ActionResult> {
  const parsed = rolesSchema.safeParse(input);
  if (!parsed.success) return fail("validation", fieldErrors(parsed.error));

  const user = await getCurrentUser();
  if (!user) return fail("sessionExpired");

  const supabase = await createClient();
  const { data: current, error: readError } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  if (readError) return fail("generic");

  const have = new Set<UserRole>((current ?? []).map((r) => r.role).filter((r) => r !== "admin"));
  const want = new Set<UserRole>(parsed.data.roles);
  const toAdd = [...want].filter((r) => !have.has(r));
  const toRemove = [...have].filter((r) => !want.has(r));

  // Add first so the user is never left with zero roles if a step fails.
  if (toAdd.length > 0) {
    const { error } = await supabase.from("user_roles").insert(toAdd.map((role) => ({ user_id: user.id, role })));
    if (error) {
      console.error("updateRolesAction insert", error);
      return fail("generic");
    }
  }
  if (toRemove.length > 0) {
    const { error } = await supabase.from("user_roles").delete().eq("user_id", user.id).in("role", toRemove);
    if (error) {
      console.error("updateRolesAction delete", error);
      return fail("generic");
    }
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Deactivate the account: pause the user's live listings, withdraw their
 * pending requests, optionally file a data-removal request for an admin,
 * then sign out. Signing in again reactivates the account.
 */
export async function deactivateAccountAction(input: DeactivateInput): Promise<ActionResult> {
  const parsed = deactivateSchema.safeParse(input);
  if (!parsed.success) return fail("validation", fieldErrors(parsed.error));
  if (!isDeactivateConfirmation(parsed.data.confirmation)) {
    return fail("validation", { confirmation: "confirmationMismatch" });
  }

  const user = await getCurrentUser();
  if (!user) return fail("sessionExpired");
  const supabase = await createClient();

  const steps = await Promise.all([
    supabase.from("listings").update({ status: "paused" }).eq("provider_id", user.id).eq("status", "available"),
    supabase
      .from("requests")
      .update({ status: "withdrawn", decided_at: new Date().toISOString() })
      .eq("taker_id", user.id)
      .eq("status", "pending"),
  ]);
  const stepError = steps.find((s) => s.error)?.error;
  if (stepError) {
    console.error("deactivateAccountAction", stepError);
    return fail("generic");
  }

  if (parsed.data.requestDataRemoval) {
    const { error } = await supabase
      .from("data_removal_requests")
      .insert({ user_id: user.id, email_snapshot: user.email ?? null, reason: parsed.data.reason ?? null });
    // 23505: an open request already exists, which is fine.
    if (error && error.code !== "23505") {
      console.error("deactivateAccountAction removal request", error);
      return fail("generic");
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({ deactivated_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) {
    console.error("deactivateAccountAction profile", error);
    return fail("generic");
  }

  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login?deactivated=1");
}
