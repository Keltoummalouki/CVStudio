import type { AuthErrorCode } from "./schema";

type AuthErrorLike = { status?: number; code?: string; name?: string } | null | undefined;

/**
 * Maps Supabase Auth failures to the few outcomes the login form explains.
 * Unknown users, wrong passwords and unconfirmed emails deliberately share one
 * message so the form never reveals which accounts exist.
 */
export function mapSignInError(error: AuthErrorLike): AuthErrorCode {
  if (!error) return "unavailable";
  if (error.status === 429 || error.code === "over_request_rate_limit") return "rate_limited";
  if (
    error.code === "invalid_credentials" ||
    error.code === "email_not_confirmed" ||
    error.code === "user_not_found" ||
    error.status === 400
  ) {
    return "invalid_credentials";
  }
  return "unavailable";
}
