import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiAccess } from "@/features/ai-settings/access";
import { NewCvForm } from "@/features/cv-documents/components/new-cv-form";
import { createCv } from "@/features/cv-documents/server/actions";
import type { TailoringProposal } from "@/features/cv-tailoring/review";
import { tailorCv } from "@/features/cv-tailoring/server/actions";
import type { TemplateChoice } from "@/features/cv-templates/server/queries";
import { NEW_JOB_POST, type JobPostDraft } from "@/features/job-posts/schemas";
import { analyzeJobPost, saveJobPost } from "@/features/job-posts/server/actions";
import type { JobPostChoice } from "@/features/job-posts/server/queries";
import type * as Navigation from "@/lib/i18n/navigation";
import { renderWithIntl } from "../../utils/render";

vi.mock("@/features/cv-documents/server/actions", () => ({ createCv: vi.fn() }));
vi.mock("@/features/cv-tailoring/server/actions", () => ({ tailorCv: vi.fn() }));
vi.mock("@/features/job-posts/server/actions", () => ({
  analyzeJobPost: vi.fn(),
  saveJobPost: vi.fn(),
}));

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

const JOB: JobPostChoice = {
  id: "5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a",
  title: "Développeuse Full Stack",
  company: "Acme",
  language: "fr",
  requirementCount: 4,
};
const UNTAILORABLE: JobPostChoice = {
  id: "6d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a",
  title: "Typed by hand",
  company: "",
  language: "en",
  requirementCount: 0,
};
const OTHER: JobPostChoice = {
  id: "7d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a",
  title: "Backend developer",
  company: "Initech",
  language: "en",
  requirementCount: 2,
};

const READY: AiAccess = {
  state: "ready",
  fake: false,
  providers: ["groq", "gemini"],
  remaining: 9,
  resetsAt: "2026-10-27T00:00:00.000Z",
};

const PROJECT_IDS = [
  "00000000-0000-4000-8000-000000000101",
  "00000000-0000-4000-8000-000000000102",
];
const SKILL_IDS = ["00000000-0000-4000-8000-000000000301", "00000000-0000-4000-8000-000000000302"];

const PROPOSAL: TailoringProposal = {
  mode: "ai",
  picks: { projectIds: PROJECT_IDS, skillIds: SKILL_IDS, title: "Développeuse Full Stack" },
  review: {
    projects: [
      {
        id: PROJECT_IDS[0]!,
        title: "Online shop",
        technologies: ["React", "Node.js", "Stripe"],
        reason: "Uses React and Node.js.",
        missingTranslation: false,
      },
      {
        id: PROJECT_IDS[1]!,
        title: "Booking app",
        technologies: ["PostgreSQL"],
        reason: "Uses PostgreSQL.",
        missingTranslation: true,
      },
    ],
    projectTotal: 7,
    projectsNotSent: 0,
    skills: {
      shown: [
        { id: SKILL_IDS[0]!, label: "React", named: true },
        { id: SKILL_IDS[1]!, label: "Redux", named: false },
      ],
      hidden: [{ id: "00000000-0000-4000-8000-000000000306", label: "Figma" }],
    },
    title: { suggested: "Développeuse Full Stack", profile: "Développeuse web" },
    score: 82,
    careerScore: 91,
    requirements: [
      { id: "r1", label: "React", importance: "required", status: "matched" },
      { id: "r2", label: "Docker", importance: "required", status: "hidden" },
      { id: "r3", label: "Kubernetes", importance: "preferred", status: "missing" },
    ],
  },
};

const POST =
  "Frontend developer\nCompany: Acme\nYou will build web apps with React and TypeScript.";
const DRAFT: JobPostDraft = {
  title: "Frontend developer",
  company: "Acme",
  language: "en",
  description: POST,
  requirements: {
    schemaVersion: 1,
    titleAliases: [],
    items: [
      {
        id: "00000000-0000-4000-8000-000000000901",
        label: "React",
        kind: "skill",
        importance: "required",
        aliases: [],
        note: "",
      },
    ],
  },
  analyzed: true,
};

function renderForm(props: Partial<React.ComponentProps<typeof NewCvForm>> = {}) {
  const user = userEvent.setup();
  renderWithIntl(
    <NewCvForm defaultLocale="en" templates={[]} initialTemplateId={null} {...props} />,
  );
  return user;
}

