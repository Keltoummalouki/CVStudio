import { z } from "zod";
import { definitionSchema } from "@/features/cv-builder/definition";
import { LOCALES } from "@/lib/i18n/config";

export const CV_NAME_MAX = 120;

export const cvNameSchema = z
  .string()
  .trim()
  .min(1, { error: "required" })
  .max(CV_NAME_MAX, { error: "tooLong" });

export const cvLocaleSchema = z.enum(LOCALES);

export const createCvSchema = z.object({
  name: cvNameSchema,
  locale: cvLocaleSchema,
  /** Start from a saved template's setup instead of all career data. */
  templateId: z.uuid().optional(),
});
export type CreateCvValues = z.infer<typeof createCvSchema>;

export const saveCvSchema = z.object({
  id: z.uuid(),
  expectedRevision: z.int().min(1),
  name: cvNameSchema,
  locale: cvLocaleSchema,
  definition: definitionSchema,
});
export type SaveCvValues = z.infer<typeof saveCvSchema>;
