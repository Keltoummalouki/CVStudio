import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { securityHeaders } from "./src/config/security-headers";

const withNextIntl = createNextIntlPlugin({
  requestConfig: "./src/lib/i18n/request.ts",
  experimental: {
    // Generates a type declaration from the English dictionary so every
    // translation key used in code is checked at compile time.
    createMessagesDeclaration: "./messages/en.json",
  },
});

const headers = securityHeaders({
  isProduction: process.env.NODE_ENV === "production",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  vercelEnv: process.env.VERCEL_ENV,
});

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
  // The PDF engine reads files that the bundle tracer cannot see, so it must be
  // told: the serverless Chromium ships as compressed files read at runtime,
  // and playwright-core loads browsers.json through a path it builds at import
  // time (without it, every export fails with "Cannot find module").
  // Keys are picomatch globs over the route path, where "[cvId]" would be a
  // character class, hence "*". Packages read their files next to their real
  // location, which pnpm keeps under node_modules/.pnpm.
  // scripts/check-pdf-bundle.mjs runs the engine from the traced files in CI.
  outputFileTracingIncludes: {
    "/api/cvs/*/pdf": [
      "./node_modules/.pnpm/@sparticuz+chromium@*/node_modules/@sparticuz/chromium/bin/**",
      "./node_modules/.pnpm/playwright-core@*/node_modules/playwright-core/browsers.json",
    ],
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
    return [{ source: "/:path*", headers }];
  },
};

export default withNextIntl(nextConfig);
