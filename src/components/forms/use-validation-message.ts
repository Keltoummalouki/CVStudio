"use client";

import { useTranslations } from "next-intl";
import type { FieldError, FieldErrors } from "react-hook-form";

type ValidationKey =
  | "required"
  | "invalidEmail"
  | "tooLong"
  | "requiredOneLanguage"
  | "invalidUrl"
  | "invalidPhone"
  | "endBeforeStart"
  | "tooMany"
  | "invalidLocalizedText"
  | "tooShort"
  | "duplicateTerm"
  | "invalid";

const KNOWN = new Set<string>([
  "required",
  "invalidEmail",
  "tooLong",
  "requiredOneLanguage",
  "invalidUrl",
  "invalidPhone",
  "endBeforeStart",
  "tooMany",
  "invalidLocalizedText",
  "tooShort",
  "duplicateTerm",
]);

/** First message found on a field or, for nested values like localized text, its children. */
export function firstErrorMessage(error: FieldError | FieldErrors | undefined): string | undefined {
  if (!error) return undefined;
  if (typeof error.message === "string" && error.message) return error.message;
  for (const value of Object.values(error)) {
    if (value && typeof value === "object" && "message" in value) {
      const nested = firstErrorMessage(value as FieldError);
      if (nested) return nested;
    }
  }
  return undefined;
}

/** Translates schema message keys; unknown keys fall back to a generic message. */
export function useValidationMessage() {
  const t = useTranslations("validation");
  return (error: FieldError | FieldErrors | undefined): string | undefined => {
    const key = firstErrorMessage(error);
    if (!key) return undefined;
    return t((KNOWN.has(key) ? key : "invalid") as ValidationKey);
  };
}
