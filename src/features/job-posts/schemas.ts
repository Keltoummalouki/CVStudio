import { z } from "zod";
import { termKey } from "./matching";

/**
 * Job posts and their requirements. Shared by forms (client feedback) and
 * Server Actions (enforcement); limits mirror the database checks and
 * messages are keys under `validation.*`.
 */

export const REQUIREMENT_KINDS = [
  "skill",
  "tool",
  "language",
  "education",
  "certification",
  "experience",
  "soft_skill",
  "other",
] as const;
export type RequirementKind = (typeof REQUIREMENT_KINDS)[number];

export const REQUIREMENT_IMPORTANCE = ["required", "preferred"] as const;
export type RequirementImportance = (typeof REQUIREMENT_IMPORTANCE)[number];

export const JOB_POST_LANGUAGES = ["en", "fr", "other"] as const;
export type JobPostLanguage = (typeof JOB_POST_LANGUAGES)[number];

/** A stored language, or "other" for anything unexpected. */
export function toJobPostLanguage(value: string): JobPostLanguage {
  return (JOB_POST_LANGUAGES as readonly string[]).includes(value)
    ? (value as JobPostLanguage)
    : "other";
}

export const JOB_POST_LIMITS = {
  title: 160,
  company: 120,
  description: 15_000,
  /** Shorter text is not a job post worth an AI request. */
  minDescription: 40,
  requirements: 60,
  term: 80,
  aliases: 10,
  titleAliases: 10,
  note: 120,
} as const;

/** A name the matcher can look for: something with letters or digits in it. */
const term = z
  .string()
  .trim()
  .min(1, { error: "required" })
  .max(JOB_POST_LIMITS.term, { error: "tooLong" })
  .refine((value) => termKey(value) !== "", { error: "invalid" });

export const requirementSchema = z
  .object({
    id: z.uuid(),
    label: term,
    kind: z.enum(REQUIREMENT_KINDS),
    importance: z.enum(REQUIREMENT_IMPORTANCE),
    /** Other spellings and translations, e.g. "React.js" or "gestion de projet". */
    aliases: z.array(term).max(JOB_POST_LIMITS.aliases, { error: "tooMany" }),
    /** Context the keyword alone does not capture ("3+ years", "C1"); not matched. */
    note: z.string().trim().max(JOB_POST_LIMITS.note, { error: "tooLong" }),
  })
  .strict();
export type Requirement = z.infer<typeof requirementSchema>;

const requirementsShape = z
  .object({
    schemaVersion: z.literal(1),
    /** Other names of the job title, for the title check. */
    titleAliases: z.array(term).max(JOB_POST_LIMITS.titleAliases, { error: "tooMany" }),
    items: z.array(requirementSchema).max(JOB_POST_LIMITS.requirements, { error: "tooMany" }),
  })
  .strict();

/**
 * Stored requirements as read back. Duplicates are only refused on save, so a
 * change in matching rules can never make a saved job post unreadable.
 */
export const storedRequirementsSchema = requirementsShape;

/** A term used twice, by one requirement or two, would be counted twice. */
export const requirementsDocumentSchema = requirementsShape.superRefine((document, context) => {
  const owners = new Map<string, number>();
  document.items.forEach((item, index) => {
    const own = new Set<string>();
    [item.label, ...item.aliases].forEach((value, position) => {
      const key = termKey(value);
      if (!key) return;
      const owner = owners.get(key);
      if (own.has(key) || (owner !== undefined && owner !== index)) {
        context.addIssue({
          code: "custom",
          path:
            position === 0 ? ["items", index, "label"] : ["items", index, "aliases", position - 1],
          message: "duplicateTerm",
        });
      }
      own.add(key);
      if (owner === undefined) owners.set(key, index);
    });
  });
});
export type RequirementsDocument = z.infer<typeof requirementsDocumentSchema>;

export const EMPTY_REQUIREMENTS: RequirementsDocument = {
  schemaVersion: 1,
  titleAliases: [],
  items: [],
};

export const jobPostSchema = z
  .object({
    id: z.uuid().nullable(),
    expectedUpdatedAt: z.string().max(64).nullable(),
    title: z
      .string()
      .trim()
      .min(1, { error: "required" })
      .max(JOB_POST_LIMITS.title, { error: "tooLong" }),
    company: z.string().trim().max(JOB_POST_LIMITS.company, { error: "tooLong" }),
    language: z.enum(JOB_POST_LANGUAGES),
    description: z.string().trim().max(JOB_POST_LIMITS.description, { error: "tooLong" }),
    requirements: requirementsDocumentSchema,
    /** The requirements come from an AI analysis the owner reviewed in this edit. */
    analyzed: z.boolean(),
  })
  .strict();
export type JobPostValues = z.infer<typeof jobPostSchema>;

/** A new job post or an analysis result: everything but the stored identity. */
export type JobPostDraft = Omit<JobPostValues, "id" | "expectedUpdatedAt">;

export const NEW_JOB_POST: JobPostValues = {
  id: null,
  expectedUpdatedAt: null,
  title: "",
  company: "",
  language: "other",
  description: "",
  requirements: EMPTY_REQUIREMENTS,
  analyzed: false,
};

export const analyzeJobPostSchema = z
  .object({
    description: z
      .string()
      .trim()
      .min(JOB_POST_LIMITS.minDescription, { error: "tooShort" })
      .max(JOB_POST_LIMITS.description, { error: "tooLong" }),
  })
  .strict();
