import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultDefinition } from "@/features/cv-builder/defaults";
import type { CvDocument } from "@/features/cv-documents/server/queries";
import type * as Navigation from "@/lib/i18n/navigation";
import { buildMasterData, LABELS, sequentialIds } from "../../fixtures/master-data";
import { renderWithIntl } from "../../utils/render";

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn(), refresh: vi.fn() },
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
  saveCv: vi.fn(),
  getCvRevision: vi.fn(),
  duplicateCv: vi.fn(),
  deleteCv: vi.fn(),
  restoreCv: vi.fn(),
}));

vi.mock("@/lib/i18n/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof Navigation>()),
  useRouter: () => mocks.router,
}));
vi.mock("sonner", () => ({ toast: mocks.toast }));
vi.mock("@/features/cv-renderer/fonts", () => ({ poppins: { className: "font-poppins" } }));
vi.mock("@/features/cv-documents/server/actions", () => ({
  saveCv: mocks.saveCv,
  getCvRevision: mocks.getCvRevision,
  duplicateCv: mocks.duplicateCv,
  deleteCv: mocks.deleteCv,
  restoreCv: mocks.restoreCv,
}));
vi.mock("@/features/cv-templates/server/actions", () => ({
  getTemplateChoices: vi.fn(async () => ({ ok: true, data: [] })),
  saveCvAsTemplate: vi.fn(),
}));

const { CvBuilder } = await import("@/features/cv-builder/components/cv-builder");

const CV_ID = "3e9f6c1a-5b7d-4e2f-8a1c-9d0b2e4f6a8c";
const master = buildMasterData();
const PHOTO_URL = "https://storage.test/signed/portrait.png";

function cvDocument(overrides: Partial<CvDocument> = {}): CvDocument {
  return {
    id: CV_ID,
    name: "Frontend CV",
    locale: "en",
    revision: 1,
    updatedAt: "2026-10-21T09:00:00Z",
    createdFromTemplateName: null,
    definition: createDefaultDefinition(master, sequentialIds()),
    ...overrides,
  };
}

function renderBuilder(document = cvDocument()) {
  const user = userEvent.setup();
  renderWithIntl(
    <CvBuilder document={document} master={master} labels={LABELS} photoUrl={PHOTO_URL} />,
  );
  return { user };
}

const outline = () => within(screen.getByRole("navigation", { name: "CV structure" }));
const preview = () => within(screen.getByRole("complementary", { name: "Preview" }));
const previewSections = () =>
  Array.from(
    screen.getByRole("region", { name: "CV preview canvas" }).querySelectorAll("section"),
    (section) => section.dataset.sectionKind,
  );

