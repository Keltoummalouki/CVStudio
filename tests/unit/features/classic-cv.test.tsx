import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createDefaultDefinition } from "@/features/cv-builder/defaults";
import type { CvDefinition } from "@/features/cv-builder/definition";
import { reorderSections, setHeader, setSectionVisible } from "@/features/cv-builder/operations";
import { resolveCv, type ResolvedSectionOf } from "@/features/cv-builder/resolve";
import type { Locale } from "@/lib/i18n/config";
import { buildMasterData, LABELS, sequentialIds } from "../../fixtures/master-data";

// next/font only works inside the Next.js compiler.
vi.mock("@/features/cv-renderer/fonts", () => ({ poppins: { className: "font-poppins" } }));

const { ClassicCv, CLASSIC_REFERENCE_V1 } =
  await import("@/features/cv-renderer/classic-reference-v1/classic-cv");

const master = buildMasterData();
const baseDefinition = createDefaultDefinition(master, sequentialIds());
const PHOTO_URL = "https://storage.test/signed/portrait.png";

function renderCv({
  definition = baseDefinition,
  locale = "en",
  photoUrl = PHOTO_URL,
}: { definition?: CvDefinition; locale?: Locale; photoUrl?: string | null } = {}) {
  const { cv } = resolveCv(definition, master, locale, LABELS[locale]);
  const view = render(<ClassicCv cv={cv} labels={LABELS[locale]} photoUrl={photoUrl} />);
  return { cv, ...view };
}

const sectionKinds = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("section")).map((section) => section.dataset.sectionKind);

const nodeOf = (definition: CvDefinition, kind: string) =>
  definition.sections.find((section) => section.kind === kind)!.nodeId;

describe("classic-reference-v1 renderer", () => {
  it("identifies the template and the CV's language for print, PDF and screen readers", () => {
    const { container } = renderCv({ locale: "fr" });
    const page = container.querySelector("article")!;

    expect(page).toHaveAttribute("lang", "fr");
    expect(page).toHaveAttribute("data-visual-template", CLASSIC_REFERENCE_V1);
    expect(page.className).toContain("font-poppins");
  });

  it("renders the title as the main heading and every visible section in order", () => {
    const { cv, container } = renderCv();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Full stack web developer");
    expect(screen.getByText("Alex Example")).toBeInTheDocument();
    expect(sectionKinds(container)).toEqual(cv.sections.map((section) => section.kind));
    expect(
      screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(cv.sections.map((section) => section.title.text));
    expect(screen.getByRole("heading", { name: "Professional experience" })).toBeInTheDocument();
  });

  it("follows the CV's own section order and leaves hidden sections out", () => {
    const experience = nodeOf(baseDefinition, "experience");
    const education = nodeOf(baseDefinition, "education");
    const reordered = reorderSections(baseDefinition, [education, experience]);
    const hidden = setSectionVisible(reordered, nodeOf(baseDefinition, "projects"), false);

    const { container } = renderCv({ definition: hidden });
    const kinds = sectionKinds(container);

    expect(kinds.slice(0, 2)).toEqual(["education", "experience"]);
    expect(kinds).not.toContain("projects");
    expect(screen.queryByRole("heading", { name: "Projects" })).not.toBeInTheDocument();
  });

  it("shows the portrait only when the CV asks for it and a URL exists", () => {
    renderCv();
    expect(screen.getByRole("img", { name: "Portrait" })).toHaveAttribute("src", PHOTO_URL);
  });

  it.each([
    ["the CV hides it", setHeader(baseDefinition, { showPhoto: false }), PHOTO_URL],
    ["no signed URL is available", baseDefinition, null],
  ])("omits the portrait when %s", (_reason, definition, photoUrl) => {
    renderCv({ definition, photoUrl });
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("makes the name the main heading when the title is hidden", () => {
    renderCv({ definition: setHeader(baseDefinition, { showTitle: false }) });

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Alex Example");
  });

  it("keeps contact links and profile links live in the document", () => {
    renderCv();

    expect(screen.getByRole("link", { name: "alex@example.com" })).toHaveAttribute(
      "href",
      "mailto:alex@example.com",
    );
    expect(screen.getByRole("link", { name: "alex-example" })).toHaveAttribute(
      "href",
      "https://github.com/alex-example",
    );
  });

  it("lays out an entry as heading, right-hand date, bullets and technologies", () => {
    const { cv, container } = renderCv();
    const section = cv.sections.find(
      (candidate): candidate is ResolvedSectionOf<"experience"> => candidate.kind === "experience",
    )!;
    const entry = section.entries[0]!;
    const element = within(
      container.querySelector('[data-section-kind="experience"]') as HTMLElement,
    );

    const heading = [entry.title?.text, entry.subtitle?.text].filter(Boolean).join(" – ");
    expect(
      element.getByText(
        (_, node) => node?.tagName === "P" && node.textContent?.startsWith(heading) === true,
      ),
    ).toBeInTheDocument();
    expect(element.getByText(entry.date!)).toBeInTheDocument();
    expect(element.getAllByRole("listitem").map((item) => item.textContent)).toEqual(
      expect.arrayContaining(
        entry.body.filter((block) => block.kind === "bullet").map((block) => block.text.text),
      ),
    );
    expect(element.getByText("Technologies & tools used:")).toBeInTheDocument();
    expect(element.getByText("TypeScript")).toBeInTheDocument();
  });

  it("marks text that is missing in the CV's language instead of hiding it", () => {
    const { container } = renderCv({ locale: "fr" });

    const missing = container.querySelectorAll("[data-missing]");
    expect(missing.length).toBeGreaterThan(0);
    // The English-only achievement shows as missing on the French CV.
    expect(Array.from(missing, (node) => node.textContent)).toContain("Improved the interface");
  });

  it("splits technical skills into two columns of labelled groups", () => {
    const { container } = renderCv();
    const skills = container.querySelector('[data-section-kind="technical_skills"]')!;

    expect(skills.textContent).toContain("Languages: TypeScript, SQL");
    expect(skills.textContent).toContain("Version control: Git");
    expect(skills.textContent).not.toContain("Perl");
  });

  it("uses French labels with a non-breaking space before colons", () => {
    const { container } = renderCv({ locale: "fr" });

    // A plain space would let the colon wrap onto its own line.
    expect(container.textContent).toMatch(/Technologies & outils utilisés[  ]:/);
    expect(container.textContent).not.toContain("Technologies & outils utilisés :");
  });

  it("renders nothing in the header area when identity, photo and contacts are all hidden", () => {
    const bare = setHeader(baseDefinition, {
      showTitle: false,
      showName: false,
      showPhoto: false,
      showEmail: false,
      showPhone: false,
      showLocation: false,
      showLinks: false,
    });
    const { container } = renderCv({ definition: bare });

    expect(container.querySelector("header")).toBeNull();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "alex@example.com" })).not.toBeInTheDocument();
  });
});
