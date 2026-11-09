import type { FormErrorCode } from "@/lib/actions/result";

/**
 * Map a Supabase Auth error to a translatable form error code.
 * Unknown errors become "generic": raw provider messages are English-only
 * and may leak details, so they are logged, never shown.
 */
export function mapAuthError(error: { code?: string; status?: number } | null | undefined): FormErrorCode {
  switch (error?.code) {
    case "invalid_credentials":
      return "invalidCredentials";
    case "email_not_confirmed":
      return "emailNotConfirmed";
    case "user_already_exists":
    case "email_exists":
      return "emailTaken";
    case "weak_password":
      return "weakPassword";
    case "same_password":
      return "samePassword";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
    case "over_sms_send_rate_limit":
      return "rateLimited";
    case "user_banned":
      return "accountSuspended";
    case "session_not_found":
    case "session_expired":
    case "refresh_token_not_found":
    case "otp_expired":
    case "flow_state_expired":
      return "sessionExpired";
    case "email_address_invalid":
      return "validation";
  }
  if (error?.status === 429) return "rateLimited";
  return "generic";
}
