import { z } from "zod";
import { LOCALES, type Locale } from "./config";

/**
 * Text stored per language (`en`, `fr`), or once for every language
 * (`shared`) when it does not need translating: technology names, proper
 * nouns. `shared` never coexists with `en`/`fr`; the database check
 * `private.is_localized_text` enforces the same rule.
 */
export type LocalizedTextValue = {
  en?: string;
  fr?: string;
  shared?: string;
};

export function isSharedText(value: LocalizedTextValue): boolean {
  return value.shared !== undefined;
}

/** Schema for a localized field limited to `maxLength` characters per language. */
export function localizedTextSchema(maxLength: number) {
  const text = z.string().trim().max(maxLength, { error: "tooLong" }).optional();
  return z
    .object({ en: text, fr: text, shared: text })
    .strict()
    .refine(
      (value) => value.shared === undefined || (value.en === undefined && value.fr === undefined),
      {
        error: "invalidLocalizedText",
      },
    );
}

/** Drops empty strings so "not written yet" is always represented by an absent key. */
export function normalizeLocalizedText(value: LocalizedTextValue): LocalizedTextValue {
  if (isSharedText(value)) {
    const shared = value.shared?.trim();
    return shared ? { shared } : {};
  }
  const result: LocalizedTextValue = {};
  for (const locale of LOCALES) {
    const text = value[locale]?.trim();
    if (text) result[locale] = text;
  }
  return result;
}

/** Reads untrusted JSON (e.g. a database row) as localized text; invalid shapes become empty. */
export function parseLocalizedText(value: unknown): LocalizedTextValue {
  const parsed = localizedTextSchema(Number.MAX_SAFE_INTEGER).safeParse(value);
  return parsed.success ? normalizeLocalizedText(parsed.data) : {};
}

/** The text for one language, or null when it has not been written. Never falls back silently. */
export function resolveLocalizedText(value: LocalizedTextValue, locale: Locale): string | null {
  if (isSharedText(value)) return value.shared?.trim() || null;
  return value[locale]?.trim() || null;
}

export function hasLocalizedText(value: LocalizedTextValue | null | undefined): boolean {
  if (!value) return false;
  return LOCALES.some((locale) => resolveLocalizedText(value, locale) !== null);
}

export type LocaleCoverage = Record<Locale, boolean>;

/** Which languages a value can be rendered in, for the EN | FR split indicator. */
export function getLocaleCoverage(value: LocalizedTextValue): LocaleCoverage {
  return Object.fromEntries(
    LOCALES.map((locale) => [locale, resolveLocalizedText(value, locale) !== null]),
  ) as LocaleCoverage;
}

/**
 * Coverage of a whole record: a language is complete when every field that has
 * any text has it in that language. Fields left empty in both are ignored.
 */
export function getCombinedCoverage(values: readonly LocalizedTextValue[]): LocaleCoverage {
  const written = values.filter(hasLocalizedText);
  return Object.fromEntries(
    LOCALES.map((locale) => [
      locale,
      written.length > 0 && written.every((value) => resolveLocalizedText(value, locale) !== null),
    ]),
  ) as LocaleCoverage;
}

/** Best label for lists: the requested language, else any written text, flagged as foreign. */
export function displayLocalizedText(
  value: LocalizedTextValue,
  locale: Locale,
): { text: string; locale: Locale | null } | null {
  const own = resolveLocalizedText(value, locale);
  if (own) return { text: own, locale: null };
  for (const other of LOCALES) {
    const text = resolveLocalizedText(value, other);
    if (text) return { text, locale: other };
  }
  return null;
}
