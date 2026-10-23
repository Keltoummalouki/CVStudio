import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JobPostList } from "@/features/job-posts/components/job-post-list";
import { DeleteJobPostButton } from "@/features/job-posts/components/job-post-workspace";
import { deleteJobPost, restoreJobPost } from "@/features/job-posts/server/actions";
import type { JobPostSummary } from "@/features/job-posts/server/queries";
import type * as Navigation from "@/lib/i18n/navigation";
import { renderWithIntl } from "../../utils/render";

const mocks = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn() },
  push: vi.fn(),
}));

vi.mock("@/features/job-posts/server/actions", () => ({
  deleteJobPost: vi.fn(),
  restoreJobPost: vi.fn(),
  saveJobPost: vi.fn(),
  analyzeJobPost: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: mocks.toast }));
vi.mock("@/lib/i18n/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof Navigation>()),
  useRouter: () => ({ push: mocks.push, replace: vi.fn(), refresh: vi.fn() }),
}));

const JOBS: JobPostSummary[] = [
  {
    id: "job-1",
    title: "Frontend developer",
    company: "Acme",
    language: "en",
    updatedAt: "2026-10-23T09:00:00Z",
    analyzedAt: "2026-10-23T08:00:00Z",
    required: 4,
    preferred: 1,
    careerScore: 89,
    best: { cvId: "cv-1", cvName: "Frontend — EN", score: 72 },
  },
  {
    id: "job-2",
    title: "Data engineer",
    company: "",
    language: "other",
    updatedAt: "2026-10-20T09:00:00Z",
    analyzedAt: null,
    required: 0,
    preferred: 0,
    careerScore: null,
    best: null,
  },
];

beforeEach(() => {
  vi.mocked(deleteJobPost).mockReset().mockResolvedValue({ ok: true, data: undefined });
  vi.mocked(restoreJobPost).mockReset().mockResolvedValue({ ok: true, data: undefined });
  mocks.toast.success.mockReset();
  mocks.toast.error.mockReset();
  mocks.push.mockReset();
});

describe("JobPostList", () => {
  it("lists each job post with its requirements and best match", () => {
    renderWithIntl(<JobPostList jobs={JOBS} />);

    expect(screen.getByRole("link", { name: "Frontend developer" })).toHaveAttribute(
      "href",
      "/en/dashboard/jobs/job-1",
    );
    expect(screen.getByText("Acme · English")).toBeInTheDocument();
    expect(screen.getByText("4 required · 1 nice to have")).toBeInTheDocument();
    expect(screen.getByText("Best match 72% · Frontend — EN")).toBeInTheDocument();
    expect(screen.getByText("Your career 89%")).toBeInTheDocument();
    // A post without requirements has no career score.
    expect(screen.getAllByText(/^Your career/)).toHaveLength(1);
    expect(screen.getByText("Other language")).toBeInTheDocument();
    expect(screen.getByText("No requirements yet")).toBeInTheDocument();
  });

  it("deletes after confirmation, with Undo", async () => {
    const user = userEvent.setup();
    renderWithIntl(<JobPostList jobs={JOBS} />);

    await user.click(screen.getByRole("button", { name: "More actions for Frontend developer" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
    const dialog = screen.getByRole("alertdialog", { name: "Delete “Frontend developer”?" });
    expect(
      within(dialog).getByText(/Your CVs and career data are not affected/),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(deleteJobPost).toHaveBeenCalledWith("job-1");
    const [message, options] = mocks.toast.success.mock.calls[0] as [
      string,
      { action: { label: string; onClick: () => void } },
    ];
    expect(message).toBe("“Frontend developer” deleted");
    expect(options.action.label).toBe("Undo");
    options.action.onClick();
    expect(restoreJobPost).toHaveBeenCalledWith("job-1");
  });

  it("keeps the dialog open with an explanation when the delete fails", async () => {
    const user = userEvent.setup();
    vi.mocked(deleteJobPost).mockResolvedValue({ ok: false, error: "unavailable" });
    renderWithIntl(<JobPostList jobs={JOBS} />);

    await user.click(screen.getByRole("button", { name: "More actions for Data engineer" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }),
    );

    expect(await screen.findByText(/Couldn’t complete this action/)).toBeInTheDocument();
    expect(mocks.toast.success).not.toHaveBeenCalled();
  });

  it("deletes from the job page and goes back to the list", async () => {
    const user = userEvent.setup();
    vi.mocked(deleteJobPost).mockResolvedValueOnce({ ok: false, error: "not_found" });
    renderWithIntl(<DeleteJobPostButton id="job-1" title="Frontend developer" />);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }),
    );

    expect(mocks.push).toHaveBeenCalledWith("/dashboard/jobs");
    expect(mocks.toast.error).toHaveBeenCalledWith("That didn’t work. Nothing was changed.");
  });
});
