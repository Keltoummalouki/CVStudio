import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExperienceForm } from "@/features/career-data/components/experience-form";
import { NEW_EXPERIENCE } from "@/features/career-data/defaults";
import type { ExperienceValues } from "@/features/career-data/schemas";
import type * as Navigation from "@/lib/i18n/navigation";
import { renderWithIntl } from "../../utils/render";

const mocks = vi.hoisted(() => ({
  saveExperience: vi.fn(),
  router: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() },
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/features/career-data/server/actions", () => ({ saveExperience: mocks.saveExperience }));
vi.mock("@/lib/i18n/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof Navigation>()),
  useRouter: () => mocks.router,
}));
vi.mock("sonner", () => ({ toast: mocks.toast }));

const ID = "7b8c9d0e-1f2a-4b3c-8d4e-5f6a7b8c9d0e";

const EXISTING: ExperienceValues = {
  id: ID,
  expectedUpdatedAt: "2026-10-20T10:00:00Z",
  organization: "Example Corp",
  role: { en: "Developer", fr: "Développeur" },
  location: {},
  period: { startYear: 2024, startMonth: 2, endYear: null, endMonth: null, isCurrent: true },
  details: [{ id: null, kind: "bullet", text: { en: "Built features" } }],
};

beforeEach(() => {
  mocks.saveExperience.mockReset();
  for (const fn of [...Object.values(mocks.router), ...Object.values(mocks.toast)]) fn.mockReset();
});

const saveButton = () => screen.getByRole("button", { name: "Save" });

describe("ExperienceForm", () => {
  it("validates on the client before contacting the server", async () => {
    const user = userEvent.setup();
    renderWithIntl(<ExperienceForm initialValues={NEW_EXPERIENCE} />);

    expect(screen.getByRole("heading", { level: 1, name: "New experience" })).toBeInTheDocument();
    await user.click(saveButton());

    expect(
      await screen.findByText("Some fields need attention. Check the highlighted fields."),
    ).toBeInTheDocument();
    expect(screen.getByText("Write this in at least one language.")).toBeInTheDocument();
    expect(screen.getByText("This field is required.")).toBeInTheDocument();
    expect(mocks.saveExperience).not.toHaveBeenCalled();
  });

  it("creates an experience with achievements and technologies, then opens it", async () => {
    const user = userEvent.setup();
    mocks.saveExperience.mockImplementation(async (values: ExperienceValues) => ({
      ok: true,
      data: { ...values, id: ID },
    }));
    renderWithIntl(<ExperienceForm initialValues={NEW_EXPERIENCE} />);

    await user.type(screen.getByRole("textbox", { name: "Role (English)" }), "Developer");
    await user.type(screen.getByRole("textbox", { name: /^Organization/ }), "Acme");
    await user.click(screen.getByRole("button", { name: "Add achievement" }));
    await user.type(
      screen.getByRole("textbox", { name: "Achievements 1 (English)" }),
      "Shipped it",
    );
    await user.click(screen.getByRole("button", { name: "Add technology" }));
    await user.type(
      screen.getByRole("textbox", { name: "Technologies & tools 1 (Both languages)" }),
      "TypeScript",
    );
    await user.click(saveButton());

    await waitFor(() => expect(mocks.saveExperience).toHaveBeenCalledTimes(1));
    expect(mocks.saveExperience.mock.calls[0]?.[0]).toMatchObject({
      id: null,
      organization: "Acme",
      role: { en: "Developer" },
      details: [
        { id: null, kind: "bullet", text: { en: "Shipped it" } },
        { id: null, kind: "technology", text: { shared: "TypeScript" } },
      ],
    });
    await waitFor(() =>
      expect(mocks.router.replace).toHaveBeenCalledWith(`/dashboard/content/experiences/${ID}`),
    );
    expect(mocks.toast.success).toHaveBeenCalledWith("Created");
  });

  it("saves edits to an existing experience and stays on the page", async () => {
    const user = userEvent.setup();
    mocks.saveExperience.mockImplementation(async (values: ExperienceValues) => ({
      ok: true,
      data: values,
    }));
    renderWithIntl(<ExperienceForm initialValues={EXISTING} />);

    expect(screen.getByRole("heading", { level: 1, name: "Developer" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove: Achievements 1" }));
    expect(
      screen.queryByRole("textbox", { name: "Achievements 1 (English)" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Unsaved changes");

    await user.click(saveButton());

    await waitFor(() => expect(mocks.toast.success).toHaveBeenCalledWith("Changes saved"));
    expect(mocks.saveExperience.mock.calls[0]?.[0]).toMatchObject({ id: ID, details: [] });
    expect(mocks.router.replace).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Saved"));
  });

  it("offers to reload when the record changed elsewhere", async () => {
    const user = userEvent.setup();
    mocks.saveExperience.mockResolvedValue({ ok: false, error: "stale" });
    renderWithIntl(<ExperienceForm initialValues={EXISTING} />);

    await user.type(screen.getByRole("textbox", { name: /^Organization/ }), " Ltd");
    await user.click(saveButton());

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Changed elsewhere");
    await user.click(within(alert).getByRole("button", { name: "Reload latest" }));
    expect(mocks.router.refresh).toHaveBeenCalledTimes(1);
    // The owner's edits stay until they choose to reload.
    expect(screen.getByRole("textbox", { name: /^Organization/ })).toHaveValue("Example Corp Ltd");
  });

  it("keeps edits and says why when the save fails", async () => {
    const user = userEvent.setup();
    mocks.saveExperience.mockResolvedValue({ ok: false, error: "unavailable" });
    renderWithIntl(<ExperienceForm initialValues={EXISTING} />);

    await user.type(screen.getByRole("textbox", { name: /^Organization/ }), "!");
    await user.click(saveButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn’t save. Check your connection and try again; your edits are kept.",
    );
    // The transition settles a tick after the error renders.
    expect(await screen.findByText("Couldn’t save")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /^Organization/ })).toHaveValue("Example Corp!");
  });
});
