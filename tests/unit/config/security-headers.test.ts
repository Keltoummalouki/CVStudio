import { describe, expect, it } from "vitest";
import {
  contentSecurityPolicy,
  securityHeaders,
  type SecurityHeaderOptions,
} from "@/config/security-headers";

const PRODUCTION: SecurityHeaderOptions = {
  isProduction: true,
  supabaseUrl: "https://abcdefgh.supabase.co",
  vercelEnv: "production",
};

/** The policy as directive → sources. */
function directives(options: SecurityHeaderOptions) {
  return Object.fromEntries(
    contentSecurityPolicy(options)
      .split("; ")
      .map((directive) => {
        const [name = "", ...sources] = directive.split(" ");
        return [name, sources];
      }),
  );
}

describe("Content-Security-Policy", () => {
  it("limits scripts, connections and fonts to this site in production", () => {
    const policy = directives(PRODUCTION);

    expect(policy["default-src"]).toEqual(["'self'"]);
    expect(policy["script-src"]).toEqual(["'self'", "'unsafe-inline'"]);
    expect(policy["connect-src"]).toEqual(["'self'"]);
    expect(policy["font-src"]).toEqual(["'self'"]);
  });

  it("allows portraits from the Supabase project only", () => {
    expect(directives(PRODUCTION)["img-src"]).toEqual([
      "'self'",
      "data:",
      "blob:",
      "https://abcdefgh.supabase.co",
    ]);
    expect(directives({ ...PRODUCTION, supabaseUrl: "not a url" })["img-src"]).toEqual([
      "'self'",
      "data:",
      "blob:",
    ]);
  });

  it("blocks framing, plugins, base hijacking and forms posting elsewhere", () => {
    const policy = directives(PRODUCTION);

    expect(policy["frame-ancestors"]).toEqual(["'none'"]);
    expect(policy["frame-src"]).toEqual(["'none'"]);
    expect(policy["object-src"]).toEqual(["'none'"]);
    expect(policy["base-uri"]).toEqual(["'self'"]);
    expect(policy["form-action"]).toEqual(["'self'"]);
  });

  it("allows eval and hot-reload sockets in development only", () => {
    const development = directives({ ...PRODUCTION, isProduction: false });

    expect(development["script-src"]).toContain("'unsafe-eval'");
    expect(development["connect-src"]).toContain("ws:");
    expect(directives(PRODUCTION)["script-src"]).not.toContain("'unsafe-eval'");
  });

  it("lets Vercel's comment toolbar load on preview deployments, never in production", () => {
    const preview = directives({ ...PRODUCTION, vercelEnv: "preview" });

    expect(preview["script-src"]).toContain("https://vercel.live");
    expect(preview["frame-src"]).toEqual(["https://vercel.live"]);
    expect(contentSecurityPolicy(PRODUCTION)).not.toContain("vercel.live");
  });
});

describe("securityHeaders", () => {
  it("sends the policy with the other hardening headers", () => {
    const keys = securityHeaders(PRODUCTION).map((header) => header.key);

    expect(keys).toEqual([
      "Content-Security-Policy",
      "X-Content-Type-Options",
      "X-Frame-Options",
      "Referrer-Policy",
      "Permissions-Policy",
      "X-Robots-Tag",
      "Strict-Transport-Security",
    ]);
  });

  it("only pins HTTPS (HSTS) for production builds", () => {
    const development = securityHeaders({ ...PRODUCTION, isProduction: false });

    expect(development.map((header) => header.key)).not.toContain("Strict-Transport-Security");
  });
});
