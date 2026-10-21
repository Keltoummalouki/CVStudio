import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TemplateList } from "@/features/cv-templates/components/template-list";
import { deleteTemplate, duplicateTemplate } from "@/features/cv-templates/server/actions";
import type { TemplateListItem } from "@/features/cv-templates/server/queries";
import type * as Navigation from "@/lib/i18n/navigation";
import { renderWithIntl } from "../../utils/render";

vi.mock("@/features/cv-templates/server/actions", () => ({
  deleteTemplate: vi.fn(),
  duplicateTemplate: vi.fn(),
  restoreTemplate: vi.fn(),
}));

const push = vi.fn();
vi.mock("@/lib/i18n/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof Navigation>()),
  useRouter: () => ({ push }),
}));

const templates: TemplateListItem[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Frontend roles",
    description: "Projects first, no certifications.",
    locale: "en",
    updatedAt: "2026-10-20T09:00:00Z",
    cvCount: 2,
    missingTranslations: 0,
    warnings: 0,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Candidatures en français",
    description: "",
    locale: "fr",
    updatedAt: "2026-10-19T09:00:00Z",
    cvCount: 0,
    missingTranslations: 1,
    warnings: 0,
  },
];

describe("template library", () => {
  beforeEach(() => {
    vi.mocked(deleteTemplate).mockReset();
    vi.mocked(duplicateTemplate).mockReset();
    push.mockReset();
  });

  it("shows each template's language, readiness and how many CVs came from it", () => {
    renderWithIntl(<TemplateList templates={templates} />);

    const frontend = screen.getByRole("link", { name: /Frontend roles/ });
    expect(frontend).toHaveAttribute("href", `/en/dashboard/templates/${templates[0]!.id}`);
    expect(within(frontend).getByText("Projects first, no certifications.")).toBeInTheDocument();
    expect(within(frontend).getByText("Used for 2 CVs")).toBeInTheDocument();
    expect(within(frontend).getByText("Ready to use")).toBeInTheDocument();

    const french = screen.getByRole("link", { name: /Candidatures en français/ });
    expect(within(french).getByText("FR")).toBeInTheDocument();
    expect(within(french).getByText("1 text to translate")).toBeInTheDocument();
    expect(within(french).getByText("No CV made from it yet")).toBeInTheDocument();

    // "Use template" starts a new CV with the template preselected.
    expect(screen.getAllByRole("link", { name: "Use template" })[0]).toHaveAttribute(
      "href",
      `/en/dashboard/cvs/new?template=${templates[0]!.id}`,
    );
  });

  it("deletes after confirming that the CVs made from the template stay as they are", async () => {
    const user = userEvent.setup();
    vi.mocked(deleteTemplate).mockResolvedValue({ ok: true, data: undefined });
    renderWithIntl(<TemplateList templates={templates} />);

    await user.click(screen.getByRole("button", { name: "More actions for Frontend roles" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    const dialog = screen.getByRole("alertdialog", { name: "Delete “Frontend roles”?" });
    expect(dialog).toHaveTextContent("The 2 CVs made from it stay exactly as they are.");

    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(deleteTemplate).toHaveBeenCalledWith(templates[0]!.id);
  });

  it("duplicates under a localized copy name", async () => {
    const user = userEvent.setup();
    vi.mocked(duplicateTemplate).mockResolvedValue({ ok: true, data: { id: "copy" } });
    renderWithIntl(<TemplateList templates={templates} />);

    await user.click(screen.getByRole("button", { name: "More actions for Frontend roles" }));
    await user.click(screen.getByRole("menuitem", { name: "Duplicate" }));
    expect(duplicateTemplate).toHaveBeenCalledWith(templates[0]!.id, "Copy of Frontend roles");
  });
});
