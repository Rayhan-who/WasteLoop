import { z } from "zod";
import { SELF_SERVICE_ROLES } from "@/lib/domain";
import { LOCALES } from "@/i18n/config";
import { msg, optionalPhone, optionalText, requiredText } from "./common";

/** Profile editing (FR-1.x). Location coordinates are set from the map in milestone 5. */
export const profileSchema = z.object({
  displayName: requiredText(80),
  orgName: optionalText(120),
  phone: optionalPhone,
  bio: optionalText(600),
  generalLocation: optionalText(120),
});
export type ProfileInput = z.input<typeof profileSchema>;

export const rolesSchema = z.object({
  roles: z.array(z.enum(SELF_SERVICE_ROLES, msg("invalid"))).min(1, msg("rolesRequired")),
});
export type RolesInput = z.input<typeof rolesSchema>;

export const localeSchema = z.enum(LOCALES);

/** The user types a fixed confirmation word (per locale) to deactivate. */
export const deactivateSchema = z.object({
  confirmation: z.string(msg("required")).trim().min(1, msg("required")),
  requestDataRemoval: z.boolean(),
  reason: optionalText(1000),
});
export type DeactivateInput = z.input<typeof deactivateSchema>;

/** Words accepted to confirm deactivation, in either language. */
export const DEACTIVATE_CONFIRM_WORDS = ["DEACTIVATE", "নিষ্ক্রিয়"] as const;

export function isDeactivateConfirmation(value: string): boolean {
  const v = value.trim().normalize("NFC").toLocaleUpperCase("en");
  return DEACTIVATE_CONFIRM_WORDS.some((w) => w.normalize("NFC").toLocaleUpperCase("en") === v);
}
