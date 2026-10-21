import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase, type FakeSupabase } from "../../utils/fake-supabase";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  redirect: vi.fn((target: unknown): never => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { target });
  }),
}));

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createClient }));
vi.mock("@/lib/i18n/navigation", () => ({ redirect: mocks.redirect }));

const { signIn, signOut } = await import("@/features/auth/actions");

const USER_ID = "8c1d1f3e-2a4b-4c5d-8e6f-7a8b9c0d1e2f";
const CREDENTIALS = { email: "owner@example.test", password: "correct horse", locale: "en" };

function setup(allowlist: { data?: unknown; error?: unknown } = { data: { user_id: USER_ID } }) {
  const fake = createFakeSupabase({ tables: { app_owners: allowlist } });
  fake.client.auth.signInWithPassword.mockResolvedValue({
    data: { user: { id: USER_ID } },
    error: null,
  });
  mocks.createClient.mockResolvedValue(fake.supabase);
  return fake;
}

const redirectTarget = () => mocks.redirect.mock.calls[0]?.[0];

describe("signIn", () => {
  let fake: FakeSupabase;

  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.redirect.mockClear();
    fake = setup();
  });

  it("rejects malformed input before contacting Supabase", async () => {
    expect(await signIn({ ...CREDENTIALS, email: "not-an-email" })).toEqual({
      ok: false,
      error: "invalid_input",
    });
    expect(await signIn({ ...CREDENTIALS, locale: "de" })).toEqual({
      ok: false,
      error: "invalid_input",
    });
    expect(await signIn(null)).toEqual({ ok: false, error: "invalid_input" });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("uses one message for wrong passwords and unknown accounts", async () => {
    fake.client.auth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { status: 400, code: "invalid_credentials" },
    });

    expect(await signIn(CREDENTIALS)).toEqual({ ok: false, error: "invalid_credentials" });
    expect(fake.queriesOn("app_owners")).toHaveLength(0);
  });

  it("redirects an allowlisted owner to the dashboard", async () => {
    await expect(signIn(CREDENTIALS)).rejects.toThrow("NEXT_REDIRECT");

    expect(fake.client.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "owner@example.test",
      password: "correct horse",
    });
    expect(redirectTarget()).toEqual({ href: "/dashboard", locale: "en" });
  });

  it("keeps a requested dashboard page but never an external one", async () => {
    await expect(
      signIn({ ...CREDENTIALS, locale: "fr", next: "/dashboard/cvs?tab=ready" }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectTarget()).toEqual({ href: "/dashboard/cvs?tab=ready", locale: "fr" });

    mocks.redirect.mockClear();
    await expect(signIn({ ...CREDENTIALS, next: "//evil.example/dashboard" })).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(redirectTarget()).toEqual({ href: "/dashboard", locale: "en" });
  });

  it("signs a valid account that is not allowlisted straight back out", async () => {
    fake = setup({ data: null });

    expect(await signIn(CREDENTIALS)).toEqual({ ok: false, error: "not_authorized" });
    expect(fake.client.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("fails closed when the allowlist cannot be read", async () => {
    fake = setup({ data: null, error: { code: "08006" } });

    expect(await signIn(CREDENTIALS)).toEqual({ ok: false, error: "unavailable" });
    expect(fake.client.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});

describe("signOut", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.redirect.mockClear();
  });

  it("ends this browser's session only and confirms on the login page", async () => {
    const fake = setup();

    await expect(signOut("fr")).rejects.toThrow("NEXT_REDIRECT");
    expect(fake.client.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(redirectTarget()).toEqual({
      href: { pathname: "/login", query: { reason: "signed_out" } },
      locale: "fr",
    });
  });

  it("falls back to the default locale for an unknown one", async () => {
    setup();

    await expect(signOut("xx")).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectTarget()).toMatchObject({ locale: "en" });
  });
});
