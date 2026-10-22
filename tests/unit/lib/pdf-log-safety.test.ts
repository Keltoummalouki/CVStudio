import { describe, expect, it } from "vitest";
import { redact } from "@/lib/pdf/redact";
import { sessionCookies } from "@/lib/supabase/session-cookies";

describe("redact", () => {
  it("removes tokens, session cookie values, query strings and record ids", () => {
    const text = [
      "token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl",
      "cookie base64-eyJhY2Nlc3NfdG9rZW4iOiJ4In0=",
      "url https://abc.supabase.co/storage/v1/object/sign/a.png?token=abc.def",
      "cv 5b0e8d5c-7a4e-4f61-9d0a-3c2b1a0f9e8d",
      "key sb_secret_0123456789abcdefghijklmnopqrstuvwxyz0123",
    ].join("\n");

    expect(redact(text)).toBe(
      [
        "token [token]",
        "cookie [cookie]",
        "url https://abc.supabase.co/storage/v1/object/sign/a.png?[query]",
        "cv :id",
        "key [redacted]",
      ].join("\n"),
    );
  });

  it("keeps file paths and code locations readable", () => {
    const frame =
      "    at Object.<anonymous> (/var/task/node_modules/.pnpm/playwright-core@1.64.1/node_modules/playwright-core/lib/coreBundle.js:35215:30)";

    expect(redact(frame)).toBe(frame);
  });
});

describe("sessionCookies", () => {
  it("keeps the Supabase session cookies, chunked or not, and nothing else", () => {
    const cookies = [
      { name: "sb-htvfrdpcastjvsaugvnv-auth-token" },
      { name: "sb-127-auth-token.0" },
      { name: "sb-127-auth-token.1" },
      { name: "sb-127-auth-token-code-verifier" },
      { name: "__cf_bm" },
      { name: "NEXT_LOCALE" },
    ];

    expect(sessionCookies(cookies).map((cookie) => cookie.name)).toEqual([
      "sb-htvfrdpcastjvsaugvnv-auth-token",
      "sb-127-auth-token.0",
      "sb-127-auth-token.1",
    ]);
  });
});
