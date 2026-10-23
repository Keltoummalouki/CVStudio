import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiAccess } from "@/features/ai-settings/access";
import { JobPostForm } from "@/features/job-posts/components/job-post-form";
import { NewJobPost } from "@/features/job-posts/components/new-job-post";
import { analyzeJobPost, saveJobPost } from "@/features/job-posts/server/actions";
import { NEW_JOB_POST, type JobPostDraft, type JobPostValues } from "@/features/job-posts/schemas";
import type * as Navigation from "@/lib/i18n/navigation";
import { renderWithIntl } from "../../utils/render";

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() },
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/features/job-posts/server/actions", () => ({
  saveJobPost: vi.fn(),
  analyzeJobPost: vi.fn(),
  deleteJobPost: vi.fn(),
  restoreJobPost: vi.fn(),
}));
vi.mock("@/lib/i18n/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof Navigation>()),
  useRouter: () => mocks.router,
}));
vi.mock("sonner", () => ({ toast: mocks.toast }));

const JOB_ID = "5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a";
const POST =
  "Frontend developer\nWe build web apps with React and TypeScript. Fluent English required.";
const READY: AiAccess = {
  state: "ready",
  fake: false,
  providers: ["groq", "gemini"],
  remaining: 7,
  resetsAt: "2026-10-24T00:00:00.000Z",
};

