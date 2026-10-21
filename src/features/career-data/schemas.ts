import { z } from "zod";
import { hasLocalizedText, localizedTextSchema } from "@/lib/i18n/localized-text";

/**
 * Shared by forms (client feedback) and Server Actions (enforcement). Limits
 * mirror the database checks; messages are keys under `validation.*`.
 */

const id = z.uuid().nullable();
const expectedUpdatedAt = z.string().max(64).nullable();
const expectedStamp = z.string().max(64).nullable();

const optionalText = (max: number) => z.string().trim().max(max, { error: "tooLong" });

const requiredText = (max: number) =>
  z.string().trim().min(1, { error: "required" }).max(max, { error: "tooLong" });

export const localized = (max: number) => localizedTextSchema(max);

export const requiredLocalized = (max: number) =>
  localizedTextSchema(max).refine(hasLocalizedText, { error: "requiredOneLanguage" });

const optionalUrl = z
  .string()
  .trim()
  .max(2048, { error: "tooLong" })
  .refine((value) => value === "" || /^https?:\/\/[^\s]+$/i.test(value), { error: "invalidUrl" });

const year = z.number().int().min(1900).max(2100).nullable();
const month = z.number().int().min(1).max(12).nullable();

/** Calendar period with optional month precision and an explicit "ongoing" flag. */
export const periodSchema = z
  .object({
    startYear: year,
    startMonth: month,
    endYear: year,
    endMonth: month,
    isCurrent: z.boolean(),
  })
  .superRefine((period, context) => {
    if (period.startMonth !== null && period.startYear === null) {
      context.addIssue({ code: "custom", path: ["startYear"], message: "required" });
    }
    if (period.endMonth !== null && period.endYear === null) {
      context.addIssue({ code: "custom", path: ["endYear"], message: "required" });
    }
    if (
      !period.isCurrent &&
      period.startYear !== null &&
      period.endYear !== null &&
      (period.endYear < period.startYear ||
        (period.endYear === period.startYear && (period.endMonth ?? 12) < (period.startMonth ?? 1)))
    ) {
      context.addIssue({ code: "custom", path: ["endYear"], message: "endBeforeStart" });
    }
  });

export type PeriodValues = z.infer<typeof periodSchema>;

export const EMPTY_PERIOD: PeriodValues = {
  startYear: null,
  startMonth: null,
  endYear: null,
  endMonth: null,
  isCurrent: false,
};

export const DETAIL_KINDS = ["bullet", "technology", "paragraph"] as const;
export type DetailKind = (typeof DETAIL_KINDS)[number];

export const detailSchema = z.object({
  id,
  kind: z.enum(DETAIL_KINDS),
  text: requiredLocalized(1000),
});

export type DetailValues = z.infer<typeof detailSchema>;

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export const LINK_KINDS = ["linkedin", "github", "portfolio", "website", "other"] as const;
export type LinkKind = (typeof LINK_KINDS)[number];

export const profileLinkSchema = z.object({
  id,
  kind: z.enum(LINK_KINDS),
  label: localized(80),
  displayText: optionalText(120),
  url: requiredText(2048).refine((value) => /^https?:\/\/[^\s]+$/i.test(value), {
    error: "invalidUrl",
  }),
});

export const profileSchema = z.object({
  expectedUpdatedAt,
  fullName: optionalText(120),
  title: localized(160),
  summary: localized(2000),
  location: localized(160),
  email: optionalText(254).refine(
    (value) => value === "" || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value),
    { error: "invalidEmail" },
  ),
  phone: optionalText(40).refine((value) => /^[0-9+().\s-]*$/.test(value), {
    error: "invalidPhone",
  }),
  links: z.array(profileLinkSchema).max(20, { error: "tooMany" }),
});

export type ProfileValues = z.infer<typeof profileSchema>;

// ---------------------------------------------------------------------------
// Records with nested details
// ---------------------------------------------------------------------------

export const experienceSchema = z.object({
  id,
  expectedUpdatedAt,
  organization: requiredText(160),
  role: requiredLocalized(160),
  location: localized(160),
  period: periodSchema,
  details: z.array(detailSchema).max(100, { error: "tooMany" }),
});

export type ExperienceValues = z.infer<typeof experienceSchema>;

export const projectSchema = z.object({
  id,
  expectedUpdatedAt,
  title: requiredLocalized(200),
  description: localized(2000),
  projectUrl: optionalUrl,
  sourceUrl: optionalUrl,
  period: periodSchema,
  details: z.array(detailSchema).max(100, { error: "tooMany" }),
});

export type ProjectValues = z.infer<typeof projectSchema>;

export const educationSchema = z.object({
  id,
  expectedUpdatedAt,
  credential: requiredLocalized(200),
  institution: localized(200),
  location: localized(160),
  description: localized(2000),
  period: periodSchema,
});

export type EducationValues = z.infer<typeof educationSchema>;

export const certificationSchema = z.object({
  id,
  expectedUpdatedAt,
  title: requiredLocalized(200),
  issuer: localized(200),
  issuedYear: year,
  issuedMonth: month,
  credentialUrl: optionalUrl,
});

export type CertificationValues = z.infer<typeof certificationSchema>;

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

export const softSkillsSchema = z.object({
  expectedStamp,
  items: z.array(z.object({ id, label: requiredLocalized(120) })).max(100, { error: "tooMany" }),
});

export type SoftSkillsValues = z.infer<typeof softSkillsSchema>;

export const spokenLanguagesSchema = z.object({
  expectedStamp,
  items: z
    .array(z.object({ id, name: requiredLocalized(80), proficiency: localized(80) }))
    .max(50, { error: "tooMany" }),
});

export type SpokenLanguagesValues = z.infer<typeof spokenLanguagesSchema>;

export const skillGroupsSchema = z.object({
  expectedStamp,
  groups: z
    .array(
      z.object({
        id,
        title: requiredLocalized(80),
        skills: z
          .array(z.object({ id, label: requiredLocalized(120) }))
          .max(60, { error: "tooMany" }),
      }),
    )
    .max(30, { error: "tooMany" }),
});

export type SkillGroupsValues = z.infer<typeof skillGroupsSchema>;

// ---------------------------------------------------------------------------
// Custom sections
// ---------------------------------------------------------------------------

export const CUSTOM_ITEM_KINDS = ["bullet", "paragraph", "key_value"] as const;
export type CustomItemKind = (typeof CUSTOM_ITEM_KINDS)[number];

export const customSectionSchema = z.object({
  id,
  expectedUpdatedAt,
  title: requiredLocalized(120),
  subsections: z
    .array(
      z.object({
        id,
        title: localized(160),
        items: z
          .array(
            z.object({
              id,
              kind: z.enum(CUSTOM_ITEM_KINDS),
              label: localized(120),
              text: requiredLocalized(2000),
            }),
          )
          .max(60, { error: "tooMany" }),
      }),
    )
    .min(1, { error: "required" })
    .max(20, { error: "tooMany" }),
});

export type CustomSectionValues = z.infer<typeof customSectionSchema>;
