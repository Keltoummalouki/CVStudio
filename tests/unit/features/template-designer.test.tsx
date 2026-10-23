import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_HEADER } from "@/features/cv-builder/defaults";
import { createBlankDesign, type Design } from "@/features/cv-design/design";
import type { CvTemplate } from "@/features/cv-templates/server/queries";
import type * as Navigation from "@/lib/i18n/navigation";
import { buildMasterData, LABELS } from "../../fixtures/master-data";
import { renderWithIntl } from "../../utils/render";

const mocks = vi.hoisted(() => ({
  saveTemplateDesign: vi.fn(),
  getTemplateRevision: vi.fn(),
  duplicateTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
  restoreTemplate: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/features/cv-templates/server/actions", () => mocks);
vi.mock("@/lib/i18n/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof Navigation>()),
  useRouter: () => ({ push: mocks.push, replace: vi.fn(), refresh: vi.fn() }),
}));
// next/font only works inside the Next.js compiler.
vi.mock("@/features/cv-renderer/fonts", () => ({
  poppins: { className: "font-poppins" },
  inter: { className: "font-inter" },
  lora: { className: "font-lora" },
}));

const { TemplateDesigner } = await import("@/features/cv-templates/components/template-designer");

const TEMPLATE_ID = "6a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

function template(design: Design = createBlankDesign()): CvTemplate {
  return {
    id: TEMPLATE_ID,
    name: "Untitled template",
    locale: "en",
    revision: 1,
    updatedAt: "2026-10-23T10:00:00Z",
    definition: { schemaVersion: 1, header: DEFAULT_HEADER, sections: [] },
    design,
  };
}

function renderDesigner(design?: Design) {
  const user = userEvent.setup();
  renderWithIntl(
    <TemplateDesigner
      template={template(design)}
      master={buildMasterData()}
      labels={LABELS}
      photoUrl={null}
    />,
  );
  return user;
}

const frame = (name: RegExp) => screen.getByRole("button", { name });
const numberField = (label: string) => screen.getByRole("spinbutton", { name: label });

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.saveTemplateDesign.mockResolvedValue({ ok: true, data: { revision: 2, updatedAt: "t" } });
});

describe("template designer", () => {
  it("starts from a blank page and adds elements from the list", async () => {
    const user = renderDesigner();
    expect(screen.getByText(/Add elements from the list/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add Name" }));

    const name = frame(/^Name, at 15 by 15 mm/);
    expect(name).toHaveAttribute("aria-pressed", "true");
    expect(
      within(screen.getByRole("complementary", { name: "Properties" })).getByRole("heading", {
        name: "Name",
      }),
    ).toBeInTheDocument();
    // Career content goes on the page once.
    expect(screen.getByRole("button", { name: /^Name On the page$/ })).toBeDisabled();
    expect(screen.getByText("Name added")).toHaveAttribute("aria-live", "polite");
  });

  it("moves and resizes with the keyboard, and undoes it", async () => {
    const user = renderDesigner();
    await user.click(screen.getByRole("button", { name: "Add Name" }));
    const name = frame(/^Name, at/);
    name.focus();

    await user.keyboard("{ArrowRight}");
    expect(frame(/^Name, at 16 by 15 mm/)).toBeInTheDocument();
    expect(numberField("X")).toHaveValue(16);
    await user.keyboard("{Shift>}{ArrowDown}{/Shift}");
    expect(numberField("Y")).toHaveValue(20);
    await user.keyboard("{Control>}{ArrowRight}{/Control}");
    expect(numberField("Width")).toHaveValue(121);

    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(numberField("Width")).toHaveValue(120);
    fireEvent.keyDown(window, { key: "z", ctrlKey: true, shiftKey: true });
    expect(numberField("Width")).toHaveValue(121);
  });

  it("edits an element's look from its properties", async () => {
    const user = renderDesigner();
    await user.click(screen.getByRole("button", { name: "Add Text" }));

    const size = numberField("Size");
    await user.clear(size);
    await user.type(size, "14");
    expect(size).toHaveValue(14);
    await user.click(screen.getByRole("radio", { name: "Centre" }));
    expect(screen.getByRole("radio", { name: "Centre" })).toHaveAttribute("aria-checked", "true");

    const english = screen.getByRole("textbox", { name: "Text in English" });
    await user.clear(english);
    await user.type(english, "Contact");
    expect(screen.getByRole("textbox", { name: "Text in French" })).toHaveValue("Your text");
  });

  it("reports text boxes that overlap, and lists the reading order", async () => {
    const user = renderDesigner();
    await user.click(screen.getByRole("button", { name: "Add Text" }));
    await user.click(screen.getByRole("button", { name: "Add Line" }));
    await user.click(screen.getByRole("button", { name: "Add Name" }));
    expect(screen.getByText("Nothing to fix: every text fits on the page.")).toBeInTheDocument();

    // Move the name onto the text box above it.
    const y = numberField("Y");
    await user.clear(y);
    await user.type(y, "15");
    expect(screen.getByText("1 thing to fix")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Text overlaps Name\./ })).toBeInTheDocument();

    // With nothing selected, the page panel lists the text in reading order; the line is not read.
    await user.click(screen.getByRole("button", { name: "Done" }));
    const order = within(screen.getByRole("region", { name: "Reading order" })).getByRole("list");
    expect(
      within(order)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([expect.stringContaining("Text"), expect.stringContaining("Name")]);
    await user.click(screen.getByRole("button", { name: "Read Name earlier" }));
    expect(within(order).getAllByRole("listitem")[0]).toHaveTextContent("Name");
  });

  it("removes an element with Delete and saves the design automatically", async () => {
    const user = renderDesigner();
    await user.click(screen.getByRole("button", { name: "Add Text" }));
    frame(/^Text, at/).focus();
    await user.keyboard("{Delete}");
    expect(screen.queryByRole("button", { name: /^Text, at/ })).not.toBeInTheDocument();
    expect(screen.getByText("Text removed")).toHaveAttribute("aria-live", "polite");

    await user.click(screen.getByRole("button", { name: "Add Work experience" }));
    await waitFor(() => expect(mocks.saveTemplateDesign).toHaveBeenCalled(), { timeout: 3000 });
    const saved = mocks.saveTemplateDesign.mock.calls.at(-1)?.[0] as {
      id: string;
      expectedRevision: number;
      design: Design;
    };
    expect(saved).toMatchObject({ id: TEMPLATE_ID, expectedRevision: 1 });
    expect(saved.design.elements.map((element) => element.content.type)).toEqual(["section"]);
  });
});
