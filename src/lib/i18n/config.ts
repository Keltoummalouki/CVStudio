/**
 * Single source of truth for supported languages.
 *
 * The same set serves two independent choices that must never be conflated:
 * - the dashboard interface language (URL prefix, dictionaries), and
 * - the output language of an individual CV document.
 */
export const LOCALES = ["en", "fr"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Endonyms: each language is always shown in its own language. */
export const LOCALE_ENDONYMS: Record<Locale, string> = {
  en: "English",
  fr: "Français",
};
