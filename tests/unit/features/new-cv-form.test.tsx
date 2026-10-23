import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NewCvForm } from "@/features/cv-documents/components/new-cv-form";
import { createCv } from "@/features/cv-documents/server/actions";
import type { TemplateChoice } from "@/features/cv-templates/server/queries";
import type * as Navigation from "@/lib/i18n/navigation";
import { renderWithIntl } from "../../utils/render";

vi.mock("@/features/cv-documents/server/actions", () => ({ createCv: vi.fn() }));

const push = vi.fn();
vi.mock("@/lib/i18n/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof Navigation>()),
  useRouter: () => ({ push }),
}));

const DESIGN: TemplateChoice = {
  id: "33333333-3333-4333-8333-333333333333",
  name: "Sidebar",
  description: "Two columns, photo on the left.",
};

describe("new CV form", () => {
  beforeEach(() => {
    vi.mocked(createCv)
      .mockReset()
      .mockResolvedValue({ ok: true, data: { id: "new-cv" } });
    push.mockReset();
  });

  it("asks for a template, then a language, with Classic built in", async () => {
    const user = userEvent.setup();
    renderWithIntl(<NewCvForm defaultLocale="en" templates={[]} initialTemplateId={null} />);

    const [template, language] = screen.getAllByRole("group");
    expect(template).toHaveAccessibleName("Template");
    expect(language).toHaveAccessibleName("CV language");
    expect(screen.getByRole("radio", { name: /^Classic/ })).toBeChecked();
    expect(screen.getByText(/Templates you design appear here/)).toBeInTheDocument();

    // The name is checked before anything is created.
    await user.click(screen.getByRole("button", { name: "Create and open" }));
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveFocus();
    expect(createCv).not.toHaveBeenCalled();

    await user.type(screen.getByRole("textbox", { name: "Name" }), "Frontend – Acme");
    await user.click(screen.getByRole("button", { name: "Create and open" }));

    expect(createCv).toHaveBeenCalledWith({
      name: "Frontend – Acme",
      locale: "en",
      templateId: undefined,
    });
    expect(push).toHaveBeenCalledWith("/dashboard/cvs/new-cv");
  });

  it("offers the owner's designs, which never decide the language", async () => {
    const user = userEvent.setup();
    renderWithIntl(<NewCvForm defaultLocale="en" templates={[DESIGN]} initialTemplateId={null} />);

    expect(screen.getByRole("radio", { name: /^Classic/ })).toBeChecked();
    expect(screen.getByText(/starts with all your current career data/)).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /^Sidebar/ }));
    expect(screen.getByRole("radio", { name: /^English/ })).toBeChecked();
    expect(screen.getByText(/The CV uses this design/)).toBeInTheDocument();
    expect(screen.getByText("Two columns, photo on the left.")).toBeInTheDocument();

    await user.type(screen.getByRole("textbox", { name: "Name" }), "Bilingual test");
    await user.click(screen.getByRole("button", { name: "Create and open" }));
    expect(createCv).toHaveBeenCalledWith({
      name: "Bilingual test",
      locale: "en",
      templateId: DESIGN.id,
    });
  });

  it("preselects the template the owner chose on the templates page, but only their own", () => {
    const { unmount } = renderWithIntl(
      <NewCvForm defaultLocale="en" templates={[DESIGN]} initialTemplateId={DESIGN.id} />,
    );
    expect(screen.getByRole("radio", { name: /^Sidebar/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /^English/ })).toBeChecked();
    unmount();

    renderWithIntl(
      <NewCvForm
        defaultLocale="en"
        templates={[DESIGN]}
        initialTemplateId="44444444-4444-4444-8444-444444444444"
      />,
    );
    expect(screen.getByRole("radio", { name: /^Classic/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /^English/ })).toBeChecked();
  });

  it("explains when the chosen template no longer exists", async () => {
    const user = userEvent.setup();
    vi.mocked(createCv).mockResolvedValue({ ok: false, error: "not_found" });
    renderWithIntl(
      <NewCvForm defaultLocale="en" templates={[DESIGN]} initialTemplateId={DESIGN.id} />,
    );

    await user.type(screen.getByRole("textbox", { name: "Name" }), "Gone");
    await user.click(screen.getByRole("button", { name: "Create and open" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That template no longer exists. Choose another starting point.",
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("names a CV made for a job post after it, in its language", async () => {
    const user = userEvent.setup();
    renderWithIntl(
      <NewCvForm
        defaultLocale="en"
        templates={[]}
        initialTemplateId={null}
        job={{ id: "job-1", title: "Développeuse React", company: "Acme", language: "fr" }}
      />,
    );

    expect(screen.getByText(/For the job post “Développeuse React”/)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Développeuse React – Acme");
    expect(screen.getByRole("radio", { name: /^French/ })).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Create and open" }));
    expect(createCv).toHaveBeenCalledWith({
      name: "Développeuse React – Acme",
      locale: "fr",
      templateId: undefined,
    });
  });

  it("keeps the job post's language when a design is chosen", async () => {
    const user = userEvent.setup();
    renderWithIntl(
      <NewCvForm
        defaultLocale="fr"
        templates={[DESIGN]}
        initialTemplateId={null}
        job={{ id: "job-1", title: "Frontend developer", company: "", language: "en" }}
      />,
    );

    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Frontend developer");
    await user.click(screen.getByRole("radio", { name: /^Sidebar/ }));
    expect(screen.getByRole("radio", { name: /^English/ })).toBeChecked();
  });

  it("leaves the language to the usual default for a post in another language", () => {
    renderWithIntl(
      <NewCvForm
        defaultLocale="fr"
        templates={[DESIGN]}
        initialTemplateId={DESIGN.id}
        job={{ id: "job-1", title: "Entwickler", company: "GmbH", language: "other" }}
      />,
    );
    expect(screen.getByRole("radio", { name: /^French/ })).toBeChecked();
  });
});
