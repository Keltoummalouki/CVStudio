import { describe, expect, it } from "vitest";
import { mapSignInError } from "@/features/auth/errors";
import { credentialsSchema, signInSchema } from "@/features/auth/schema";

describe("mapSignInError", () => {
  it("uses one message for unknown users, wrong passwords and unconfirmed emails", () => {
    expect(mapSignInError({ status: 400, code: "invalid_credentials" })).toBe(
      "invalid_credentials",
    );
    expect(mapSignInError({ status: 400, code: "email_not_confirmed" })).toBe(
      "invalid_credentials",
    );
    expect(mapSignInError({ status: 400, code: "user_not_found" })).toBe("invalid_credentials");
  });

  it("recognizes rate limiting", () => {
    expect(mapSignInError({ status: 429, code: "over_request_rate_limit" })).toBe("rate_limited");
  });

  it("treats anything else as temporarily unavailable", () => {
    expect(mapSignInError({ status: 500 })).toBe("unavailable");
    expect(mapSignInError({ name: "AuthRetryableFetchError" })).toBe("unavailable");
    expect(mapSignInError(null)).toBe("unavailable");
  });
});

describe("credential schemas", () => {
  it("trims the email and reports message keys, not prose", () => {
    expect(credentialsSchema.parse({ email: "  owner@example.com ", password: "x" }).email).toBe(
      "owner@example.com",
    );
    const empty = credentialsSchema.safeParse({ email: "", password: "" });
    expect(empty.success).toBe(false);
    expect(empty.error?.issues.map((issue) => issue.message)).toEqual(["required", "required"]);

    const invalid = credentialsSchema.safeParse({ email: "nope", password: "x" });
    expect(invalid.error?.issues[0]?.message).toBe("invalidEmail");
  });

  it("only accepts supported locales on the server", () => {
    const base = { email: "owner@example.com", password: "x" };
    expect(signInSchema.safeParse({ ...base, locale: "fr" }).success).toBe(true);
    expect(signInSchema.safeParse({ ...base, locale: "de" }).success).toBe(false);
  });
});
