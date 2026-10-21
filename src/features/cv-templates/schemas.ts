import { z } from "zod";
import { definitionSchema } from "@/features/cv-builder/definition";
import { cvLocaleSchema, cvNameSchema } from "@/features/cv-documents/schemas";

export const TEMPLATE_NAME_MAX = 120;
export const TEMPLATE_DESCRIPTION_MAX = 500;

/** Same limits as a CV name (and the cv_templates check constraint). */
export const templateNameSchema = cvNameSchema;

export const templateDescriptionSchema = z
  .string()
  .trim()
  .max(TEMPLATE_DESCRIPTION_MAX, { error: "tooLong" });

export const newTemplateDetailsSchema = z.object({
  name: templateNameSchema,
  description: templateDescriptionSchema,
});
export type NewTemplateDetails = z.infer<typeof newTemplateDetailsSchema>;

/**
 * Saving a CV as a template: either a new template, or the setup of an
 * existing one replaced (its name and description stay).
 */
export const saveCvAsTemplateSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("new"), cvId: z.uuid(), ...newTemplateDetailsSchema.shape }),
  z.object({ mode: z.literal("replace"), cvId: z.uuid(), templateId: z.uuid() }),
]);
export type SaveCvAsTemplateValues = z.infer<typeof saveCvAsTemplateSchema>;

export const saveTemplateSchema = z.object({
  id: z.uuid(),
  expectedRevision: z.int().min(1),
  name: templateNameSchema,
  description: templateDescriptionSchema,
  locale: cvLocaleSchema,
  definition: definitionSchema,
});
export type SaveTemplateValues = z.infer<typeof saveTemplateSchema>;
