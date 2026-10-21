import { z } from "zod";
import { LOCALES } from "@/lib/i18n/config";

/**
 * Validation messages are message keys under `validation.*`, translated by the
 * form, so the same schema serves client feedback and server enforcement.
 */
export const credentialsSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { error: "required" })
    .max(254)
    .pipe(z.email({ error: "invalidEmail" })),
  password: z.string().min(1, { error: "required" }).max(256),
});

export type Credentials = z.infer<typeof credentialsSchema>;

export const signInSchema = credentialsSchema.extend({
  locale: z.enum(LOCALES),
  next: z.string().max(512).optional(),
});

export type SignInInput = z.infer<typeof signInSchema>;

export const AUTH_ERROR_CODES = [
  "invalid_input",
  "invalid_credentials",
  "not_authorized",
  "rate_limited",
  "unavailable",
] as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];
