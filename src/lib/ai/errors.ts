import type { AiProviderId } from "@/config/ai";
import type { ActionErrorCode, FieldIssue } from "@/lib/actions/result";

/** Why an AI request produced no usable answer, in the terms the UI explains. */
export const AI_ERROR_CODES = [
  "ai_not_configured",
  "ai_disabled",
  "ai_limit_reached",
  "ai_busy",
  "ai_timeout",
  "ai_rate_limited",
  "ai_too_large",
  "ai_overloaded",
  "ai_unavailable",
  "ai_rejected",
  "ai_key_rejected",
  "ai_invalid_response",
  /** The primary and the fallback were both unavailable. */
  "ai_providers_unavailable",
] as const;
export type AiErrorCode = (typeof AI_ERROR_CODES)[number];

/** Failures a provider caused; the UI names it. */
const PROVIDER_ERROR_CODES = [
  "ai_timeout",
  "ai_rate_limited",
  "ai_too_large",
  "ai_overloaded",
  "ai_unavailable",
  "ai_rejected",
  "ai_key_rejected",
  "ai_invalid_response",
] as const satisfies readonly AiErrorCode[];
export type ProviderErrorCode = (typeof PROVIDER_ERROR_CODES)[number];

export function isAiErrorCode(value: string): value is AiErrorCode {
  return (AI_ERROR_CODES as readonly string[]).includes(value);
}

export function isProviderErrorCode(value: string): value is ProviderErrorCode {
  return (PROVIDER_ERROR_CODES as readonly string[]).includes(value);
}

/** Why an AI action failed and, when a provider caused it, which one. */
export type AiFailureInfo = {
  error: ActionErrorCode | AiErrorCode;
  provider?: AiProviderId | undefined;
};

/** A Server Action result that may also fail for an AI-specific reason. */
export type AiActionResult<T> =
  { ok: true; data: T } | ({ ok: false; fieldIssues?: FieldIssue[] } & AiFailureInfo);