const requirement = (id: number, label: string, aliases: string[] = []) => ({
  id: `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
  label,
  kind: "skill" as const,
  importance: "required" as const,
  aliases,
  note: "",
});

const DRAFT: JobPostDraft = {
  title: "Frontend developer",
  company: "Acme",
  language: "en",
  description: POST,
  requirements: {
    schemaVersion: 1,
    titleAliases: [],
    items: [requirement(1, "React", ["React.js"]), requirement(2, "TypeScript")],
  },
  analyzed: true,
};

const SAVED: JobPostValues = {
  ...NEW_JOB_POST,
  ...DRAFT,
  id: JOB_ID,
  expectedUpdatedAt: "2026-10-23T09:00:00+00:00",
  analyzed: false,
};

const labelInputs = () => screen.getAllByRole("textbox", { name: /^Requirement \d+$/ });

beforeEach(() => {
  vi.mocked(saveJobPost)
    .mockReset()
    .mockResolvedValue({ ok: true, data: { id: JOB_ID, updatedAt: "2026-10-23T10:00:00+00:00" } });
  vi.mocked(analyzeJobPost).mockReset().mockResolvedValue({ ok: true, data: DRAFT });
  for (const fn of Object.values(mocks.router)) fn.mockReset();
  mocks.toast.success.mockReset();
});

describe("new job post", () => {
  it("analyzes the pasted text, then lets the owner review and save it", async () => {
    const user = userEvent.setup();
    renderWithIntl(<NewJobPost ai={READY} />);

    const analyze = screen.getByRole("button", { name: "Analyze with AI" });
    expect(analyze).toBeDisabled();
    expect(
      screen.getByText(/Only this text is sent to Groq, or to Gemini when Groq is unavailable;/),
    ).toHaveTextContent("7 analyses left today.");

    await user.click(screen.getByRole("textbox", { name: "Job post" }));
    await user.paste("Short");
    expect(screen.getByText(/Paste at least 40 characters/)).toBeInTheDocument();
    await user.clear(screen.getByRole("textbox", { name: "Job post" }));
    await user.paste(POST);
    await user.click(analyze);

    expect(analyzeJobPost).toHaveBeenCalledWith({ description: POST });
    expect(await screen.findByText("Check what the AI found")).toBeInTheDocument();
    expect(screen.getByText(/The AI found 2 requirements/)).toBeInTheDocument();
    expect(labelInputs().map((input) => (input as HTMLInputElement).value)).toEqual([
      "React",
      "TypeScript",
    ]);
    // A draft that was never saved is not "saved".
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(saveJobPost).toHaveBeenCalledWith(
      expect.objectContaining({ id: null, title: "Frontend developer", analyzed: true }),
    );
    expect(mocks.router.replace).toHaveBeenCalledWith(`/dashboard/jobs/${JOB_ID}`);
    expect(mocks.toast.success).toHaveBeenCalledWith("Job post saved");
  });

  it("explains an AI failure and keeps the text", async () => {
    const user = userEvent.setup();
    vi.mocked(analyzeJobPost).mockResolvedValue({ ok: false, error: "ai_limit_reached" });
    renderWithIntl(<NewJobPost ai={READY} />);

    await user.click(screen.getByRole("textbox", { name: "Job post" }));
    await user.paste(POST);
    await user.click(screen.getByRole("button", { name: "Analyze with AI" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("You’ve used today’s AI requests.");
    expect(screen.getByRole("textbox", { name: "Job post" })).toHaveValue(POST);
  });

  it.each([
    [
      "groq" as const,
      "ai_overloaded" as const,
      "Groq is busy right now. Wait a minute and try again.",
    ],
    // Groq's 413 without a fallback: waiting would not help, a shorter post does.
    [
      "groq" as const,
      "ai_too_large" as const,
      "Groq can’t take a job post this long on its current plan. Shorten the text",
    ],
    [
      "gemini" as const,
      "ai_key_rejected" as const,
      "Google refused the API key. Check GEMINI_API_KEY and the project’s billing.",
    ],
    [
      "groq" as const,
      "ai_key_rejected" as const,
      "Groq refused the API key. Check GROQ_API_KEY on the server.",
    ],
    [undefined, "ai_providers_unavailable" as const, "Neither AI provider could answer right now"],
    // A provider failure always names its provider; the message copes without.
    [undefined, "ai_invalid_response" as const, "The AI request failed. Try again in a moment."],
  ])("names the provider behind a failure (%s, %s)", async (provider, error, message) => {
    const user = userEvent.setup();
    vi.mocked(analyzeJobPost).mockResolvedValue(
      provider ? { ok: false, error, provider } : { ok: false, error },
    );
    renderWithIntl(<NewJobPost ai={READY} />);

    await user.click(screen.getByRole("textbox", { name: "Job post" }));
    await user.paste(POST);
    await user.click(screen.getByRole("button", { name: "Analyze with AI" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
  });

  it("tells who receives the post when only one provider is set up", () => {
    renderWithIntl(<NewJobPost ai={{ ...READY, providers: ["gemini"] }} />);
    expect(
      screen.getByText(/^Only this text is sent to Gemini; your CVs and career data stay here\./),
    ).toBeInTheDocument();
  });

  it.each([
    [{ ...READY, state: "off" as const }, /AI analysis is off/, true],
    [{ ...READY, state: "unavailable" as const }, /isn’t set up on the server/, false],
    [{ ...READY, state: "limit" as const, remaining: 0 }, /You’ve used today’s AI requests/, true],
  ])("says why AI cannot run (%o) and still allows manual entry", (ai, message, settingsLink) => {
    renderWithIntl(<NewJobPost ai={ai} />);
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analyze with AI" })).toBeDisabled();
    expect(screen.queryByRole("link", { name: "Open Settings" }) !== null).toBe(settingsLink);
    expect(screen.getByRole("button", { name: "Enter requirements myself" })).toBeEnabled();
  });

  it("lets the owner type the requirements without AI", async () => {
    const user = userEvent.setup();
    renderWithIntl(<NewJobPost ai={{ ...READY, state: "unavailable" }} />);

    await user.click(screen.getByRole("textbox", { name: "Job post" }));
    await user.paste(POST);
    await user.click(screen.getByRole("button", { name: "Enter requirements myself" }));

    expect(screen.queryByText("Check what the AI found")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /^Text of the post/ })).toHaveValue(POST);
    expect(screen.getByText(/No requirements yet/)).toBeInTheDocument();

    await user.type(screen.getByRole("textbox", { name: "Job title" }), "Data engineer");
    await user.click(screen.getByRole("button", { name: "Add a requirement" }));
    expect(labelInputs()[0]).toHaveFocus();
    await user.keyboard("Python");
    await user.click(
      within(screen.getByRole("group", { name: "Importance of Python" })).getByRole("radio", {
        name: "Nice to have",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(saveJobPost).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Data engineer",
        analyzed: false,
        requirements: expect.objectContaining({
          items: [expect.objectContaining({ label: "Python", importance: "preferred" })],
        }),
      }),
    );
  });
});

describe("job post editor", () => {
  it("edits, removes and saves requirements, then resets to the saved version", async () => {
    const user = userEvent.setup();
    renderWithIntl(<JobPostForm initialValues={SAVED} ai={READY} />);

    expect(screen.getByText("All changes saved")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove TypeScript" }));
    await user.type(
      screen.getByRole("textbox", { name: "Other names, React" }),
      "ReactJS 19{Enter}",
    );
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(saveJobPost).toHaveBeenCalledWith(
      expect.objectContaining({
        id: JOB_ID,
        expectedUpdatedAt: "2026-10-23T09:00:00+00:00",
        requirements: expect.objectContaining({
          items: [expect.objectContaining({ label: "React", aliases: ["React.js", "ReactJS 19"] })],
        }),
      }),
    );
    expect(await screen.findByText("Saved")).toBeInTheDocument();
    expect(mocks.router.replace).not.toHaveBeenCalled();
  });

  it("refuses a name used by two requirements before saving", async () => {
    const user = userEvent.setup();
    renderWithIntl(<JobPostForm initialValues={SAVED} ai={READY} />);

    const [, second] = labelInputs();
    await user.clear(second!);
    await user.type(second!, "reactjs");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText("This name is already used by another requirement, or twice here."),
    ).toBeInTheDocument();
    expect(saveJobPost).not.toHaveBeenCalled();
  });

  it("analyzes again after confirmation, replacing the requirements in the form only", async () => {
    const user = userEvent.setup();
    vi.mocked(analyzeJobPost).mockResolvedValue({
      ok: true,
      data: {
        ...DRAFT,
        requirements: { ...DRAFT.requirements, items: [requirement(9, "GraphQL")] },
      },
    });
    renderWithIntl(
      <JobPostForm initialValues={SAVED} ai={READY} analyzedAt="2026-10-20T10:00:00Z" />,
    );

    expect(screen.getByText(/Requirements found by AI on/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Analyze again" }));
    const dialog = screen.getByRole("alertdialog", { name: "Analyze the job post again?" });
    await user.click(within(dialog).getByRole("button", { name: "Analyze again" }));

    expect(analyzeJobPost).toHaveBeenCalledWith({ description: POST });
    expect(await screen.findByText(/New requirements from the AI/)).toBeInTheDocument();
    expect(labelInputs().map((input) => (input as HTMLInputElement).value)).toEqual(["GraphQL"]);
    expect(saveJobPost).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(saveJobPost).toHaveBeenCalledWith(expect.objectContaining({ analyzed: true }));
  });

  it("shows why a new analysis failed and keeps the requirements", async () => {
    const user = userEvent.setup();
    vi.mocked(analyzeJobPost).mockResolvedValue({
      ok: false,
      error: "ai_timeout",
      provider: "groq",
    });
    renderWithIntl(<JobPostForm initialValues={SAVED} ai={READY} />);

    await user.click(screen.getByRole("button", { name: "Analyze again" }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Analyze again" }),
    );

    expect(await screen.findByText(/Groq took too long to answer/)).toBeInTheDocument();
    expect(labelInputs()).toHaveLength(2);
  });

  it("hides Analyze again when AI cannot run or the text is too short", () => {
    const { unmount } = renderWithIntl(
      <JobPostForm initialValues={SAVED} ai={{ ...READY, state: "off" }} />,
    );
    expect(screen.queryByRole("button", { name: "Analyze again" })).not.toBeInTheDocument();
    unmount();
    renderWithIntl(<JobPostForm initialValues={{ ...SAVED, description: "Short" }} ai={READY} />);
    expect(screen.queryByRole("button", { name: "Analyze again" })).not.toBeInTheDocument();
  });

  it("offers to reload when the job post changed elsewhere", async () => {
    const user = userEvent.setup();
    vi.mocked(saveJobPost).mockResolvedValue({ ok: false, error: "stale" });
    renderWithIntl(<JobPostForm initialValues={SAVED} ai={READY} />);

    await user.type(screen.getByRole("textbox", { name: "Job title" }), " II");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(await screen.findByRole("button", { name: "Reload latest" }));

    expect(mocks.router.refresh).toHaveBeenCalled();
  });

  it("explains other save failures", async () => {
    const user = userEvent.setup();
    vi.mocked(saveJobPost).mockResolvedValue({ ok: false, error: "not_found" });
    renderWithIntl(<JobPostForm initialValues={SAVED} ai={READY} />);

    await user.type(screen.getByRole("textbox", { name: /^Company/ }), " Ltd");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText(/This job post no longer exists/)).toBeInTheDocument();
  });

  it("tells the score panel when edits are unsaved", async () => {
    const user = userEvent.setup();
    renderWithIntl(
      <JobPostForm
        initialValues={SAVED}
        ai={READY}
        aside={(dirty) => <p>{dirty ? "dirty" : "clean"}</p>}
      />,
    );
    expect(screen.getByText("clean")).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: /^Company/ }), "!");
    expect(screen.getByText("dirty")).toBeInTheDocument();
  });

  it("works in French", () => {
    renderWithIntl(<JobPostForm initialValues={SAVED} ai={READY} />, { locale: "fr" });
    expect(screen.getByRole("heading", { name: "Exigences" })).toBeInTheDocument();
    expect(
      within(screen.getByRole("group", { name: "Importance de React" })).getByRole("radio", {
        name: "Requise",
      }),
    ).toBeChecked();
    expect(screen.getByText("2 exigences · 2 requises")).toBeInTheDocument();
  });
});
