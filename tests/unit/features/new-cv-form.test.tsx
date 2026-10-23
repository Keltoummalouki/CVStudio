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

const FRENCH_TEMPLATE: TemplateChoice = {
  id: "33333333-3333-4333-8333-333333333333",
  name: "Candidatures en français",
  description: "Sans projets.",
  locale: "fr",
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
    expect(screen.getByText(/Your own templates will appear here/)).toBeInTheDocument();

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

  it("choosing a template switches to its language, which stays changeable", async () => {
    const user = userEvent.setup();
    renderWithIntl(
      <NewCvForm defaultLocale="en" templates={[FRENCH_TEMPLATE]} initialTemplateId={null} />,
    );

    expect(screen.getByRole("radio", { name: /^Classic/ })).toBeChecked();
    expect(screen.getByText(/starts with all your current career data/)).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /Candidatures en français/ }));
    expect(screen.getByRole("radio", { name: /^French/ })).toBeChecked();
    expect(screen.getByText(/Entries added since the template was saved/)).toBeInTheDocument();
    expect(screen.getByText("Saved in French")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /^English/ }));
    await user.type(screen.getByRole("textbox", { name: "Name" }), "Bilingual test");
    await user.click(screen.getByRole("button", { name: "Create and open" }));
    expect(createCv).toHaveBeenCalledWith({
      name: "Bilingual test",
      locale: "en",
      templateId: FRENCH_TEMPLATE.id,
    });
  });

  it("preselects the template the owner chose on the templates page, but only their own", () => {
    const { unmount } = renderWithIntl(
      <NewCvForm
        defaultLocale="en"
        templates={[FRENCH_TEMPLATE]}
        initialTemplateId={FRENCH_TEMPLATE.id}
      />,
    );
    expect(screen.getByRole("radio", { name: /Candidatures en français/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /^French/ })).toBeChecked();
    unmount();

    renderWithIntl(
      <NewCvForm
        defaultLocale="en"
        templates={[FRENCH_TEMPLATE]}
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
      <NewCvForm
        defaultLocale="en"
        templates={[FRENCH_TEMPLATE]}
        initialTemplateId={FRENCH_TEMPLATE.id}
      />,
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

  it("keeps the job post's language when a template saved in another one is chosen", async () => {
    const user = userEvent.setup();
    renderWithIntl(
      <NewCvForm
        defaultLocale="fr"
        templates={[FRENCH_TEMPLATE]}
        initialTemplateId={null}
        job={{ id: "job-1", title: "Frontend developer", company: "", language: "en" }}
      />,
    );

    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Frontend developer");
    await user.click(screen.getByRole("radio", { name: /Candidatures en français/ }));
    expect(screen.getByRole("radio", { name: /^English/ })).toBeChecked();
  });

  it("leaves the language to the usual default for a post in another language", () => {
    renderWithIntl(
      <NewCvForm
        defaultLocale="en"
        templates={[FRENCH_TEMPLATE]}
        initialTemplateId={FRENCH_TEMPLATE.id}
        job={{ id: "job-1", title: "Entwickler", company: "GmbH", language: "other" }}
      />,
    );
    // The chosen template's language, as without a job post.
    expect(screen.getByRole("radio", { name: /^French/ })).toBeChecked();
  });
});
