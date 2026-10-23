import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CareerMatch } from "@/features/job-posts/components/career-match";
import { compileRequirements, indexTexts, matchCv } from "@/features/job-posts/matching";
import type { RequirementsDocument } from "@/features/job-posts/schemas";
import { renderWithIntl } from "../../utils/render";

const requirement = (id: number, label: string, importance: "required" | "preferred") => ({
  id: `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
  label,
  kind: "skill" as const,
  importance,
  aliases: [],
  note: "",
});

const REQUIREMENTS: RequirementsDocument = {
  schemaVersion: 1,
  titleAliases: [],
  items: [
    requirement(1, "React", "required"),
    requirement(2, "Docker", "required"),
    requirement(3, "GraphQL", "preferred"),
  ],
};

/** As the job page builds it: all career data is the searched text. */
const report = matchCv(
  compileRequirements("Frontend developer", REQUIREMENTS),
  indexTexts([
    {
      text: "Built dashboards in React for retail teams",
      where: { scope: "career", record: "experience", item: "Developer" },
    },
    { text: "Docker", where: { scope: "career", record: "skills", item: "Tools" } },
  ]),
  null,
);

describe("CareerMatch", () => {
  it("shows which requirements the career data has and which it lacks", () => {
    renderWithIntl(<CareerMatch report={report} dirty={false} />);

    expect(screen.getByRole("heading", { name: "Your career and this job" })).toBeInTheDocument();
    expect(screen.getByText("2 of 3 requirements found in your career data")).toBeInTheDocument();
    // React (2) + Docker (2) of 2 + 2 + 1.
    expect(screen.getByText("Estimated keyword coverage: 80 percent")).toBeInTheDocument();
    expect(screen.getByText("required 2/2 · nice to have 0/1")).toBeInTheDocument();

    const have = within(screen.getByRole("region", { name: "In your career data (2)" }));
    expect(have.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "React, Required",
      "Docker, Required",
    ]);
    const lack = within(screen.getByRole("region", { name: "Not in your career data (1)" }));
    expect(lack.getByRole("listitem")).toHaveTextContent("GraphQL, Nice to have");
    expect(lack.getByText(/Add them only if they’re true/)).toBeInTheDocument();
    expect(lack.getByRole("link", { name: "Open career data" })).toHaveAttribute(
      "href",
      "/en/dashboard/content",
    );
  });

  it("shows where each requirement is, on request", async () => {
    const user = userEvent.setup();
    renderWithIntl(<CareerMatch report={report} dirty={false} />);

    const toggle = screen.getByRole("button", { name: "Show where each one is" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Experience · Developer")).not.toBeInTheDocument();

    await user.click(toggle);
    expect(screen.getByRole("button", { name: "Hide where each one is" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    const where = within(screen.getByRole("region", { name: "Where each one appears" }));
    expect(where.getByText("Experience · Developer")).toBeInTheDocument();
    expect(where.getByText("Technical skills · Tools")).toBeInTheDocument();
    expect(where.getByText("React", { selector: "mark" })).toBeInTheDocument();
  });

  it("says when the career data has everything, or nothing", () => {
    const everything = matchCv(
      compileRequirements("", { ...REQUIREMENTS, items: REQUIREMENTS.items.slice(0, 1) }),
      indexTexts([{ text: "React", where: { scope: "career", record: "skills", item: null } }]),
      null,
    );
    const { unmount } = renderWithIntl(<CareerMatch report={everything} dirty={false} />);
    expect(screen.getByText("1 of 1 requirement found in your career data")).toBeInTheDocument();
    expect(screen.getByText("Your career data mentions every requirement.")).toBeInTheDocument();
    unmount();

    const nothing = matchCv(compileRequirements("", REQUIREMENTS), indexTexts([]), null);
    renderWithIntl(<CareerMatch report={nothing} dirty={false} />);
    expect(
      screen.getByText("None of these requirements appears in your career data yet."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /where each one is/ })).not.toBeInTheDocument();
  });

  it("asks for requirements first, and says when edits are not saved", () => {
    const empty = matchCv(
      compileRequirements("", { ...REQUIREMENTS, items: [] }),
      indexTexts([]),
      null,
    );
    renderWithIntl(<CareerMatch report={empty} dirty />);
    expect(
      screen.getByText("Add requirements below to compare them with your career data."),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "The scores use the saved requirements. Save to update them.",
    );
  });

  it("speaks French", () => {
    renderWithIntl(<CareerMatch report={report} dirty={false} />, { locale: "fr" });
    expect(screen.getByRole("heading", { name: "Votre parcours et cette offre" })).toBeVisible();
    expect(
      screen.getByText("2 sur 3 exigences trouvées dans vos données de carrière"),
    ).toBeInTheDocument();
  });
});
