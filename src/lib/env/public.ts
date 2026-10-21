import { z } from "zod";

/**
 * Public (browser-safe) configuration.
 *
 * Each variable is read with a literal `process.env.NEXT_PUBLIC_*` expression
 * because Next.js only inlines public variables referenced that way.
 * Validation is lazy so the app can boot (and render setup guidance) before
 * Supabase credentials exist.
 */

export class ConfigurationError extends Error {
  readonly variables: readonly string[];

  constructor(message: string, variables: readonly string[]) {
    super(message);
    this.name = "ConfigurationError";
    this.variables = variables;
  }
}

const SECRET_KEY_PREFIX = "sb_secret_";

/** Legacy Supabase keys are JWTs; a `service_role` JWT must never reach the browser. */
function isServiceRoleJwt(key: string): boolean {
  const payload = key.split(".")[1];
  if (!payload) return false;
  try {
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const claims: unknown = JSON.parse(json);
    return (
      typeof claims === "object" &&
      claims !== null &&
      "role" in claims &&
      claims.role === "service_role"
    );
  } catch {
    return false;
  }
}

const publishableKeySchema = z
  .string()
  .trim()
  .min(1)
  .refine((key) => !key.startsWith(SECRET_KEY_PREFIX) && !isServiceRoleJwt(key), {
    message: "must be a publishable key, never a secret or service_role key",
  });

const supabasePublicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ protocol: /^https?$/ }),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKeySchema,
});

export type SupabasePublicConfig = {
  url: string;
  publishableKey: string;
};

type SupabasePublicSource = Record<keyof z.input<typeof supabasePublicSchema>, string | undefined>;

function readSupabaseSource(): SupabasePublicSource {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

/**
 * Returns validated Supabase connection settings or throws a
 * {@link ConfigurationError} naming the offending variables. Values are never
 * included in the error so keys cannot leak into logs.
 */
export function getSupabasePublicConfig(
  source: SupabasePublicSource = readSupabaseSource(),
): SupabasePublicConfig {
  const result = supabasePublicSchema.safeParse(source);

  if (!result.success) {
    const variables = [...new Set(result.error.issues.map((issue) => String(issue.path[0])))];
    const details = result.error.issues
      .map((issue) => `${String(issue.path[0])} ${issue.message}`)
      .join("; ");
    throw new ConfigurationError(`Invalid Supabase configuration: ${details}`, variables);
  }

  return {
    url: result.data.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: result.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

export function isSupabaseConfigured(source: SupabasePublicSource = readSupabaseSource()): boolean {
  return supabasePublicSchema.safeParse(source).success;
}
