import { z } from "zod";
import { definitionSchema } from "@/features/cv-builder/definition";
import { tailoringChoiceSchema } from "@/features/cv-tailoring/schemas";
import { LOCALES } from "@/lib/i18n/config";

export const CV_NAME_MAX = 120;

export const cvNameSchema = z
  .string()
  .trim()
  .min(1, { error: "required" })
  .max(CV_NAME_MAX, { error: "tooLong" });

export const cvLocaleSchema = z.enum(LOCALES);

export const createCvSchema = z
  .object({
    name: cvNameSchema,
    locale: cvLocaleSchema,
    /** Drawn by one of the owner's designs instead of Classic. */
    templateId: z.uuid().optional(),
    /** The owner's job post this CV is made for: the CV links to it. */
    jobPostId: z.uuid().optional(),
    /** What a CV tailored to that job post shows, as the owner accepted it. */
    tailoring: tailoringChoiceSchema.optional(),
  })
  .refine((values) => !values.tailoring || values.jobPostId, {
    path: ["tailoring"],
    error: "invalid",
  });
export type CreateCvValues = z.input<typeof createCvSchema>;

/** The fields the New CV form edits itself; its choices supply the rest. */
export const newCvFormSchema = z.object({ name: cvNameSchema, locale: cvLocaleSchema });
export type NewCvFormValues = z.infer<typeof newCvFormSchema>;

export const saveCvSchema = z.object({
  id: z.uuid(),
  expectedRevision: z.int().min(1),
  name: cvNameSchema,
  locale: cvLocaleSchema,
  definition: definitionSchema,
});
export type SaveCvValues = z.infer<typeof saveCvSchema>;
