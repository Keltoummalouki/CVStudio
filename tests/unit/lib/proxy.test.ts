import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  claims: null as Record<string, unknown> | null,
  refreshedCookies: [] as { name: string; value: string; options: Record<string, unknown> }[],
  createServerClient: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient.mockImplementation(
    (
      _url: string,
      _key: string,
      { cookies }: { cookies: { setAll: (cookies: unknown[], headers: object) => void } },
    ) => ({
      auth: {
        async getClaims() {
          // Simulates a token refresh writing new cookies, as @supabase/ssr does.
          if (mocks.refreshedCookies.length > 0) {
            cookies.setAll(mocks.refreshedCookies, { "Cache-Control": "private, no-store" });
          }
          return { data: mocks.claims ? { claims: mocks.claims } : null, error: null };
        },
      },
    }),
  ),
}));

const { default: proxy, config } = await import("@/proxy");
const { refreshSession } = await import("@/lib/supabase/proxy");

const request = (path: string) => new NextRequest(new URL(path, "https://cv.example.test"));

describe("proxy", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    mocks.claims = null;
    mocks.refreshedCookies = [];
    mocks.createServerClient.mockClear();
  });

  it("sends signed-out visitors of the dashboard to the localized login page", async () => {
    const response = await proxy(request("/fr/dashboard/cvs?view=ready"));

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/fr/login");
    expect(location.searchParams.get("next")).toBe("/dashboard/cvs?view=ready");
  });

  it("protects print pages like the dashboard", async () => {
    const response = await proxy(request("/en/print/00000000-0000-4000-8000-000000000001"));

    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/en/login");
  });

  it("lets signed-in visitors and public pages through to locale routing", async () => {
    mocks.claims = { sub: "owner" };
    const dashboard = await proxy(request("/en/dashboard"));
    expect(dashboard.headers.get("location")).toBeNull();

    mocks.claims = null;
    const login = await proxy(request("/en/login"));
    expect(login.headers.get("location")).toBeNull();
  });

  it("forwards refreshed session cookies and their no-store header", async () => {
    mocks.claims = { sub: "owner" };
    mocks.refreshedCookies = [
      { name: "sb-auth-token", value: "refreshed", options: { httpOnly: true, path: "/" } },
    ];

    const response = await proxy(request("/en/dashboard"));

    expect(response.cookies.get("sb-auth-token")?.value).toBe("refreshed");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("does nothing to responses before Supabase is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");

    const session = await refreshSession(request("/en/dashboard"));
    const response = NextResponse.next();

    expect(session.claims).toBeNull();
    expect(session.commit(response)).toBe(response);
    expect(mocks.createServerClient).not.toHaveBeenCalled();
  });

  it("never runs on API routes, Next internals or files", () => {
    const matcher = new RegExp(`^${config.matcher}$`);
    expect(matcher.test("/en/dashboard")).toBe(true);
    expect(matcher.test("/api/cvs/1/pdf")).toBe(false);
    expect(matcher.test("/_next/static/chunk.js")).toBe(false);
    expect(matcher.test("/favicon.ico")).toBe(false);
  });
});
