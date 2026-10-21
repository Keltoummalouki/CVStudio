import { describe, expect, it } from "vitest";
import {
  ConfigurationError,
  getSupabasePublicConfig,
  isSupabaseConfigured,
} from "@/lib/env/public";
import { getAppTimeZone, isValidTimeZone } from "@/lib/env/time-zone";

const VALID = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_key",
};

function jwtWithRole(role: string): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ role, iss: "supabase" })}.signature`;
}

describe("getSupabasePublicConfig", () => {
  it("returns the validated URL and publishable key", () => {
    expect(getSupabasePublicConfig(VALID)).toEqual({
      url: VALID.NEXT_PUBLIC_SUPABASE_URL,
      publishableKey: VALID.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    });
  });

  it("names missing variables without echoing any values", () => {
    const attempt = () =>
      getSupabasePublicConfig({
        NEXT_PUBLIC_SUPABASE_URL: undefined,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined,
      });
    expect(attempt).toThrow(ConfigurationError);
    try {
      attempt();
    } catch (error) {
      expect((error as ConfigurationError).variables).toEqual([
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      ]);
    }
  });

  it("rejects a URL that is not http(s)", () => {
    expect(() =>
      getSupabasePublicConfig({ ...VALID, NEXT_PUBLIC_SUPABASE_URL: "javascript:alert(1)" }),
    ).toThrow(ConfigurationError);
  });

  it("refuses a secret key so it can never be bundled for the browser", () => {
    const secret = "sb_secret_do_not_ship";
    try {
      getSupabasePublicConfig({ ...VALID, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: secret });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationError);
      expect((error as Error).message).not.toContain(secret);
    }
  });

  it("refuses a legacy service_role JWT but accepts an anon JWT", () => {
    expect(() =>
      getSupabasePublicConfig({
        ...VALID,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: jwtWithRole("service_role"),
      }),
    ).toThrow(ConfigurationError);
    expect(
      isSupabaseConfigured({ ...VALID, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: jwtWithRole("anon") }),
    ).toBe(true);
  });
});

describe("app time zone", () => {
  it("defaults to UTC when unset", () => {
    expect(getAppTimeZone(undefined)).toBe("UTC");
    expect(getAppTimeZone("  ")).toBe("UTC");
  });

  it("accepts IANA identifiers and rejects unknown ones", () => {
    expect(isValidTimeZone("Europe/Paris")).toBe(true);
    expect(getAppTimeZone("Europe/Paris")).toBe("Europe/Paris");
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(() => getAppTimeZone("Mars/Olympus")).toThrow(/APP_TIME_ZONE/);
  });
});
