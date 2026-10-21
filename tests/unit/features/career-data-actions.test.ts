import { beforeEach, describe, expect, it, vi } from "vitest";
import { NEW_EXPERIENCE } from "@/features/career-data/defaults";
import { MAX_PHOTO_BYTES } from "@/features/career-data/constants";
import {
  callsOf,
  createFakeSupabase,
  isOwnerScoped,
  ownerContext,
  OWNER_ID,
  type FakeSupabaseOptions,
} from "../../utils/fake-supabase";

const mocks = vi.hoisted(() => ({
  getOwnerContext: vi.fn(),
  refresh: vi.fn(),
  editors: {
    getProfileEditor: vi.fn(async () => ({ values: { fullName: "Reloaded" }, photo: null })),
    getExperienceEditor: vi.fn(async (id: string) => ({ id, organization: "Reloaded" })),
    getProjectEditor: vi.fn(async (id: string) => ({ id })),
    getEducationEditor: vi.fn(async (id: string) => ({ id })),
    getCertificationEditor: vi.fn(async (id: string) => ({ id })),
    getCustomSectionEditor: vi.fn(async (id: string) => ({ id })),
    getSoftSkillsEditor: vi.fn(async () => ({ items: [] })),
    getSpokenLanguagesEditor: vi.fn(async () => ({ items: [] })),
    getSkillGroupsEditor: vi.fn(async () => ({ groups: [] })),
  },
}));

vi.mock("@/lib/auth/session", () => ({ getOwnerContext: mocks.getOwnerContext }));
vi.mock("next/cache", () => ({ refresh: mocks.refresh }));
vi.mock("@/features/career-data/server/queries", () => mocks.editors);

const actions = await import("@/features/career-data/server/actions");

const RECORD_ID = "7b8c9d0e-1f2a-4b3c-8d4e-5f6a7b8c9d0e";
const SAVED = { id: RECORD_ID, updatedAt: "2026-10-21T10:00:00Z" };
const EXPERIENCE = { ...NEW_EXPERIENCE, organization: " Acme ", role: { en: "Developer" } };

function signIn(options: FakeSupabaseOptions = {}) {
  const fake = createFakeSupabase(options);
  mocks.getOwnerContext.mockResolvedValue(ownerContext(fake));
  return fake;
}

beforeEach(() => {
  mocks.getOwnerContext.mockReset();
  mocks.refresh.mockReset();
});

describe("career data actions require the owner", () => {
  it.each([
    ["saveProfile", () => actions.saveProfile({})],
    ["saveExperience", () => actions.saveExperience(EXPERIENCE)],
    ["reorderRecords", () => actions.reorderRecords("experience", [])],
    ["setRecordArchived", () => actions.setRecordArchived("experience", RECORD_ID, true)],
    ["deleteArchivedRecord", () => actions.deleteArchivedRecord("experience", RECORD_ID)],
    ["getRecordReferences", () => actions.getRecordReferences(RECORD_ID)],
    ["uploadProfilePhoto", () => actions.uploadProfilePhoto(new FormData())],
    ["removeProfilePhoto", () => actions.removeProfilePhoto()],
  ])("%s answers unauthorized without a session", async (_name, action) => {
    mocks.getOwnerContext.mockResolvedValue(null);

    expect(await action()).toEqual({ ok: false, error: "unauthorized" });
  });
});

