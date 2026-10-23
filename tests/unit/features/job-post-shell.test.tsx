import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JobPostSkeleton } from "@/features/job-posts/components/job-post-skeleton";
import { JobPostWorkspace } from "@/features/job-posts/components/job-post-workspace";
import { ScoreMeter } from "@/features/job-posts/components/score-meter";
import { NEW_JOB_POST } from "@/features/job-posts/schemas";
import type * as Navigation from "@/lib/i18n/navigation";
import { renderWithIntl } from "../../utils/render";

vi.mock("@/features/job-posts/server/actions", () => ({
  saveJobPost: vi.fn(),
  analyzeJobPost: vi.fn(),
  deleteJobPost: vi.fn(),
  restoreJobPost: vi.fn(),
}));
vi.mock("@/lib/i18n/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof Navigation>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

describe("job post page pieces", () => {
  it.each(["new", "detail"] as const)("announces loading for the %s page", (variant) => {
    renderWithIntl(<JobPostSkeleton variant={variant} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
  });

  it("shows no number when a CV cannot be scored", () => {
    renderWithIntl(<ScoreMeter score={null} />);
    expect(screen.getByText("No score")).toBeInTheDocument();
  });

  it("puts the career match, then the CV scores, above the editor of a saved job post", () => {
    renderWithIntl(
      <JobPostWorkspace
        page={{
          values: { ...NEW_JOB_POST, id: "5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a", title: "QA" },
          analyzedAt: null,
          career: {
            score: null,
            required: { matched: 0, total: 0 },
            preferred: { matched: 0, total: 0 },
            hidden: 0,
            title: { status: "none", evidence: [] },
            requirements: [],
          },
          matches: [],
        }}
        ai={{
          state: "off",
          fake: false,
          providers: ["groq", "gemini"],
          remaining: 0,
          resetsAt: "2026-10-24T00:00:00Z",
        }}
      />,
    );
    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);
    expect(headings).toEqual([
      "Your career and this job",
      "How your CVs match",
      "The job",
      "Requirements",
      "Job post text",
    ]);
  });
});
