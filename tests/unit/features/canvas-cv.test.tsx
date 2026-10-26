import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createDefaultDefinition } from "@/features/cv-builder/defaults";
import { resolveCv } from "@/features/cv-builder/resolve";
import { createBlankDesign, type Design, type ElementContent } from "@/features/cv-design/design";
import { addElement, createElement } from "@/features/cv-design/operations";
import { CanvasCv, sectionsByKey } from "@/features/cv-renderer/canvas-v1/canvas-cv";
import { buildMasterData, IDS, LABELS, sequentialIds } from "../../fixtures/master-data";

// next/font only works inside the Next.js compiler.
vi.mock("@/features/cv-renderer/fonts", () => ({
  poppins: { className: "font-poppins" },
  inter: { className: "font-inter" },
  lora: { className: "font-lora" },
}));

const master = buildMasterData();
const definition = createDefaultDefinition(master, sequentialIds());
const resolve = (locale: "en" | "fr") => resolveCv(definition, master, locale, LABELS[locale]).cv;

let counter = 0;
const nextId = () => `20000000-0000-4000-8000-${String((counter += 1)).padStart(12, "0")}`;

function designOf(...contents: ElementContent[]): Design {
  return contents.reduce(
    (design, content) => addElement(design, createElement(design, content, { newId: nextId })),
    createBlankDesign(),
  );
}

const NAME: ElementContent = { type: "field", field: "name", inline: false };
const EXPERIENCE: ElementContent = {
  type: "section",
  section: "experience",
  showTitle: true,
  rule: true,
  columns: 1,
};
const VOLUNTEERING: ElementContent = {
  type: "custom",
  refId: IDS.custom,
  showTitle: true,
  rule: false,
};

describe("CanvasCv", () => {
  it("draws decorations first, then the text in reading order", () => {
    const design = designOf(
      NAME,
      { type: "shape" },
      EXPERIENCE,
      { type: "line" },
      { type: "text", text: { shared: "Contact" } },
    );
    const { container } = render(
      <CanvasCv
        design={design}
        definition={definition}
        cv={resolve("en")}
        labels={LABELS.en}
        photoUrl={null}
      />,
    );

    expect(container.querySelector("article")).toHaveAttribute("data-visual-template", "canvas-v1");
    const drawn = [...container.querySelectorAll("[data-element-id]")].map((node) =>
      node.getAttribute("data-element-id"),
    );
    const byType = (type: string) =>
      design.elements
        .filter((element) => element.content.type === type)
        .map((element) => element.id);
    expect(drawn).toEqual([
      ...byType("shape"),
      ...byType("line"),
      ...design.elements
        .filter((element) => !["shape", "line"].includes(element.content.type))
        .map((element) => element.id),
    ]);
    // Decorations hold no text and stay out of the accessibility tree.
    expect(container.querySelector(`[data-element-id="${byType("shape")[0]}"]`)).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(screen.getByRole("heading", { level: 1, name: "Alex Example" })).toBeInTheDocument();
    expect(container.querySelector('[data-section-kind="experience"]')).not.toBeNull();
    expect(screen.getByText("Contact")).toBeInTheDocument();
  });

  it("binds custom sections by their career record", () => {
    const cv = resolve("en");
    const sections = sectionsByKey(definition, cv);
    expect(sections.get(`custom:${IDS.custom}`)?.kind).toBe("custom");
    expect(sections.get("section:experience")?.kind).toBe("experience");

    render(
      <CanvasCv
        design={designOf(VOLUNTEERING)}
        definition={definition}
        cv={cv}
        labels={LABELS.en}
        photoUrl={null}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Volunteering" })).toBeInTheDocument();
  });

  it("marks text missing in the CV's language, and shows placeholders only in the designer", () => {
    const design = designOf(
      { type: "text", text: { en: "Only in English" } },
      { type: "section", section: "summary", showTitle: true, rule: true, columns: 1 },
      { type: "photo", shape: "circle" },
    );
    const { container, rerender } = render(
      <CanvasCv
        design={design}
        definition={definition}
        cv={resolve("fr")}
        labels={LABELS.fr}
        photoUrl={null}
      />,
    );
    expect(screen.getByText("Only in English")).toHaveAttribute("data-missing");
    // Elsewhere an element with nothing to show is simply empty.
    expect(container.textContent).not.toContain("nothing to show");

    rerender(
      <CanvasCv
        design={design}
        definition={definition}
        cv={resolve("fr")}
        labels={LABELS.fr}
        photoUrl="https://storage.test/portrait.png"
        placeholder={(element) => `${element.content.type}: nothing to show`}
      />,
    );
    expect(screen.getByText("section: nothing to show")).toBeInTheDocument();
    expect(within(container).getByRole("img")).toHaveAttribute(
      "src",
      "https://storage.test/portrait.png",
    );
  });

  it("lays out each page of the design", () => {
    const design = { ...designOf(NAME), pages: 2 };
    const { container } = render(
      <CanvasCv
        design={design}
        definition={definition}
        cv={resolve("en")}
        labels={LABELS.en}
        photoUrl={null}
      />,
    );
    expect(container.querySelectorAll("[data-page]")).toHaveLength(2);
  });
});
