import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SaveAsTemplateDialog } from "@/features/cv-templates/components/save-as-template-dialog";
import { getTemplateChoices, saveCvAsTemplate } from "@/features/cv-templates/server/actions";
import type * as Navigation from "@/lib/i18n/navigation";
import { renderWithIntl } from "../../utils/render";

vi.mock("@/features/cv-templates/server/actions", () => ({
  getTemplateChoices: vi.fn(),
  saveCvAsTemplate: vi.fn(),
}));

vi.mock("@/lib/i18n/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof Navigation>()),
  useRouter: () => ({ push: vi.fn() }),
}));

const CV_ID = "55555555-5555-4555-8555-555555555555";
const EXISTING = {
  id: "66666666-6666-4666-8666-666666666666",
  name: "Frontend roles",
  description: "",
  locale: "en" as const,
};

function renderDialog(saveCvFirst = vi.fn().mockResolvedValue(true)) {
  const onOpenChange = vi.fn();
  renderWithIntl(
    <SaveAsTemplateDialog
      open
      onOpenChange={onOpenChange}
      cvId={CV_ID}
      cvName="Frontend – Acme"
      saveCvFirst={saveCvFirst}
    />,
  );
  return { onOpenChange, saveCvFirst };
}

describe("save as template", () => {
  beforeEach(() => {
    vi.mocked(getTemplateChoices)
      .mockReset()
      .mockResolvedValue({ ok: true, data: [EXISTING] });
    vi.mocked(saveCvAsTemplate)
      .mockReset()
      .mockResolvedValue({ ok: true, data: { id: "new-template", name: "Frontend – Acme" } });
  });

  it("saves the CV first, then a new template named after it", async () => {
    const user = userEvent.setup();
    const { onOpenChange, saveCvFirst } = renderDialog();

    expect(await screen.findByRole("radio", { name: /New template/ })).toBeChecked();
    expect(screen.getByRole("textbox", { name: "Template name" })).toHaveValue("Frontend – Acme");
    await user.type(screen.getByRole("textbox", { name: /Description/ }), "  For frontend roles  ");
    await user.click(screen.getByRole("button", { name: "Save template" }));

    expect(saveCvFirst).toHaveBeenCalled();
    expect(saveCvAsTemplate).toHaveBeenCalledWith({
      mode: "new",
      cvId: CV_ID,
      name: "Frontend – Acme",
      description: "For frontend roles",
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("warns before replacing an existing template, keeping its CVs untouched", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(await screen.findByRole("radio", { name: /Replace a template/ }));
    expect(screen.getByRole("combobox", { name: "Template to replace" })).toHaveValue(EXISTING.id);
    expect(
      screen.getByText(/“Frontend roles” will get this CV’s sections, order, wording and language/),
    ).toHaveTextContent("CVs already made from it don’t change.");

    await user.click(screen.getByRole("button", { name: "Replace template" }));
    expect(saveCvAsTemplate).toHaveBeenCalledWith({
      mode: "replace",
      cvId: CV_ID,
      templateId: EXISTING.id,
    });
  });

  it("offers only a new template when none exists yet", async () => {
    vi.mocked(getTemplateChoices).mockResolvedValue({ ok: true, data: [] });
    renderDialog();

    expect(await screen.findByRole("textbox", { name: "Template name" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /Replace a template/ })).not.toBeInTheDocument();
  });

  it("copies nothing while the CV's own edits are unsaved", async () => {
    const user = userEvent.setup();
    renderDialog(vi.fn().mockResolvedValue(false));

    await user.click(await screen.findByRole("button", { name: "Save template" }));
    expect(saveCvAsTemplate).not.toHaveBeenCalled();
  });

  it("keeps the dialog open and explains a failure", async () => {
    const user = userEvent.setup();
    vi.mocked(saveCvAsTemplate).mockResolvedValue({ ok: false, error: "unavailable" });
    const { onOpenChange } = renderDialog();

    await user.click(await screen.findByRole("button", { name: "Save template" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The template couldn’t be saved. Check your connection and try again.",
    );
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
