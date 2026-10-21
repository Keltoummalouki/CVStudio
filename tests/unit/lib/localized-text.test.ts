import { describe, expect, it } from "vitest";
import {
  getLocaleCoverage,
  hasLocalizedText,
  localizedTextSchema,
  normalizeLocalizedText,
  parseLocalizedText,
  resolveLocalizedText,
} from "@/lib/i18n/localized-text";

describe("localized text", () => {
  it("resolves each language without silently falling back to the other", () => {
    const value = { en: "Teamwork" };
    expect(resolveLocalizedText(value, "en")).toBe("Teamwork");
    expect(resolveLocalizedText(value, "fr")).toBeNull();
  });

  it("uses a shared value for every language", () => {
    const value = { shared: "TypeScript" };
    expect(resolveLocalizedText(value, "en")).toBe("TypeScript");
    expect(resolveLocalizedText(value, "fr")).toBe("TypeScript");
    expect(getLocaleCoverage(value)).toEqual({ en: true, fr: true });
  });

  it("reports coverage per language", () => {
    expect(getLocaleCoverage({ fr: "Travail en équipe" })).toEqual({ en: false, fr: true });
    expect(getLocaleCoverage({})).toEqual({ en: false, fr: false });
  });

  it("normalizes whitespace-only text to absent keys", () => {
    expect(normalizeLocalizedText({ en: "  ", fr: " Bonjour " })).toEqual({ fr: "Bonjour" });
    expect(normalizeLocalizedText({ shared: "   " })).toEqual({});
    expect(hasLocalizedText({ en: "   " })).toBe(false);
  });

  it("mirrors the database rule: shared and translations never mix", () => {
    const schema = localizedTextSchema(20);
    expect(schema.safeParse({ shared: "React" }).success).toBe(true);
    expect(schema.safeParse({ en: "Hi", fr: "Salut" }).success).toBe(true);
    expect(schema.safeParse({ shared: "React", en: "React" }).success).toBe(false);
    expect(schema.safeParse({ de: "Hallo" }).success).toBe(false);
    expect(schema.safeParse({ en: "x".repeat(21) }).success).toBe(false);
  });

  it("treats malformed stored values as empty instead of crashing", () => {
    expect(parseLocalizedText(null)).toEqual({});
    expect(parseLocalizedText({ en: 42 })).toEqual({});
    expect(parseLocalizedText({ en: "Hello" })).toEqual({ en: "Hello" });
  });
});
