import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GettingStarted } from "@/features/dashboard/components/getting-started";
import { OverviewCounts } from "@/features/dashboard/components/overview-counts";
import { RecentCvs } from "@/features/dashboard/components/recent-cvs";
import type { RecentCv } from "@/features/dashboard/overview";
import { MESSAGES, renderWithIntl } from "../../utils/render";

const NOTHING_DONE = { profile: false, careerRecords: false, cv: false, template: false };

describe("OverviewCounts", () => {
  it("labels every figure for assistive technology", () => {
    renderWithIntl(<OverviewCounts counts={{ careerRecords: 12, cvs: 3, templates: 1 }} />);
    const summary = screen.getByRole("region", { name: MESSAGES.en.overview.counts.label });
    const terms = within(summary)
      .getAllByRole("term")
      .map((term) => term.textContent);
    expect(terms).toEqual([
      MESSAGES.en.overview.counts.careerRecords,
      MESSAGES.en.overview.counts.cvs,
      MESSAGES.en.overview.counts.templates,
      MESSAGES.en.overview.counts.sections,
    ]);
    const values = within(summary)
      .getAllByRole("definition")
      .map((value) => value.textContent);
    expect(values).toEqual(["12", "3", "1", "8"]);
  });
});

describe("GettingStarted", () => {
  it("marks the first incomplete step as current and reports progress", () => {
    renderWithIntl(<GettingStarted setup={{ ...NOTHING_DONE, profile: true }} />);

    expect(screen.getByText("1 of 4 done")).toBeInTheDocument();
    const steps = screen.getAllByRole("listitem");
    expect(steps).toHaveLength(4);
    expect(steps[1]).toHaveAttribute("aria-current", "step");
    expect(
      within(steps[0]!).getByText(MESSAGES.en.overview.gettingStarted.done),
    ).toBeInTheDocument();
  });

  it("links the next step when its editor exists", () => {
    renderWithIntl(<GettingStarted setup={NOTHING_DONE} />);
    expect(
      screen.getByRole("link", {
        name: new RegExp(MESSAGES.en.overview.gettingStarted.actions.profile),
      }),
    ).toHaveAttribute("href", "/en/dashboard/content/profile");
  });

  it("links the CV step to the new CV page once career data exists", () => {
    renderWithIntl(
      <GettingStarted setup={{ ...NOTHING_DONE, profile: true, careerRecords: true }} />,
    );
    expect(
      screen.getByRole("link", {
        name: new RegExp(MESSAGES.en.overview.gettingStarted.actions.cv),
      }),
    ).toHaveAttribute("href", "/en/dashboard/cvs/new");
  });

  it("renders in French", () => {
    renderWithIntl(<GettingStarted setup={NOTHING_DONE} />, { locale: "fr" });
    expect(screen.getByRole("heading", { name: "Pour commencer" })).toBeInTheDocument();
    expect(screen.getByText("0 sur 4 terminées")).toBeInTheDocument();
  });
});

describe("RecentCvs", () => {
  it("explains the empty state without inventing content", () => {
    renderWithIntl(<RecentCvs cvs={[]} />);
    expect(
      screen.getByRole("heading", { name: MESSAGES.en.overview.recentCvs.empty.title }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("lists CVs with language, last update and translation status", () => {
    const cvs: RecentCv[] = [
      {
        id: "a",
        name: "Frontend developer",
        locale: "en",
        updatedAt: "2026-03-14T09:30:00.000Z",
        missingTranslations: 0,
      },
      {
        id: "b",
        name: "Développeur full stack",
        locale: "fr",
        updatedAt: "2026-02-01T18:00:00.000Z",
        missingTranslations: 3,
      },
    ];
    renderWithIntl(<RecentCvs cvs={cvs} />);

    const rows = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByText("EN")).toBeInTheDocument();
    expect(within(rows[0]!).getByText("Updated Mar 14, 2026")).toBeInTheDocument();
    expect(within(rows[0]!).getByText(MESSAGES.en.overview.recentCvs.ready)).toBeInTheDocument();
    expect(
      within(rows[1]!).getByText(MESSAGES.en.overview.recentCvs.needsTranslation),
    ).toBeInTheDocument();
  });
});
