import { z } from "zod";
import { cvLocaleSchema, cvNameSchema } from "@/features/cv-documents/schemas";
import { designSchema } from "@/features/cv-design/design";

export const TEMPLATE_NAME_MAX = 120;

/** Same limits as a CV name (and the cv_templates check constraint). */
export const templateNameSchema = cvNameSchema;

/** "Create a template": a blank A4 page, named and previewed in a language. */
export const createDesignTemplateSchema = z.object({
  name: templateNameSchema,
  locale: cvLocaleSchema,
});

/**
 * Autosave target of the designer. The draft also carries the template's
 * (unused) composition, which is ignored: a design never changes it.
 */
export const saveTemplateDesignSchema = z.object({
  id: z.uuid(),
  expectedRevision: z.int().min(1),
  name: templateNameSchema,
  locale: cvLocaleSchema,
  design: designSchema,
});
export type SaveTemplateDesignValues = z.infer<typeof saveTemplateDesignSchema>;
