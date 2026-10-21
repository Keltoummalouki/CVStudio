import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin({
  requestConfig: "./src/lib/i18n/request.ts",
  experimental: {
    // Generates a type declaration from the English dictionary so every
    // translation key used in code is checked at compile time.
    createMessagesDeclaration: "./messages/en.json",
  },
});

const isProduction = process.env.NODE_ENV === "production";

// Baseline hardening for a private app. A nonce-based Content-Security-Policy
// is deferred to the hardening phase because nonces force every route to render
// dynamically, which would disable the prerendered shell.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  ...(isProduction
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  devIndicators: { position: "bottom-right" },
  experimental: {
    serverActions: {
      // Profile photos are capped at 5 MiB; leave room for multipart overhead.
      bodySizeLimit: "6mb",
    },
  },
  // The serverless Chromium used for PDF export ships as compressed files that
  // are read at runtime, not imported, so the bundle tracer must be told.
  outputFileTracingIncludes: {
    "/api/cvs/[cvId]/pdf": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
  turbopack: {
    rules: {
      "*.css": {
        // Only global stylesheets need Tailwind. CSS Modules (the CV renderer's
        // isolated styles) must keep their own module type and scoped names.
        condition: { not: { path: /\.module\.css$/ } },
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