describe("record saves", () => {
  it("validates, saves through one database function, then returns the stored values", async () => {
    const fake = signIn({ rpc: { save_experience: { data: SAVED } } });

    expect(await actions.saveExperience(EXPERIENCE)).toEqual({
      ok: true,
      data: { id: RECORD_ID, organization: "Reloaded" },
    });
    expect(fake.client.rpc).toHaveBeenCalledWith("save_experience", {
      payload: expect.objectContaining({ organization: "Acme", role_i18n: { en: "Developer" } }),
    });
    expect(mocks.editors.getExperienceEditor).toHaveBeenCalledWith(RECORD_ID);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("never sends an owner id: the database takes it from the session", async () => {
    const fake = signIn({ rpc: { save_experience: { data: SAVED } } });

    await actions.saveExperience({ ...EXPERIENCE, owner_id: "someone-else" });
    expect(JSON.stringify(fake.client.rpc.mock.calls)).not.toContain("owner_id");
  });

  it("returns field issues without calling the database", async () => {
    const fake = signIn();

    const result = await actions.saveExperience({ ...EXPERIENCE, role: {} });
    expect(result).toEqual({
      ok: false,
      error: "invalid_input",
      fieldIssues: [{ path: "role", message: "requiredOneLanguage" }],
    });
    expect(fake.client.rpc).not.toHaveBeenCalled();
  });

  it("maps a concurrent edit to stale", async () => {
    signIn({ rpc: { save_experience: { error: { message: "stale_record" } } } });

    expect(await actions.saveExperience(EXPERIENCE)).toEqual({ ok: false, error: "stale" });
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it.each([
    [
      "saveProfile",
      "save_profile",
      () =>
        actions.saveProfile({
          expectedUpdatedAt: null,
          fullName: "Alex",
          title: {},
          summary: {},
          location: {},
          email: "",
          phone: "",
          links: [],
        }),
    ],
    [
      "saveProject",
      "save_project",
      () =>
        actions.saveProject({
          id: null,
          expectedUpdatedAt: null,
          title: { en: "App" },
          description: {},
          projectUrl: "",
          sourceUrl: "",
          period: NEW_EXPERIENCE.period,
          details: [],
        }),
    ],
    [
      "saveEducation",
      "save_education",
      () =>
        actions.saveEducation({
          id: null,
          expectedUpdatedAt: null,
          credential: { en: "BSc" },
          institution: {},
          location: {},
          description: {},
          period: NEW_EXPERIENCE.period,
        }),
    ],
    [
      "saveCertification",
      "save_certification",
      () =>
        actions.saveCertification({
          id: null,
          expectedUpdatedAt: null,
          title: { en: "Cert" },
          issuer: {},
          issuedYear: 2025,
          issuedMonth: null,
          credentialUrl: "",
        }),
    ],
    [
      "saveCustomSection",
      "save_custom_section",
      () =>
        actions.saveCustomSection({
          id: null,
          expectedUpdatedAt: null,
          title: { en: "Volunteering" },
          subsections: [{ id: null, title: {}, items: [] }],
        }),
    ],
    [
      "saveSoftSkills",
      "save_soft_skills",
      () => actions.saveSoftSkills({ expectedStamp: null, items: [] }),
    ],
    [
      "saveSpokenLanguages",
      "save_spoken_languages",
      () => actions.saveSpokenLanguages({ expectedStamp: null, items: [] }),
    ],
    [
      "saveSkillGroups",
      "save_skill_groups",
      () => actions.saveSkillGroups({ expectedStamp: null, groups: [] }),
    ],
  ])("%s writes through %s", async (_name, fn, save) => {
    const fake = signIn({ rpc: { [fn]: { data: SAVED } } });

    expect(await save()).toMatchObject({ ok: true });
    expect(fake.client.rpc).toHaveBeenCalledWith(fn, { payload: expect.any(Object) });
  });
});

describe("reorder, archive and delete", () => {
  it("reorders a record kind through its table", async () => {
    const fake = signIn();

    expect(await actions.reorderRecords("certifications", [RECORD_ID])).toEqual({
      ok: true,
      data: undefined,
    });
    expect(fake.client.rpc).toHaveBeenCalledWith("reorder_records", {
      target: "certifications",
      ids: [RECORD_ID],
    });
  });

  it("refuses unknown kinds and ids, so no other table can be targeted", async () => {
    const fake = signIn();

    expect(await actions.reorderRecords("app_owners", [RECORD_ID])).toEqual({
      ok: false,
      error: "invalid_input",
    });
    expect(await actions.reorderRecords("experience", ["1; drop table x"])).toEqual({
      ok: false,
      error: "invalid_input",
    });
    expect(await actions.setRecordArchived("profiles", RECORD_ID, true)).toEqual({
      ok: false,
      error: "invalid_input",
    });
    expect(await actions.setRecordArchived("experience", RECORD_ID, "yes")).toEqual({
      ok: false,
      error: "invalid_input",
    });
    expect(fake.client.rpc).not.toHaveBeenCalled();
    expect(fake.queries).toHaveLength(0);
  });

  it("archives and restores the owner's record", async () => {
    const fake = signIn({ tables: { projects: { data: [{ id: RECORD_ID }] } } });

    expect(await actions.setRecordArchived("projects", RECORD_ID, true)).toMatchObject({
      ok: true,
    });
    expect(await actions.setRecordArchived("projects", RECORD_ID, false)).toMatchObject({
      ok: true,
    });

    const [archive, restore] = fake.queriesOn("projects");
    expect(isOwnerScoped(archive)).toBe(true);
    expect(callsOf(archive, "update")[0]?.[0]).toEqual({ deleted_at: expect.any(String) });
    expect(callsOf(restore, "update")[0]?.[0]).toEqual({ deleted_at: null });
  });

  it("permanently deletes only records that were archived first", async () => {
    const fake = signIn({ tables: { custom_sections: { data: [{ id: RECORD_ID }] } } });

    expect(await actions.deleteArchivedRecord("custom", RECORD_ID)).toMatchObject({ ok: true });
    const query = fake.queriesOn("custom_sections")[0];
    expect(callsOf(query, "delete")).toHaveLength(1);
    expect(isOwnerScoped(query)).toBe(true);
    expect(callsOf(query, "not")).toContainEqual(["deleted_at", "is", null]);
  });

  it("reports records that matched nothing as not found", async () => {
    signIn({ tables: { experiences: { data: [] } } });

    expect(await actions.setRecordArchived("experience", RECORD_ID, true)).toEqual({
      ok: false,
      error: "not_found",
    });
    expect(await actions.deleteArchivedRecord("experience", RECORD_ID)).toEqual({
      ok: false,
      error: "not_found",
    });
  });

  it("counts the CVs and templates that use a record before deletion", async () => {
    const fake = signIn({
      rpc: { count_record_references: { data: { documents: 2, templates: 1 } } },
    });

    expect(await actions.getRecordReferences(RECORD_ID)).toEqual({
      ok: true,
      data: { documents: 2, templates: 1 },
    });
    expect(fake.client.rpc).toHaveBeenCalledWith("count_record_references", {
      record_id: RECORD_ID,
    });
    expect(await actions.getRecordReferences("nope")).toEqual({
      ok: false,
      error: "invalid_input",
    });
  });
});

describe("profile photo", () => {
  const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13];
  const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 16];
  const WEBP = [
    ...new TextEncoder().encode("RIFF"),
    0,
    0,
    0,
    0,
    ...new TextEncoder().encode("WEBP"),
  ];

  function photo(bytes: number[] | Uint8Array, type = "image/png") {
    const form = new FormData();
    form.set("photo", new File([new Uint8Array(bytes)], "portrait", { type }));
    return form;
  }

  it.each([
    ["PNG", PNG, "png", "image/png"],
    ["JPEG", JPEG, "jpg", "image/jpeg"],
    ["WebP", WEBP, "webp", "image/webp"],
  ])("stores a %s under the owner's folder by its real type", async (_, bytes, extension, type) => {
    const fake = signIn({ tables: { profiles: [{ data: { photo_path: null } }, { data: null }] } });

    const result = await actions.uploadProfilePhoto(photo(bytes, "application/octet-stream"));

    const [path, , options] = fake.bucket.upload.mock.calls[0] ?? [];
    expect(path).toMatch(new RegExp(`^${OWNER_ID}/portraits/[0-9a-f-]{36}\\.${extension}$`));
    expect(options).toEqual({ contentType: type, upsert: false });
    expect(fake.client.storage.from).toHaveBeenCalledWith("cvstudio-assets");
    expect(result).toEqual({ ok: true, data: { url: `https://storage.test/signed/${path}` } });
  });

  it("identifies files by their bytes, not the declared type", async () => {
    const fake = signIn();

    expect(
      await actions.uploadProfilePhoto(
        photo(new TextEncoder().encode("<svg onload=x>"), "image/png"),
      ),
    ).toEqual({ ok: false, error: "unsupported_type" });
    expect(fake.bucket.upload).not.toHaveBeenCalled();
  });

  it("refuses missing, empty and oversized files", async () => {
    const fake = signIn();

    expect(await actions.uploadProfilePhoto(new FormData())).toEqual({
      ok: false,
      error: "invalid_input",
    });
    expect(await actions.uploadProfilePhoto(photo([]))).toEqual({
      ok: false,
      error: "invalid_input",
    });
    const tooLarge = new Uint8Array(MAX_PHOTO_BYTES + 1);
    tooLarge.set(PNG);
    expect(await actions.uploadProfilePhoto(photo(tooLarge))).toEqual({
      ok: false,
      error: "too_large",
    });
    expect(fake.bucket.upload).not.toHaveBeenCalled();
  });

  it("replaces the previous portrait once the new one is saved", async () => {
    const fake = signIn({
      tables: {
        profiles: [{ data: { photo_path: `${OWNER_ID}/portraits/old.png` } }, { data: null }],
      },
    });

    await actions.uploadProfilePhoto(photo(PNG));

    expect(fake.bucket.remove).toHaveBeenCalledWith([`${OWNER_ID}/portraits/old.png`]);
    expect(isOwnerScoped(fake.queriesOn("profiles")[1])).toBe(true);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("removes the uploaded file again when the profile cannot be updated", async () => {
    const fake = signIn({
      tables: { profiles: [{ data: { photo_path: null } }, { error: { code: "08006" } }] },
    });

    expect(await actions.uploadProfilePhoto(photo(PNG))).toEqual({
      ok: false,
      error: "unavailable",
    });
    const uploaded = fake.bucket.upload.mock.calls[0]?.[0];
    expect(fake.bucket.remove).toHaveBeenCalledWith([uploaded]);
  });

  it("reports a failed upload without touching the profile", async () => {
    const fake = signIn();
    fake.bucket.upload.mockResolvedValueOnce({ data: null, error: { message: "quota" } });

    expect(await actions.uploadProfilePhoto(photo(PNG))).toEqual({
      ok: false,
      error: "unavailable",
    });
    expect(fake.queriesOn("profiles")).toHaveLength(0);
  });

  it("removes the portrait from the profile and from storage", async () => {
    const fake = signIn({
      tables: {
        profiles: [{ data: { photo_path: `${OWNER_ID}/portraits/a.png` } }, { data: null }],
      },
    });

    expect(await actions.removeProfilePhoto()).toEqual({ ok: true, data: undefined });
    expect(callsOf(fake.queriesOn("profiles")[1], "update")[0]).toEqual([{ photo_path: null }]);
    expect(fake.bucket.remove).toHaveBeenCalledWith([`${OWNER_ID}/portraits/a.png`]);
  });

  it("keeps the stored file when the profile update fails", async () => {
    const fake = signIn({
      tables: { profiles: [{ data: { photo_path: "p.png" } }, { error: { code: "08006" } }] },
    });

    expect(await actions.removeProfilePhoto()).toEqual({ ok: false, error: "unavailable" });
    expect(fake.bucket.remove).not.toHaveBeenCalled();
  });
});
