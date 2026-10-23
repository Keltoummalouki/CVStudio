import { describe, expect, it } from "vitest";
import { createDefaultDefinition } from "@/features/cv-builder/defaults";
import type { CvDefinition } from "@/features/cv-builder/definition";
import { resolveCv } from "@/features/cv-builder/resolve";
import { careerTexts, visibleCvTexts } from "@/features/job-posts/cv-texts";
import type { TextFragment } from "@/features/job-posts/matching";
import { buildMasterData, IDS, LABELS, sequentialIds } from "../../fixtures/master-data";

const master = buildMasterData();

function texts(definition: CvDefinition, locale: "en" | "fr" = "en") {
  return visibleCvTexts(resolveCv(definition, master, locale, LABELS[locale]).cv);
}

const plain = (fragments: TextFragment[]) => fragments.map((fragment) => fragment.text);

function withExperience(
  definition: CvDefinition,
  change: (
    item: Extract<CvDefinition["sections"][number], { kind: "experience" }>["items"][number],
  ) => void,
): CvDefinition {
  const copy = structuredClone(definition);
  const section = copy.sections.find((candidate) => candidate.kind === "experience");
  if (section?.kind !== "experience" || !section.items[0]) throw new Error("no experience");
  change(section.items[0]);
  return copy;
}

describe("visible CV text", () => {
  const definition = createDefaultDefinition(master, sequentialIds());

  it("reads what the CV prints, section by section, with where each text sits", () => {
    const fragments = texts(definition);

    expect(fragments[0]).toEqual({
      text: "Full stack web developer",
      where: { scope: "cv", field: "headerTitle", section: null, item: null },
    });
    expect(fragments).toContainEqual({
      text: "TypeScript",
      where: { scope: "cv", field: "skill", section: "Technical skills", item: "Languages" },
    });
    expect(fragments).toContainEqual({
      text: "Developer",
      where: { scope: "cv", field: "role", section: "Professional experience", item: null },
    });
    expect(fragments).toContainEqual({
      text: "Built features",
      where: {
        scope: "cv",
        field: "bullet",
        section: "Professional experience",
        item: "Developer",
      },
    });
    expect(plain(fragments)).toEqual(
      expect.arrayContaining([
        "Example Corp",
        "Web development training",
        "Hands-on training",
        "Booking app",
        "Next.js",
        "Container fundamentals",
        "Teamwork",
        "English",
        "A2",
        "Volunteering",
        "Coding club mentor",
        "Organizer",
      ]),
    );
  });

  it("leaves out contacts, links, dates, built-in headings and archived records", () => {
    const all = plain(texts(definition)).join(" | ");
    for (const absent of [
      "alex@example.com",
      "+00 123 456 789",
      "alex-example",
      "github",
      "2026",
      "Perl",
      "Removed",
      "Old Company",
    ]) {
      expect(all).not.toContain(absent);
    }
    expect(plain(texts(definition))).not.toContain("Professional experience");
  });

  it("uses the CV's language", () => {
    expect(plain(texts(definition, "fr"))).toEqual(
      expect.arrayContaining(["Développeur", "Développement de fonctionnalités", "Bénévolat"]),
    );
  });

  it("drops hidden sections and hidden bullets", () => {
    const hiddenSection = structuredClone(definition);
    for (const section of hiddenSection.sections) {
      if (section.kind === "experience") section.visible = false;
    }
    expect(plain(texts(hiddenSection))).not.toContain("Built features");

    const hiddenBullet = withExperience(definition, (item) => {
      item.details = [{ refId: IDS.detailBullet, visible: false }];
    });
    const shown = plain(texts(hiddenBullet));
    expect(shown).not.toContain("Built features");
    expect(shown).toContain("Improved the interface");
  });

  it("prints per-CV wording instead of the career data", () => {
    const reworded = withExperience(definition, (item) => {
      item.role = { en: "Frontend lead" };
      item.details = [
        { refId: IDS.detailBullet, visible: true, text: { en: "Shipped a design system" } },
      ];
    });
    const shown = plain(texts(reworded));
    expect(shown).toEqual(expect.arrayContaining(["Frontend lead", "Shipped a design system"]));
    expect(shown).not.toContain("Built features");
  });
});

describe("career data text", () => {
  it("lists every active text in every language, named for the dashboard", () => {
    const fragments = careerTexts(master, "en");
    const all = plain(fragments);

    expect(all).toEqual(
      expect.arrayContaining([
        "Full stack web developer",
        "Développeur web full stack",
        "Developer",
        "Développeur",
        "Example Corp",
        "Built features",
        "Développement de fonctionnalités",
        "Event booking platform",
        "Example Academy",
        "Gestion du temps",
        "B1",
        "Mentor au club de code",
        "Rôle",
      ]),
    );
    expect(fragments).toContainEqual({
      text: "Git",
      where: { scope: "career", record: "skills", item: "Version control" },
    });
    expect(fragments).toContainEqual({
      text: "Improved the interface",
      where: { scope: "career", record: "experience", item: "Developer" },
    });
    expect(careerTexts(master, "fr")).toContainEqual({
      text: "Git",
      where: { scope: "career", record: "skills", item: "Contrôle de version" },
    });
  });

  it("leaves out archived records and contact details", () => {
    const all = plain(careerTexts(master, "en")).join(" | ");
    for (const absent of ["Perl", "Removed", "Old Company", "alex@example.com", "Springfield"]) {
      expect(all).not.toContain(absent);
    }
  });

  it("writes shared text once", () => {
    const typescript = careerTexts(master, "en").filter(
      (fragment) => fragment.text === "TypeScript",
    );
    // The skill and the technology of the current experience.
    expect(typescript).toHaveLength(2);
  });
});
