import { z } from "zod";
import { jobPostSchema } from "@/features/job-posts/schemas";
import { LOCALES } from "@/lib/i18n/config";
import { TAILORED_PROJECTS, TAILORING_MODES } from "./tailoring";

/** The header title's own limit (cv-builder/definition.ts). */
const TITLE_MAX = 160;
/** 30 skill groups of 60 skills, the career data's limits. */
const SKILL_IDS_MAX = 1_800;

/**
 * The job a CV is tailored to: one of the owner's saved posts, or a post the
 * New CV page has just analyzed and not saved yet (it is saved with the CV).
 */
export const tailoringJobSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("saved"), id: z.uuid() }).strict(),
  z
    .object({
      kind: z.literal("draft"),
      draft: jobPostSchema.omit({ id: true, expectedUpdatedAt: true }),
    })
    .strict(),
]);

export const tailorCvSchema = z
  .object({
    job: tailoringJobSchema,
    /** The CV's language: texts, title and missing translations follow it. */
    cvLocale: z.enum(LOCALES),
    /** The dashboard's language, which the AI explains its choices in. */
    uiLocale: z.enum(LOCALES),
    mode: z.enum(TAILORING_MODES),
  })
  .strict();
export type TailorCvValues = z.infer<typeof tailorCvSchema>;

/** What the owner accepted, applied by createCv after checking every id against their data. */
export const tailoringChoiceSchema = z
  .object({
    projectIds: z.array(z.uuid()).max(TAILORED_PROJECTS),
    skillIds: z.array(z.uuid()).max(SKILL_IDS_MAX),
    title: z
      .string()
      .trim()
      .max(TITLE_MAX, { error: "tooLong" })
      .nullable()
      .transform((title) => title || null),
  })
  .strict();
export type TailoringChoiceValues = z.input<typeof tailoringChoiceSchema>;
