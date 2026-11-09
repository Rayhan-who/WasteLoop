import { z } from "zod";
import { SELF_SERVICE_ROLES } from "@/lib/domain";
import { LOCALES } from "@/i18n/config";
import { emailField, msg, optionalPhone, optionalText, passwordField, requiredText } from "./common";

/** FR-1.1 registration, FR-1.2 role selection (one or more, never admin). */
export const registerSchema = z
  .object({
    displayName: requiredText(80),
    orgName: optionalText(120),
    email: emailField,
    phone: optionalPhone,
    password: passwordField,
    confirmPassword: z.string(msg("required")),
    roles: z.array(z.enum(SELF_SERVICE_ROLES, msg("invalid")), msg("rolesRequired")).min(1, msg("rolesRequired")),
    locale: z.enum(LOCALES).optional(),
  })
  .refine((v) => v.password === v.confirmPassword, { ...msg("passwordsDontMatch"), path: ["confirmPassword"] });

export type RegisterInput = z.input<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailField,
  password: z.string(msg("required")).min(1, msg("required")),
  remember: z.boolean().optional(),
  next: z.string().optional(),
});
export type LoginInput = z.input<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: emailField });
export type ForgotPasswordInput = z.input<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({ password: passwordField, confirmPassword: z.string(msg("required")) })
  .refine((v) => v.password === v.confirmPassword, { ...msg("passwordsDontMatch"), path: ["confirmPassword"] });
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;