beforeEach(() => {
  for (const mock of [mocks.saveCv, mocks.getCvRevision, mocks.duplicateCv, mocks.deleteCv]) {
    mock.mockReset();
  }
  mocks.router.push.mockReset();
  mocks.toast.error.mockReset();
  mocks.toast.success.mockReset();
  let revision = 1;
  mocks.saveCv.mockImplementation(async () => ({
    ok: true,
    data: { revision: ++revision, updatedAt: "2026-10-21T10:00:00Z" },
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CV builder", () => {
  it("opens on the header with the outline, the live preview and a clean save state", () => {
    renderBuilder();

    expect(screen.getByRole("textbox", { name: "CV name" })).toHaveValue("Frontend CV");
    expect(screen.getByRole("radio", { name: "English" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("heading", { level: 2, name: "Header & contact" })).toBeInTheDocument();
    expect(outline().getByRole("button", { name: /^Work experience/ })).toBeInTheDocument();
    expect(preview().getByRole("heading", { level: 1 })).toHaveTextContent(
      "Full stack web developer",
    );
    expect(preview().getByRole("img", { name: "Portrait" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ready" })).toBeInTheDocument();
    expect(screen.getAllByRole("status")[0]).toHaveTextContent("All changes saved");
  });

  it("hides a section from the preview, then brings it back with undo and redo", async () => {
    const { user } = renderBuilder();
    expect(previewSections()).toContain("projects");

    await user.click(outline().getByRole("button", { name: "Show “Projects” on the CV" }));
    expect(previewSections()).not.toContain("projects");
    expect(screen.getAllByRole("status")[0]).toHaveTextContent("Unsaved changes");

    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(previewSections()).toContain("projects");

    await user.click(screen.getByRole("button", { name: "Redo" }));
    expect(previewSections()).not.toContain("projects");

    // Keyboard shortcuts work outside text fields.
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(previewSections()).toContain("projects");
  });

  it("edits a section's heading for this CV only", async () => {
    const { user } = renderBuilder();

    await user.click(outline().getByRole("button", { name: /^Work experience/ }));
    const editor = within(screen.getByRole("region", { name: "Work experience" }));
    const heading = editor.getByRole("textbox", { name: "Heading on this CV" });
    expect(heading).toHaveAttribute("placeholder", "Professional experience");

    await user.type(heading, "Experience");
    expect(preview().getByRole("heading", { level: 2, name: "Experience" })).toBeInTheDocument();

    await user.click(editor.getByRole("button", { name: "Use career data" }));
    expect(
      preview().getByRole("heading", { level: 2, name: "Professional experience" }),
    ).toBeInTheDocument();
  });

  it("removes a section and offers it again under Add section", async () => {
    const { user } = renderBuilder();

    await user.click(outline().getByRole("button", { name: /^Soft skills/ }));
    await user.click(
      within(screen.getByRole("region", { name: "Soft skills" })).getByRole("button", {
        name: "Remove",
      }),
    );
    expect(previewSections()).not.toContain("soft_skills");
    expect(mocks.toast.success).toHaveBeenCalledWith(
      "“Soft skills” removed from this CV",
      expect.objectContaining({ action: expect.objectContaining({ label: "Undo" }) }),
    );

    await user.click(outline().getByRole("button", { name: "Add section" }));
    await user.click(screen.getByRole("menuitem", { name: "Soft skills" }));
    expect(previewSections()).toContain("soft_skills");
    // The re-added section opens in the editor.
    expect(screen.getByRole("region", { name: "Soft skills" })).toBeInTheDocument();
  });

  it("hides the portrait from the header editor", async () => {
    const { user } = renderBuilder();

    await user.click(screen.getByRole("button", { name: "Photo", pressed: true }));

    expect(preview().queryByRole("img", { name: "Portrait" })).not.toBeInTheDocument();
  });

  it("switches the CV to French and lists what must be translated first", async () => {
    const { user } = renderBuilder();

    await user.click(screen.getByRole("radio", { name: "French" }));
    expect(
      screen.getByRole("region", { name: "CV preview canvas" }).querySelector("article"),
    ).toHaveAttribute("lang", "fr");

    await user.click(screen.getByRole("button", { name: /^\d+ to translate$/ }));
    const panel = within(screen.getByRole("dialog", { name: "Before you export" }));
    expect(panel.getByText(/Achievement missing in French/)).toBeInTheDocument();

    await user.click(panel.getAllByRole("button", { name: "Show" })[0]!);
    expect(screen.queryByRole("dialog", { name: "Before you export" })).not.toBeInTheDocument();
  });

  it("blocks printing and PDF export while translations are missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { user } = renderBuilder(cvDocument({ locale: "fr" }));

    await user.click(screen.getByRole("button", { name: "Download PDF" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.toast.error).toHaveBeenCalledWith(
      expect.stringMatching(/^Translate \d+ texts? before printing or exporting\.$/),
    );
    expect(screen.getByRole("dialog", { name: "Before you export" })).toBeInTheDocument();
  });

  it("downloads the PDF of a ready CV", async () => {
    const fetchMock = vi.fn(async () => new Response(new Blob(["%PDF"]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    URL.createObjectURL = vi.fn(() => "blob:cv");
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const { user } = renderBuilder();

    await user.click(screen.getByRole("button", { name: "Download PDF" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(`/api/cvs/${CV_ID}/pdf`, {
        cache: "no-store",
      }),
    );
    await waitFor(() => expect(mocks.toast.success).toHaveBeenCalledWith("PDF downloaded"));
  });

  it("autosaves a rename with the revision it started from", async () => {
    const { user } = renderBuilder();
    const name = screen.getByRole("textbox", { name: "CV name" });

    await user.clear(name);
    await user.type(name, "Backend CV");

    await waitFor(() => expect(mocks.saveCv).toHaveBeenCalled(), { timeout: 2000 });
    expect(mocks.saveCv).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: CV_ID, name: "Backend CV", expectedRevision: 1 }),
    );
    await waitFor(() => expect(screen.getAllByRole("status")[0]).toHaveTextContent("Saved"));
  });

  it("explains a conflict with another tab and lets the owner keep their version", async () => {
    mocks.saveCv.mockResolvedValueOnce({ ok: false, error: "stale" });
    mocks.getCvRevision.mockResolvedValue({ ok: true, data: { revision: 7 } });
    const { user } = renderBuilder();

    await user.click(outline().getByRole("button", { name: "Show “Projects” on the CV" }));
    const alert = await screen.findByRole("alert", {}, { timeout: 2000 });
    expect(alert).toHaveTextContent("This CV was changed in another tab or device.");

    await user.click(within(alert).getByRole("button", { name: "Keep my version" }));
    await waitFor(() =>
      expect(mocks.saveCv).toHaveBeenLastCalledWith(
        expect.objectContaining({ expectedRevision: 7 }),
      ),
    );
  });

  it("duplicates the CV after saving and opens the copy", async () => {
    mocks.duplicateCv.mockResolvedValue({ ok: true, data: { id: "copy-id" } });
    const { user } = renderBuilder();

    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Duplicate" }));

    await waitFor(() =>
      expect(mocks.duplicateCv).toHaveBeenCalledWith(CV_ID, "Copy of Frontend CV"),
    );
    expect(mocks.router.push).toHaveBeenCalledWith("/dashboard/cvs/copy-id");
  });

  it("deletes the CV after confirmation, with an undo", async () => {
    mocks.deleteCv.mockResolvedValue({ ok: true, data: undefined });
    const { user } = renderBuilder();

    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete CV" }));
    const dialog = within(screen.getByRole("alertdialog", { name: "Delete “Frontend CV”?" }));
    await user.click(dialog.getByRole("button", { name: "Delete CV" }));

    await waitFor(() => expect(mocks.deleteCv).toHaveBeenCalledWith(CV_ID));
    expect(mocks.router.push).toHaveBeenCalledWith("/dashboard/cvs");
    expect(mocks.toast.success).toHaveBeenCalledWith(
      "“Frontend CV” deleted",
      expect.objectContaining({ action: expect.objectContaining({ label: "Undo" }) }),
    );
  });

  it("switches between editing and the preview on small screens", async () => {
    const { user } = renderBuilder();
    const views = within(screen.getByRole("tablist", { name: "Editor view" }));

    await user.click(views.getByRole("tab", { name: "Preview" }));
    expect(views.getByRole("tab", { name: "Preview" })).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(views.getByRole("tab", { name: "Preview" }), { key: "Home" });
    expect(views.getByRole("tab", { name: "Edit" })).toHaveAttribute("aria-selected", "true");
  });
});

describe("CV builder per-CV content", () => {
  const previewSection = (kind: string) =>
    screen
      .getByRole("region", { name: "CV preview canvas" })
      .querySelector<HTMLElement>(`[data-section-kind="${kind}"]`)!;

  async function openSection(user: ReturnType<typeof userEvent.setup>, name: string) {
    await user.click(outline().getByRole("button", { name: new RegExp(`^${name}`) }));
    return within(screen.getByRole("region", { name }));
  }

  it("chooses which entries this CV includes, without deleting any", async () => {
    const { user } = renderBuilder();
    const editor = await openSection(user, "Work experience");
    expect(editor.getByRole("heading", { name: "In this CV (2)" })).toBeInTheDocument();

    await user.click(editor.getByRole("button", { name: "Remove “Intern” from this CV" }));
    expect(previewSection("experience")).not.toHaveTextContent("Sample Studio");
    expect(editor.getByRole("heading", { name: "Not in this CV (1)" })).toBeInTheDocument();

    await user.click(editor.getByRole("button", { name: "Add “Intern”" }));
    expect(previewSection("experience")).toHaveTextContent("Sample Studio");

    await user.click(editor.getByRole("button", { name: "Show “Intern” on the CV" }));
    expect(previewSection("experience")).not.toHaveTextContent("Sample Studio");
  });

  it("adjusts one entry's dates, wording, achievements and technologies for this CV", async () => {
    const { user } = renderBuilder();
    const editor = await openSection(user, "Work experience");
    await user.click(editor.getByRole("button", { name: /^Developer/, expanded: false }));

    await user.click(editor.getByRole("button", { name: "Dates", pressed: true }));
    expect(previewSection("experience")).not.toHaveTextContent("2026");

    await user.type(editor.getByRole("textbox", { name: "Role on this CV" }), "Lead developer");
    expect(previewSection("experience")).toHaveTextContent("Lead developer – Example Corp");

    await user.click(editor.getByRole("button", { name: "Show “Built features” on the CV" }));
    expect(previewSection("experience")).not.toHaveTextContent("Built features");

    await user.click(
      editor.getByRole("button", { name: "Reword “Improved the interface” for this CV" }),
    );
    await user.type(
      editor.getByRole("textbox", { name: "Wording on this CV" }),
      "Redesigned the UI",
    );
    expect(previewSection("experience")).toHaveTextContent("Redesigned the UI");
    expect(editor.getByText("Reworded")).toBeInTheDocument();

    await user.click(editor.getByRole("button", { name: "TypeScript", pressed: true }));
    expect(previewSection("experience")).not.toHaveTextContent("TypeScript");
  });

  it("lays technical skills out in one or two columns and hides single skills", async () => {
    const { user } = renderBuilder();
    const editor = await openSection(user, "Technical skills");
    const columns = () => previewSection("technical_skills").querySelector("div")!.children.length;
    expect(columns()).toBe(2);

    await user.click(editor.getByRole("radio", { name: "One column" }));
    expect(columns()).toBe(1);

    const languages = within(editor.getByRole("list", { name: "Skills in Languages" }));
    await user.click(languages.getByRole("button", { name: "SQL", pressed: true }));
    expect(previewSection("technical_skills")).toHaveTextContent("Languages: TypeScript");
    expect(previewSection("technical_skills")).not.toHaveTextContent("SQL");
  });

  it("hides one soft skill on this CV", async () => {
    const { user } = renderBuilder();
    const editor = await openSection(user, "Soft skills");

    await user.click(editor.getByRole("button", { name: "Show “Teamwork” on the CV" }));

    expect(previewSection("soft_skills")).not.toHaveTextContent("Teamwork");
    expect(previewSection("soft_skills")).toHaveTextContent("Time management");
  });
});
