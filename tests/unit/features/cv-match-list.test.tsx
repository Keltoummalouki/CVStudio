import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CvMatchList } from "@/features/job-posts/components/cv-match-list";
import { compileRequirements, indexTexts, matchCv } from "@/features/job-posts/matching";
import type { RequirementsDocument } from "@/features/job-posts/schemas";
import type { CvMatch } from "@/features/job-posts/server/queries";
import { renderWithIntl } from "../../utils/render";

const requirement = (
  id: number,
  label: string,
  importance: "required" | "preferred",
  note = "",
) => ({
  id: `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
  label,
  kind: "skill" as const,
  importance,
  aliases: [],
  note,
});

const REQUIREMENTS: RequirementsDocument = {
  schemaVersion: 1,
  titleAliases: [],
  items: [
    requirement(1, "React", "required", "3+ years"),
    requirement(2, "Docker", "required"),
    requirement(3, "GraphQL", "preferred"),
  ],
};

const report = matchCv(
  compileRequirements("Frontend developer", REQUIREMENTS),
  indexTexts([
    {
      text: "Frontend developer",
      where: { scope: "cv", field: "headerTitle", section: null, item: null },
    },
    {
      text: "Built dashboards in React for retail teams",
      where: { scope: "cv", field: "bullet", section: "Experience", item: "Developer" },
    },
  ]),
  indexTexts([{ text: "Docker", where: { scope: "career", record: "skills", item: "Tools" } }]),
);

const MATCHES: CvMatch[] = [
  { cvId: "cv-1", cvName: "Frontend — EN", locale: "en", updatedAt: "2026-10-22", report },
  { cvId: "cv-2", cvName: "Old layout", locale: "fr", updatedAt: "2026-10-20", report: null },
];

describe("CvMatchList", () => {
  it("shows each CV's estimated coverage with its counts and checks", () => {
    renderWithIntl(<CvMatchList matches={MATCHES} hasRequirements dirty={false} />);

    expect(screen.getByRole("heading", { name: "How your CVs match" })).toBeInTheDocument();
    expect(screen.getByText(/Estimated keyword coverage: how many/)).toBeInTheDocument();
    const row = within(screen.getByText("Frontend — EN").closest("li")!);
    // React (2) of React (2) + Docker (2) + GraphQL (1).
    expect(row.getByText("Estimated keyword coverage: 40 percent")).toBeInTheDocument();
    expect(row.getByText(/required 1\/2 · nice to have 0\/1/)).toBeInTheDocument();
    expect(row.getByText("Job title found")).toBeInTheDocument();
    expect(row.getByText("1 more in your career data")).toBeInTheDocument();
    expect(row.getByRole("link", { name: "Open CV: Frontend — EN" })).toHaveAttribute(
      "href",
      "/en/dashboard/cvs/cv-1",
    );
    expect(screen.getByText("This CV’s layout couldn’t be read.")).toBeInTheDocument();
    // The first CV is the best one; the unreadable one is not.
    expect(row.getByText("Best match")).toBeInTheDocument();
    expect(screen.getAllByText("Best match")).toHaveLength(1);
  });

  it("names no best match when the best CV covers nothing", () => {
    const nothing = matchCv(compileRequirements("", REQUIREMENTS), indexTexts([]), null);
    renderWithIntl(
      <CvMatchList matches={[{ ...MATCHES[0]!, report: nothing }]} hasRequirements dirty={false} />,
    );
    expect(screen.getByText("Estimated keyword coverage: 0 percent")).toBeInTheDocument();
    expect(screen.queryByText("Best match")).not.toBeInTheDocument();
  });

  it("explains, on demand, where each requirement was found or why not", async () => {
    const user = userEvent.setup();
    renderWithIntl(<CvMatchList matches={MATCHES} hasRequirements dirty={false} />);

    const toggle = screen.getByRole("button", { name: "Details: Frontend — EN" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    const found = screen.getByRole("region", { name: "Found in this CV (1)" });
    expect(within(found).getByText("React", { selector: "span" })).toBeInTheDocument();
    expect(within(found).getByText("3+ years")).toBeInTheDocument();
    expect(within(found).getByText("Experience · Developer · Achievement")).toBeInTheDocument();
    expect(within(found).getByText("React", { selector: "mark" })).toBeInTheDocument();

    const hidden = screen.getByRole("region", {
      name: "In your career data, not shown in this CV (1)",
    });
    expect(within(hidden).getByText("Technical skills · Tools")).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Not found (1)" })).getByText("GraphQL"),
    ).toBeInTheDocument();
    expect(screen.getByText("Header · CV title")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Hide details: Frontend — EN" }));
    expect(screen.queryByRole("region", { name: "Found in this CV (1)" })).not.toBeInTheDocument();
  });

  it("shows the best five CVs, and the others on request", async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 7 }, (_, index) => ({
      ...MATCHES[0]!,
      cvId: `cv-${index}`,
      cvName: `CV ${index}`,
    }));
    renderWithIntl(<CvMatchList matches={many} hasRequirements dirty={false} />);

    expect(screen.getAllByRole("button", { name: /^Details: / })).toHaveLength(5);
    const toggle = screen.getByRole("button", { name: "Show all 7 CVs" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(screen.getAllByRole("button", { name: /^Details: / })).toHaveLength(7);
    await user.click(screen.getByRole("button", { name: "Show the best 5" }));
    expect(screen.getAllByRole("button", { name: /^Details: / })).toHaveLength(5);
  });

  it("leaves out an importance the job does not use", () => {
    const requiredOnly = matchCv(
      compileRequirements("", { ...REQUIREMENTS, items: REQUIREMENTS.items.slice(0, 2) }),
      indexTexts([
        { text: "React", where: { scope: "cv", field: "skill", section: "Skills", item: null } },
      ]),
      null,
    );
    renderWithIntl(
      <CvMatchList
        matches={[{ ...MATCHES[0]!, report: requiredOnly }]}
        hasRequirements
        dirty={false}
      />,
    );
    expect(screen.getByText("English · required 1/2")).toBeInTheDocument();
  });

  it("says when scores describe the saved requirements, not the edits", () => {
    renderWithIntl(<CvMatchList matches={MATCHES} hasRequirements dirty />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "The scores use the saved requirements. Save to update them.",
    );
  });

  it("guides the owner when there is nothing to score", () => {
    const { unmount } = renderWithIntl(<CvMatchList matches={[]} hasRequirements dirty={false} />);
    expect(screen.getByRole("link", { name: "Create a CV" })).toHaveAttribute(
      "href",
      "/en/dashboard/cvs/new",
    );
    unmount();
    renderWithIntl(<CvMatchList matches={MATCHES} hasRequirements={false} dirty={false} />);
    expect(screen.getByText("Add requirements to score your CVs.")).toBeInTheDocument();
  });

  it("documents how the score works", async () => {
    const user = userEvent.setup();
    renderWithIntl(<CvMatchList matches={MATCHES} hasRequirements dirty={false} />, {
      locale: "fr",
    });
    await user.click(screen.getByText("Comment le score est calculé"));
    expect(screen.getByText(/Les exigences requises comptent double/)).toBeVisible();
    expect(screen.getByText(/n’est pas trouvé dans/)).toBeVisible();
  });
});
