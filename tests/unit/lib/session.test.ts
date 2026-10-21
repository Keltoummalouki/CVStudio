import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createFakeSupabase,
  isOwnerScoped,
  OWNER_ID,
  type FakeSupabase,
} from "../../utils/fake-supabase";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  redirect: vi.fn((target: unknown): never => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { target });
  }),
}));

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createClient }));
vi.mock("@/lib/i18n/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next-intl/server", () => ({ getLocale: async () => "fr" }));
vi.mock("next/server", () => ({ connection: async () => undefined }));

const { AccessCheckError, getOwnerContext, getSessionState, requireOwner } =
  await import("@/lib/auth/session");

/** No argument: signed out. Otherwise signed in, and allowlisted or not (or the check fails). */
function setup(allowlisted?: boolean | "error"): FakeSupabase {
  const fake = createFakeSupabase({
    tables: {
      app_owners:
        allowlisted === "error"
          ? { data: null, error: { code: "08006" } }
          : { data: allowlisted ? { user_id: OWNER_ID } : null },
    },
  });
  if (allowlisted !== undefined) {
    fake.client.auth.getClaims.mockResolvedValue({
      data: { claims: { sub: OWNER_ID, email: "owner@example.test" } },
      error: null,
    });
  }
  mocks.createClient.mockResolvedValue(fake.supabase);
  return fake;
}

describe("owner session", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.redirect.mockClear();
  });

  it("treats a missing or invalid token as anonymous without reading the allowlist", async () => {
    const fake = setup();
    fake.client.auth.getClaims.mockResolvedValue({ data: null, error: { name: "AuthApiError" } });

    expect(await getSessionState()).toEqual({ status: "anonymous" });
    expect(await getOwnerContext()).toBeNull();
    expect(fake.queries).toHaveLength(0);
  });

  it("recognizes an allowlisted owner from the verified claims", async () => {
    const fake = setup(true);

    expect(await getSessionState()).toEqual({
      status: "owner",
      owner: { id: OWNER_ID, email: "owner@example.test" },
    });
    const allowlist = fake.queriesOn("app_owners")[0];
    expect(allowlist?.calls).toContainEqual({ method: "eq", args: ["user_id", OWNER_ID] });
    expect(isOwnerScoped(allowlist)).toBe(false);
  });

  it("refuses a signed-in account that is not on the allowlist", async () => {
    setup(false);

    expect(await getSessionState()).toEqual({ status: "not_owner", email: "owner@example.test" });
    expect(await getOwnerContext()).toBeNull();
  });

  it("fails closed when the allowlist cannot be read", async () => {
    setup("error");

    await expect(getSessionState()).rejects.toBeInstanceOf(AccessCheckError);
    await expect(getOwnerContext()).rejects.toThrow("Workspace access could not be verified.");
  });

  it("returns the owner context to server components", async () => {
    const fake = setup(true);

    const context = await requireOwner("en");
    expect(context.owner.id).toBe(OWNER_ID);
    expect(context.supabase).toBe(fake.supabase);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("sends anonymous visitors to the login page in the current locale", async () => {
    const fake = setup();
    fake.client.auth.getClaims.mockResolvedValue({ data: { claims: {} }, error: null });

    await expect(requireOwner()).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith({ href: "/login", locale: "fr" });
  });

  it("tells non-owners why they are back on the login page", async () => {
    setup(false);

    await expect(requireOwner("en")).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith({
      href: { pathname: "/login", query: { reason: "not_authorized" } },
      locale: "en",
    });
  });
});
