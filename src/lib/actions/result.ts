import type { ValidationCode } from "@/lib/validation/common";

/**
 * Form-level error codes. The UI renders `formErrors.<code>` in the active
 * locale, so Server Actions never return user-facing English.
 */
export const FORM_ERROR_CODES = [
  "validation",
  "invalidCredentials",
  "emailNotConfirmed",
  "emailTaken",
  "weakPassword",
  "samePassword",
  "rateLimited",
  "accountSuspended",
  "sessionExpired",
  "notAllowed",
  "notProvider",
  "notFound",
  "listingLocked",
  "hasRequests",
  "windowPassed",
  "uploadFailed",
  "generic",
] as const;
export type FormErrorCode = (typeof FORM_ERROR_CODES)[number];

export type ActionFailure = {
  ok: false;
  error: FormErrorCode;
  fieldErrors?: Partial<Record<string, ValidationCode>>;
};

export type ActionResult<T = void> = ({ ok: true } & (T extends void ? { data?: undefined } : { data: T })) | ActionFailure;

export const fail = (error: FormErrorCode, fieldErrors?: ActionFailure["fieldErrors"]): ActionFailure => ({
  ok: false,
  error,
  fieldErrors,
});
