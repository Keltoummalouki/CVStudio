/**
 * HTTP security headers sent with every response (read by next.config.ts, so
 * this module has no imports).
 *
 * The Content-Security-Policy is the baseline the owner chose on 2026-10-22:
 * scripts, frames, plugins and form targets are limited to this site, and
 * images may also come from Supabase Storage (signed portrait URLs). Inline
 * scripts stay allowed because Next.js bootstraps pages with them; blocking
 * them needs per-request nonces, which would stop pages from being prerendered.
 */

export type SecurityHeaderOptions = {
  /** `next build`/`next start`; development also allows eval and HMR sockets. */
  isProduction: boolean;
  /** NEXT_PUBLIC_SUPABASE_URL: portraits are served from its origin. */
  supabaseUrl: string | undefined;
  /** VERCEL_ENV: preview deployments also load Vercel's comment toolbar. */
  vercelEnv: string | undefined;
};

export type SecurityHeader = { key: string; value: string };

const VERCEL_TOOLBAR = "https://vercel.live";

function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function contentSecurityPolicy({
  isProduction,
  supabaseUrl,
  vercelEnv,
}: SecurityHeaderOptions): string {
  const supabase = originOf(supabaseUrl);
  const toolbar = vercelEnv === "preview" ? [VERCEL_TOOLBAR] : [];

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      "'unsafe-inline'",
      ...(isProduction ? [] : ["'unsafe-eval'"]),
      ...toolbar,
    ],
    "style-src": ["'self'", "'unsafe-inline'", ...toolbar],
    "img-src": ["'self'", "data:", "blob:", ...(supabase ? [supabase] : []), ...toolbar],
    "font-src": ["'self'", ...toolbar],
    "connect-src": ["'self'", ...(isProduction ? [] : ["ws:"]), ...toolbar],
    "frame-src": toolbar.length > 0 ? toolbar : ["'none'"],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
  };

  return Object.entries(directives)
    .map(([directive, sources]) => `${directive} ${sources.join(" ")}`)
    .join("; ");
}

export function securityHeaders(options: SecurityHeaderOptions): SecurityHeader[] {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(options) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
    },
    { key: "X-Robots-Tag", value: "noindex, nofollow" },
    ...(options.isProduction
      ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
      : []),
  ];
}
