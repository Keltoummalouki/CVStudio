import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDefaultDefinition } from "@/features/cv-builder/defaults";
import { resolveCv, type ResolvedCv } from "@/features/cv-builder/resolve";
import { PageThumbnail } from "@/features/cv-renderer/page-thumbnail";
import { THUMBNAIL_LIMITS, trimForThumbnail } from "@/features/cv-renderer/thumbnail";
import { buildMasterData, LABELS, sequentialIds } from "../../fixtures/master-data";

const master = buildMasterData();
const cv = resolveCv(createDefaultDefinition(master, sequentialIds()), master, "en", LABELS.en).cv;

const text = (value: string) => ({ text: value, missing: false });
const many = <T,>(count: number, make: (index: number) => T) =>
  Array.from({ length: count }, (_, index) => make(index));

describe("trimForThumbnail", () => {
  it("keeps every section, in order, with only its first entries and bullets", () => {
    const long: ResolvedCv = {
      ...cv,
      sections: [
        {
          nodeId: "projects",
          title: text("Projects"),
          kind: "projects",
          entries: many(8, (index) => ({
            refId: `p${index}`,
            title: text(`Project ${index}`),
            subtitle: null,
            place: null,
            date: null,
            body: many(6, (bullet) => ({ kind: "bullet" as const, text: text(`b${bullet}`) })),
            technologies: [],
            links: [],
          })),
        },
        {
          nodeId: "skills",
          title: text("Skills"),
          kind: "technical_skills",
          columns: 2,
          rightStartsWith: "g9",
          groups: many(12, (index) => ({ refId: `g${index}`, title: null, skills: [] })),
        },
        {
          nodeId: "languages",
          title: text("Languages"),
          kind: "languages",
          items: many(10, (index) => ({
            refId: `l${index}`,
            text: text(`L${index}`),
            detail: null,
          })),
        },
        {
          nodeId: "custom",
          title: text("Volunteering"),
          kind: "custom",
          subsections: many(4, (index) => ({
            refId: `s${index}`,
            title: null,
            items: many(5, (item) => ({
              refId: `i${item}`,
              kind: "bullet" as const,
              label: null,
              text: text(`i${item}`),
            })),
          })),
        },
        { nodeId: "summary", title: text("Profile"), kind: "summary", text: text("Hello") },
      ],
    };

    const trimmed = trimForThumbnail(long);
    expect(trimmed.header).toBe(long.header);
    expect(trimmed.sections.map((section) => section.nodeId)).toEqual([
      "projects",
      "skills",
      "languages",
      "custom",
      "summary",
    ]);
    const [projects, skills, languages, custom, summary] = trimmed.sections;
    if (projects?.kind !== "projects") throw new Error("projects first");
    expect(projects.entries).toHaveLength(THUMBNAIL_LIMITS.entries);
    expect(projects.entries[0]?.body).toHaveLength(THUMBNAIL_LIMITS.bullets);
    if (skills?.kind !== "technical_skills") throw new Error("skills second");
    expect(skills.groups).toHaveLength(THUMBNAIL_LIMITS.groups);
    if (languages?.kind !== "languages") throw new Error("languages third");
    expect(languages.items).toHaveLength(THUMBNAIL_LIMITS.items);
    if (custom?.kind !== "custom") throw new Error("custom fourth");
    expect(custom.subsections).toHaveLength(THUMBNAIL_LIMITS.subsections);
    expect(custom.subsections[0]?.items).toHaveLength(THUMBNAIL_LIMITS.bullets);
    expect(summary).toBe(long.sections[4]);
    // The source is left untouched.
    expect(long.sections[0]?.kind === "projects" && long.sections[0].entries).toHaveLength(8);
  });

  it("changes nothing in a short CV", () => {
    expect(trimForThumbnail(cv)).toEqual(cv);
  });
});

describe("PageThumbnail", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is a picture: hidden from assistive technology, never focusable", () => {
    render(
      <PageThumbnail>
        <a href="https://example.com">Portfolio</a>
      </PageThumbnail>,
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    const frame = screen.getByText("Portfolio").closest("[aria-hidden]");
    expect(frame).toHaveAttribute("aria-hidden", "true");
    expect(frame).toHaveAttribute("inert");
  });

  it("scales the A4 page to the frame's width once measured", () => {
    let resize: () => void = () => {};
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          resize = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    const width = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(0);
    render(<PageThumbnail>page</PageThumbnail>);
    const page = screen.getByText("page");
    // Not measured yet: nothing is shown at the wrong size.
    expect(page).toHaveClass("invisible");

    // 210 mm is 793.7 px at 96 dpi: a 397 px frame shows the page at half size.
    width.mockReturnValue(396.85);
    act(() => resize());
    expect(page).not.toHaveClass("invisible");
    expect(Number(page.style.zoom)).toBeCloseTo(0.5, 3);
    width.mockRestore();
  });
});