describe("new CV form", () => {
  beforeEach(() => {
    vi.mocked(createCv)
      .mockReset()
      .mockResolvedValue({ ok: true, data: { id: "new-cv" } });
    vi.mocked(tailorCv).mockReset().mockResolvedValue({ ok: true, data: PROPOSAL });
    vi.mocked(analyzeJobPost).mockReset().mockResolvedValue({ ok: true, data: DRAFT });
    vi.mocked(saveJobPost)
      .mockReset()
      .mockResolvedValue({ ok: true, data: { id: OTHER.id, updatedAt: "t" } });
    push.mockReset();
  });

  it("asks for a template, its content, then a language, with Classic built in", async () => {
    const user = renderForm();

    const [template, content, language] = screen.getAllByRole("group");
    expect(template).toHaveAccessibleName("Template");
    expect(content).toHaveAccessibleName("Content");
    expect(language).toHaveAccessibleName("CV language");
    expect(screen.getByRole("radio", { name: /^Classic/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /^All my career data/ })).toBeChecked();
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
      jobPostId: undefined,
      tailoring: undefined,
    });
    expect(push).toHaveBeenCalledWith("/dashboard/cvs/new-cv");
    expect(tailorCv).not.toHaveBeenCalled();
  });

  it("offers the owner's designs, which never decide the language", async () => {
    const user = renderForm({ templates: [DESIGN] });

    expect(screen.getByRole("radio", { name: /^Classic/ })).toBeChecked();
    expect(screen.getByText(/starts with all your current career data/)).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /^Sidebar/ }));
    expect(screen.getByRole("radio", { name: /^English/ })).toBeChecked();
    expect(screen.getByText(/The CV uses this design/)).toBeInTheDocument();
    expect(screen.getByText("Two columns, photo on the left.")).toBeInTheDocument();

    await user.type(screen.getByRole("textbox", { name: "Name" }), "Bilingual test");
    await user.click(screen.getByRole("button", { name: "Create and open" }));
    expect(createCv).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Bilingual test", locale: "en", templateId: DESIGN.id }),
    );
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
    vi.mocked(createCv).mockResolvedValue({ ok: false, error: "not_found" });
    const user = renderForm({ templates: [DESIGN], initialTemplateId: DESIGN.id });

    await user.type(screen.getByRole("textbox", { name: "Name" }), "Gone");
    await user.click(screen.getByRole("button", { name: "Create and open" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That template no longer exists. Choose another starting point.",
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("names a CV made for a job post after it, in its language, and links it", async () => {
    const user = renderForm({ job: { ...JOB, requirementCount: 0 } });

    // Without requirements there is nothing to tailor: all career data.
    expect(screen.getByRole("radio", { name: /^All my career data/ })).toBeChecked();
    expect(screen.getByText(/For the job post “Développeuse Full Stack”/)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue(
      "Développeuse Full Stack – Acme",
    );
    expect(screen.getByRole("radio", { name: /^French/ })).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Create and open" }));
    expect(createCv).toHaveBeenCalledWith({
      name: "Développeuse Full Stack – Acme",
      locale: "fr",
      templateId: undefined,
      jobPostId: JOB.id,
      tailoring: undefined,
    });
  });

  it("explains when the job post no longer exists", async () => {
    vi.mocked(createCv).mockResolvedValue({
      ok: false,
      error: "not_found",
      fieldIssues: [{ path: "jobPostId", message: "notFound" }],
    });
    const user = renderForm({ job: { ...JOB, requirementCount: 0 } });

    await user.click(screen.getByRole("button", { name: "Create and open" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That job post no longer exists. Choose another one.",
    );
  });

  it("keeps the job post's language when a design is chosen", async () => {
    const user = renderForm({
      defaultLocale: "fr",
      templates: [DESIGN],
      job: { ...OTHER, title: "Frontend developer", company: "" },
    });

    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Frontend developer");
    await user.click(screen.getByRole("radio", { name: /^Sidebar/ }));
    expect(screen.getByRole("radio", { name: /^English/ })).toBeChecked();
  });

  it("leaves the language to the usual default for a post in another language", () => {
    renderForm({
      defaultLocale: "fr",
      templates: [DESIGN],
      initialTemplateId: DESIGN.id,
      job: { ...OTHER, title: "Entwickler", company: "GmbH", language: "other" },
    });
    expect(screen.getByRole("radio", { name: /^French/ })).toBeChecked();
  });
});

describe("new CV form, tailored to a job post", () => {
  beforeEach(() => {
    vi.mocked(createCv)
      .mockReset()
      .mockResolvedValue({ ok: true, data: { id: "new-cv" } });
    vi.mocked(tailorCv).mockReset().mockResolvedValue({ ok: true, data: PROPOSAL });
    vi.mocked(analyzeJobPost).mockReset().mockResolvedValue({ ok: true, data: DRAFT });
    vi.mocked(saveJobPost)
      .mockReset()
      .mockResolvedValue({ ok: true, data: { id: OTHER.id, updatedAt: "t" } });
    push.mockReset();
  });

  it("lets the AI choose for a saved post, shows the choice, then creates the CV", async () => {
    const user = renderForm({ job: JOB, jobPosts: [JOB, UNTAILORABLE], ai: READY });

    expect(screen.getByRole("radio", { name: /^Tailored to a job post/ })).toBeChecked();
    expect(screen.getByRole("combobox", { name: "Saved job post" })).toHaveValue(JOB.id);
    expect(screen.getByText(/Sends Groq, or Gemini when Groq is unavailable/)).toHaveTextContent(
      /Never your name, contacts, photo or links\. 9 AI requests left today\./,
    );
    expect(screen.getByRole("radio", { name: /^French/ })).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Generate with AI" }));
    expect(tailorCv).toHaveBeenCalledWith({
      job: { kind: "saved", id: JOB.id },
      cvLocale: "fr",
      uiLocale: "en",
      mode: "ai",
    });

    const heading = await screen.findByRole("heading", {
      name: "Tailored for “Développeuse Full Stack”",
    });
    expect(heading).toHaveFocus();
    const review = screen.getByRole("region", { name: "Tailored for “Développeuse Full Stack”" });
    expect(within(review).getByText("Chosen by AI")).toBeInTheDocument();
    expect(within(review).getByText("Estimated keyword coverage: 82 percent")).toBeInTheDocument();
    expect(within(review).getByText(/All your career data: 91%/)).toBeInTheDocument();
    const projects = within(review).getByRole("region", { name: "Projects · 2 of 7" });
    expect(
      within(projects)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      "1Online shopReact · Node.js · StripeWhy: Uses React and Node.js.",
      "2Booking appPostgreSQLWhy: Uses PostgreSQL.Not written in French yet",
    ]);
    const skills = within(review).getByRole("region", {
      name: "Technical skills · 2 shown, 1 hidden",
    });
    expect(within(skills).getByText("Figma")).not.toBeVisible();
    await user.click(within(skills).getByRole("button", { name: "Show hidden skills" }));
    expect(within(skills).getByText("Figma")).toBeVisible();
    const requirements = within(review).getByRole("region", { name: "The job’s requirements" });
    expect(requirements).toHaveTextContent("On this CV (1)React, Required");
    expect(requirements).toHaveTextContent("In your career data, not on this CV (1)Docker");
    expect(requirements).toHaveTextContent("Not in your career data (1)Kubernetes, Nice to have");

    // The choice stands for this language and job: Start over changes them.
    expect(screen.getByRole("radio", { name: /^English/ })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Saved job post" })).toBeDisabled();
    expect(screen.getByText(/Start over to change the language/)).toBeInTheDocument();

    const title = within(review).getByRole("textbox", { name: "Suggested CV title" });
    expect(title).toHaveValue("Développeuse Full Stack");
    await user.clear(title);
    await user.type(title, "Développeuse React");
    await user.click(screen.getByRole("button", { name: "Create and open" }));

    expect(createCv).toHaveBeenCalledWith({
      name: "Développeuse Full Stack – Acme",
      locale: "fr",
      templateId: undefined,
      jobPostId: JOB.id,
      tailoring: { projectIds: PROJECT_IDS, skillIds: SKILL_IDS, title: "Développeuse React" },
    });
    expect(saveJobPost).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/dashboard/cvs/new-cv");
  });

  it("keeps the profile's title when the owner prefers it", async () => {
    const user = renderForm({ job: JOB, jobPosts: [JOB], ai: READY });
    await user.click(screen.getByRole("button", { name: "Generate with AI" }));
    await user.click(await screen.findByRole("radio", { name: /^My profile title/ }));
    expect(screen.getByRole("radio", { name: /^My profile title/ })).toHaveAccessibleName(
      /Développeuse web/,
    );
    await user.click(screen.getByRole("button", { name: "Create and open" }));
    expect(createCv).toHaveBeenCalledWith(
      expect.objectContaining({ tailoring: expect.objectContaining({ title: null }) }),
    );
  });

  it("reads a pasted post first, and saves it to Job match only with the CV, once", async () => {
    vi.mocked(createCv).mockResolvedValueOnce({ ok: false, error: "unavailable" });
    const user = renderForm({ ai: READY });

    await user.click(screen.getByRole("radio", { name: /^Tailored to a job post/ }));
    // No saved posts: pasting is the only way in.
    expect(screen.queryByRole("radiogroup", { name: "Job post" })).not.toBeInTheDocument();
    expect(screen.getByText(/A pasted post uses two requests/)).toBeInTheDocument();
    const generate = screen.getByRole("button", { name: "Generate with AI" });
    expect(generate).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: "Job post" }), "Too short");
    expect(screen.getByText(/Paste at least 40 characters/)).toBeInTheDocument();
    await user.clear(screen.getByRole("textbox", { name: "Job post" }));
    await user.type(screen.getByRole("textbox", { name: "Job post" }), POST);
    await user.click(generate);

    expect(analyzeJobPost).toHaveBeenCalledWith({ description: POST });
    expect(tailorCv).toHaveBeenCalledWith({
      job: { kind: "draft", draft: DRAFT },
      cvLocale: "en",
      uiLocale: "en",
      mode: "ai",
    });
    await screen.findByRole("heading", { name: "Tailored for “Frontend developer”" });
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Frontend developer – Acme");
    // Two requests spent here, so 7 left.
    await user.click(screen.getByRole("button", { name: "Start over" }));
    expect(screen.getByText(/7 AI requests left today/)).toBeInTheDocument();

    // The same text is not read twice; the choice is made again.
    await user.click(screen.getByRole("button", { name: "Generate with AI" }));
    await screen.findByRole("heading", { name: "Tailored for “Frontend developer”" });
    expect(analyzeJobPost).toHaveBeenCalledTimes(1);
    expect(tailorCv).toHaveBeenCalledTimes(2);

    await user.click(screen.getByRole("button", { name: "Create and open" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The CV couldn’t be created. Check your connection and try again.",
    );
    // The alert can show while the button still reads "Creating…".
    await user.click(await screen.findByRole("button", { name: "Create and open" }));

    expect(saveJobPost).toHaveBeenCalledTimes(1);
    expect(saveJobPost).toHaveBeenCalledWith({ ...NEW_JOB_POST, ...DRAFT, analyzed: true });
    expect(createCv).toHaveBeenLastCalledWith(
      expect.objectContaining({ name: "Frontend developer – Acme", jobPostId: OTHER.id }),
    );
    expect(push).toHaveBeenCalledWith("/dashboard/cvs/new-cv");
  });

  it("never replaces a name or language the owner chose", async () => {
    const user = renderForm({ job: JOB, jobPosts: [JOB, OTHER], ai: READY });

    await user.selectOptions(screen.getByRole("combobox", { name: "Saved job post" }), OTHER.id);
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue(
      "Backend developer – Initech",
    );
    expect(screen.getByRole("radio", { name: /^English/ })).toBeChecked();

    await user.clear(screen.getByRole("textbox", { name: "Name" }));
    await user.type(screen.getByRole("textbox", { name: "Name" }), "My own name");
    await user.click(screen.getByRole("radio", { name: /^French/ }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Saved job post" }), JOB.id);
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("My own name");
    expect(screen.getByRole("radio", { name: /^French/ })).toBeChecked();
  });

  it("cannot tailor to a post without requirements", async () => {
    const user = renderForm({ job: JOB, jobPosts: [JOB, UNTAILORABLE], ai: READY });

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Saved job post" }),
      UNTAILORABLE.id,
    );
    expect(screen.getByRole("combobox", { name: "Saved job post" })).toHaveAccessibleDescription(
      "This post has no requirements yet. Add them on its page in Job match.",
    );
    expect(screen.getByRole("button", { name: "Generate with AI" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Choose by keywords" })).not.toBeInTheDocument();
  });

  it("chooses by keywords when AI is off, and says how to turn it on", async () => {
    vi.mocked(tailorCv).mockResolvedValue({ ok: true, data: { ...PROPOSAL, mode: "keywords" } });
    const user = renderForm({ job: JOB, jobPosts: [JOB], ai: { ...READY, state: "off" } });

    expect(screen.getByText(/AI is off\. Turn it on in Settings/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Settings" })).toHaveAttribute(
      "href",
      "/en/dashboard/settings",
    );
    expect(screen.getByRole("button", { name: "Generate with AI" })).toBeDisabled();
    expect(screen.getByText(/Without AI: the projects that name the most/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Choose by keywords" }));
    expect(tailorCv).toHaveBeenCalledWith(expect.objectContaining({ mode: "keywords" }));
    const review = await screen.findByRole("region", {
      name: "Tailored for “Développeuse Full Stack”",
    });
    expect(within(review).getByText("Chosen by keyword matching")).toBeInTheDocument();
    expect(within(review).getByText("The job post’s title.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Generate again" })).not.toBeInTheDocument();
  });

  it("stops offering the AI once this page has used the last request", async () => {
    const user = renderForm({ job: JOB, jobPosts: [JOB], ai: { ...READY, remaining: 1 } });
    await user.click(screen.getByRole("button", { name: "Generate with AI" }));
    await screen.findByRole("heading", { name: "Tailored for “Développeuse Full Stack”" });
    expect(screen.queryByRole("button", { name: "Generate again" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Start over" }));
    expect(screen.getByText(/You’ve used today’s AI requests/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate with AI" })).toBeDisabled();
  });

  it.each([
    [
      { ok: false, error: "ai_rate_limited", provider: "groq" },
      "Groq is limiting requests right now. Wait a minute and try again.",
    ],
    [
      { ok: false, error: "ai_too_large", provider: "gemini" },
      "Gemini can’t take a request this large on its current plan. Shorten the job post, or choose by keywords.",
    ],
    [
      { ok: false, error: "ai_disabled" },
      "AI is off. Turn it on in Settings, or choose by keywords from a saved job post.",
    ],
    [
      {
        ok: false,
        error: "invalid_input",
        fieldIssues: [{ path: "job", message: "noRequirements" }],
      },
      "This job post has no requirements yet. Add them on its page in Job match.",
    ],
    [{ ok: false, error: "not_found" }, "This job post no longer exists. Choose another one."],
  ] as const)("explains why tailoring stopped: %o", async (failure, message) => {
    vi.mocked(tailorCv).mockResolvedValue(failure as Awaited<ReturnType<typeof tailorCv>>);
    const user = renderForm({ job: JOB, jobPosts: [JOB], ai: READY });
    await user.click(screen.getByRole("button", { name: "Generate with AI" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.queryByRole("heading", { name: /Tailored for/ })).not.toBeInTheDocument();
  });

  it("explains a pasted text with no requirements, and a request that never answered", async () => {
    vi.mocked(analyzeJobPost).mockResolvedValueOnce({
      ok: true,
      data: { ...DRAFT, requirements: { ...DRAFT.requirements, items: [] } },
    });
    const user = renderForm({ ai: READY });
    await user.click(screen.getByRole("radio", { name: /^Tailored to a job post/ }));
    await user.type(screen.getByRole("textbox", { name: "Job post" }), POST);
    await user.click(screen.getByRole("button", { name: "Generate with AI" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The AI found no requirements in this text. Check that it’s a job post, then try again.",
    );
    expect(tailorCv).not.toHaveBeenCalled();

    vi.mocked(analyzeJobPost).mockRejectedValueOnce(new Error("offline"));
    await user.click(screen.getByRole("button", { name: "Generate with AI" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your CV couldn’t be tailored. Check your connection and try again.",
    );
  });
});
