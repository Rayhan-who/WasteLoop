import { z } from "zod";

/**
 * Validation error codes. Every schema reports one of these as its message,
 * and the UI renders `validation.<code>` from the active locale's catalogue,
 * so the same schema validates on the client and in Server Actions and the
 * error still appears in Bangla or English.
 */
export const VALIDATION_CODES = [
  "required",
  "invalid",
  "emailInvalid",
  "passwordTooShort",
  "passwordTooLong",
  "passwordsDontMatch",
  "phoneInvalid",
  "tooLong",
  "tooShort",
  "rolesRequired",
  "confirmationMismatch",
] as const;
export type ValidationCode = (typeof VALIDATION_CODES)[number];

export const msg = (code: ValidationCode) => ({ error: code });

/** Trimmed string; empty after trimming counts as missing. */
export const requiredText = (max: number, min = 1) =>
  z
    .string(msg("required"))
    .trim()
    .min(min, msg(min > 1 ? "tooShort" : "required"))
    .max(max, msg("tooLong"));

/** Trimmed optional string; empty becomes undefined. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, msg("tooLong"))
    .optional()
    .transform((v) => (v ? v : undefined));

export const emailField = z.string(msg("required")).trim().toLowerCase().pipe(z.email(msg("emailInvalid")));

// Supabase Auth hashes with bcrypt, which ignores bytes beyond 72.
export const passwordField = z.string(msg("required")).min(8, msg("passwordTooShort")).max(72, msg("passwordTooLong"));

/**
 * Bangladeshi mobile number: 01[3-9]XXXXXXXX, optionally prefixed by +880 or
 * 880. Spaces and dashes are ignored. Normalised to +8801XXXXXXXXX.
 */
export const BD_MOBILE = /^(?:\+?880|0)?(1[3-9]\d{8})$/;

export const optionalPhone = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v.replace(/[\s-]/g, "") : undefined))
  .refine((v) => v === undefined || BD_MOBILE.test(v), msg("phoneInvalid"))
  .transform((v) => (v === undefined ? undefined : `+880${v.match(BD_MOBILE)![1]}`));

/** Flatten a ZodError into { field: code } for the form, first error per field. */
export function fieldErrors(error: z.ZodError): Record<string, ValidationCode> {
  const out: Record<string, ValidationCode> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (out[key]) continue;
    out[key] = (VALIDATION_CODES as readonly string[]).includes(issue.message)
      ? (issue.message as ValidationCode)
      : "invalid";
  }
  return out;
}
