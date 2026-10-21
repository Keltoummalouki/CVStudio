import { describe, expect, it } from "vitest";
import {
  createBuiltInSection,
  createDefaultDefinition,
  newExperienceItem,
} from "@/features/cv-builder/defaults";
import {
  collectReferences,
  definitionSchema,
  type CvDefinition,
  type SectionOf,
} from "@/features/cv-builder/definition";
import {
  materializeOptOut,
  reorderSections,
  setOverride,
  setSectionTitle,
  setSectionVisible,
  updateItem,
  updateSection,
} from "@/features/cv-builder/operations";
import {
  isBlockingIssue,
  mergeOptOut,
  resolveCv,
  type ResolvedSection,
  type ResolvedSectionOf,
} from "@/features/cv-builder/resolve";
import { buildMasterData, IDS, LABELS, sequentialIds } from "../../fixtures/master-data";

const master = buildMasterData();

function definition(): CvDefinition {
  return createDefaultDefinition(master, sequentialIds());
}

function section<K extends ResolvedSection["kind"]>(sections: ResolvedSection[], kind: K) {
  return sections.find((candidate) => candidate.kind === kind) as ResolvedSectionOf<K> | undefined;
}

function nodeOf(def: CvDefinition, kind: string) {
  const found = def.sections.find((candidate) => candidate.kind === kind);
  if (!found) throw new Error(`no ${kind} section`);
  return found.nodeId;
}

describe("CV definition schema", () => {
  it("accepts a default definition", () => {
    expect(definitionSchema.safeParse(definition()).success).toBe(true);
  });

  it("rejects unknown keys, bad ids and a wrong schema version", () => {
    const valid = definition();
    expect(definitionSchema.safeParse({ ...valid, extra: true }).success).toBe(false);
    expect(definitionSchema.safeParse({ ...valid, schemaVersion: 2 }).success).toBe(false);
    const badId = structuredClone(valid);
    badId.sections[0]!.nodeId = "not-a-uuid";
    expect(definitionSchema.safeParse(badId).success).toBe(false);
  });

  it("rejects duplicate sections, nodes and records", () => {
    const valid = definition();
    const experience = valid.sections.find((s) => s.kind === "experience")!;

    const twice = {
      ...valid,
      sections: [...valid.sections, { ...experience, nodeId: IDS.missing }],
    };
    expect(definitionSchema.safeParse(twice).error?.issues[0]?.message).toBe("duplicateSection");

    const sameNode = {
      ...valid,
      sections: [
        ...valid.sections,
        { ...createBuiltInSection("summary", master), nodeId: experience.nodeId },
      ],
    };
    expect(definitionSchema.safeParse(sameNode).success).toBe(false);

    const duplicateRecord = updateSection(valid, experience.nodeId, "experience", (s) => ({
      ...s,
      items: [newExperienceItem(IDS.expCurrent), newExperienceItem(IDS.expCurrent)],
    }));
    expect(definitionSchema.safeParse(duplicateRecord).error?.issues[0]?.message).toBe(
      "duplicateRecord",
    );
  });

  it("rejects overrides that mix shared and translated text", () => {
    const def = definition();
    const withShared = updateSection(def, nodeOf(def, "experience"), "experience", (s) => ({
      ...s,
      title: { shared: "Work", en: "Work" },
    }));
    expect(definitionSchema.safeParse(withShared).success).toBe(false);
  });

  it("collects every referenced record by table", () => {
    const refs = collectReferences(definition());
    expect(refs.experiences).toEqual([IDS.expCurrent, IDS.expPast]);
    expect(refs.custom_sections).toEqual([IDS.custom]);
    expect(refs.skills).toEqual([]);
  });
});

describe("default definition", () => {
  it("follows the reference section order and includes active records only", () => {
    const def = definition();
    expect(def.sections.map((s) => s.kind)).toEqual([
      "summary",
      "technical_skills",
      "experience",
      "education",
      "projects",
      "certifications",
      "soft_skills",
      "languages",
      "custom",
    ]);
    const experience = def.sections.find((s) => s.kind === "experience") as SectionOf<"experience">;
    expect(experience.items.map((item) => item.refId)).toEqual([IDS.expCurrent, IDS.expPast]);
  });
});

describe("opt-out merging", () => {
  const masterItems = [
    { id: "a", archived: false },
    { id: "b", archived: false },
    { id: "c", archived: true },
    { id: "d", archived: false },
  ];

  it("keeps the CV order, then appends items added since", () => {
    const merged = mergeOptOut(
      [
        { refId: "b", visible: false },
        { refId: "a", visible: true },
      ],
      masterItems,
    );
    expect(merged.map(({ item }) => item.id)).toEqual(["b", "a", "d"]);
    expect(merged[2]?.ref).toBeUndefined();
  });

  it("drops archived and deleted items", () => {
    const merged = mergeOptOut(
      [
        { refId: "c", visible: true },
        { refId: "gone", visible: true },
      ],
      masterItems,
    );
    expect(merged.map(({ item }) => item.id)).toEqual(["a", "b", "d"]);
  });

  it("materializes the full list so a change can be stored", () => {
    const refs = materializeOptOut([{ refId: "d", visible: false }], masterItems, (refId) => ({
      refId,
      visible: true,
    }));
    expect(refs).toEqual([
      { refId: "d", visible: false },
      { refId: "a", visible: true },
      { refId: "b", visible: true },
    ]);
  });
});

describe("resolving a CV", () => {
  it("renders the header with contacts and visible links in the CV language", () => {
    const { cv } = resolveCv(definition(), master, "fr", LABELS.fr);
    expect(cv.header.title).toEqual({ text: "Développeur web full stack", missing: false });
    expect(cv.header.name).toBe("Alex Example");
    expect(cv.header.showPhoto).toBe(true);
    expect(cv.header.contacts.map((c) => [c.key, c.label, c.href])).toEqual([
      ["phone", "Téléphone", "tel:+00123456789"],
      ["email", "E-mail", "mailto:alex@example.com"],
      ["location", "Adresse", null],
    ]);
    expect(cv.header.links.map((l) => [l.label, l.value.text])).toEqual([
      ["GitHub", "alex-example"],
      ["Blog", "blog.example.com"],
    ]);
  });

  it("uses localized default headings and formats dates per language", () => {
    const fr = resolveCv(definition(), master, "fr", LABELS.fr).cv;
    const experience = section(fr.sections, "experience")!;
    expect(experience.title.text).toBe("Expériences professionnelles");
    expect(experience.entries.map((e) => e.date)).toEqual([
      "Février 2026 – Présent",
      "Juin – Août 2025",
    ]);

    const en = resolveCv(definition(), master, "en", LABELS.en).cv;
    expect(section(en.sections, "experience")!.entries[0]!.date).toBe("February 2026 – Present");
  });

  it("splits experience details into bullets and technologies, skipping archived ones", () => {
    const { cv } = resolveCv(definition(), master, "en", LABELS.en);
    const entry = section(cv.sections, "experience")!.entries[0]!;
    expect(entry.title?.text).toBe("Developer");
    expect(entry.subtitle?.text).toBe("Example Corp");
    expect(entry.place?.text).toBe("Springfield");
    expect(entry.body.map((b) => b.text.text)).toEqual([
      "Built features",
      "Improved the interface",
    ]);
    expect(entry.technologies.map((t) => t.text)).toEqual(["TypeScript"]);
  });

  it("omits empty sections entirely", () => {
    const { cv } = resolveCv(definition(), master, "en", LABELS.en);
    expect(section(cv.sections, "summary")).toBeUndefined();
  });

  it("reports a missing translation, shows the other language, and blocks export", () => {
    const { cv, issues } = resolveCv(definition(), master, "fr", LABELS.fr);
    const bullet = section(cv.sections, "experience")!.entries[0]!.body[1]!;
    expect(bullet.text).toEqual({ text: "Improved the interface", missing: true });
    // Issues follow document order: header first.
    expect(issues).toEqual([
      expect.objectContaining({
        kind: "missing_translation",
        field: "linkLabel",
        sectionKind: "header",
        refId: IDS.linkOther,
        hint: "blog.example.com",
      }),
      expect.objectContaining({
        kind: "missing_translation",
        field: "detail",
        sectionKind: "experience",
        refId: IDS.expCurrent,
        hint: "Développeur · Example Corp",
      }),
    ]);
    expect(issues.every(isBlockingIssue)).toBe(true);
  });

  it("resolves a missing translation by hiding the item", () => {
    const def = definition();
    const node = nodeOf(def, "experience");
    const hidden = updateSection(def, node, "experience", (s) => ({
      ...s,
      items: updateItem(s.items, IDS.expCurrent, (item) => ({
        ...item,
        details: [{ refId: IDS.detailBullet2, visible: false }],
      })),
    }));
    const { cv, issues } = resolveCv(hidden, master, "fr", LABELS.fr);
    expect(issues.filter((i) => i.kind === "missing_translation" && i.field === "detail")).toEqual(
      [],
    );
    expect(section(cv.sections, "experience")!.entries[0]!.body).toHaveLength(1);
  });

  it("resolves a missing translation with a per-CV override, without touching the other language", () => {
    const def = definition();
    const node = nodeOf(def, "experience");
    const overridden = updateSection(def, node, "experience", (s) => ({
      ...s,
      items: updateItem(s.items, IDS.expCurrent, (item) => ({
        ...item,
        role: { en: "Software engineer" },
        details: [
          { refId: IDS.detailBullet2, visible: true, text: { fr: "Amélioration de l'interface" } },
        ],
      })),
    }));
    const fr = resolveCv(overridden, master, "fr", LABELS.fr);
    const entry = section(fr.cv.sections, "experience")!.entries[0]!;
    expect(entry.body[0]?.text.text).toBe("Amélioration de l'interface");
    // The English role override does not apply to the French CV.
    expect(entry.title?.text).toBe("Développeur");

    const en = resolveCv(overridden, master, "en", LABELS.en);
    expect(section(en.cv.sections, "experience")!.entries[0]!.title?.text).toBe(
      "Software engineer",
    );
  });

  it("orders nested items per CV and shows items added since at the end", () => {
    const def = definition();
    const node = nodeOf(def, "experience");
    const reordered = updateSection(def, node, "experience", (s) => ({
      ...s,
      items: updateItem(s.items, IDS.expCurrent, (item) => ({
        ...item,
        details: [{ refId: IDS.detailBullet2, visible: true }],
      })),
    }));
    const { cv } = resolveCv(reordered, master, "en", LABELS.en);
    expect(section(cv.sections, "experience")!.entries[0]!.body.map((b) => b.text.text)).toEqual([
      "Improved the interface",
      "Built features",
    ]);
  });

  it("keeps archived records with a warning and reports deleted ones", () => {
    const def = definition();
    const node = nodeOf(def, "experience");
    const withOld = updateSection(def, node, "experience", (s) => ({
      ...s,
      items: [...s.items, newExperienceItem(IDS.expArchived), newExperienceItem(IDS.missing)],
    }));
    const { cv, issues } = resolveCv(withOld, master, "en", LABELS.en);
    expect(section(cv.sections, "experience")!.entries.map((e) => e.subtitle?.text)).toEqual([
      "Example Corp",
      "Sample Studio",
      "Old Company",
    ]);
    const warnings = issues.filter((issue) => !isBlockingIssue(issue));
    expect(warnings.map((w) => [w.kind, w.refId])).toEqual([
      ["archived_record", IDS.expArchived],
      ["missing_record", IDS.missing],
    ]);
  });

  it("never reports issues for hidden sections", () => {
    const def = definition();
    const hidden = setSectionVisible(def, nodeOf(def, "experience"), false);
    const { cv, issues } = resolveCv(hidden, master, "fr", LABELS.fr);
    expect(section(cv.sections, "experience")).toBeUndefined();
    expect(issues.some((i) => i.sectionKind === "experience")).toBe(false);
  });

  it("applies section order and heading overrides", () => {
    const def = definition();
    const projects = nodeOf(def, "projects");
    const skills = nodeOf(def, "technical_skills");
    const edited = setSectionTitle(
      reorderSections(def, [projects, skills]),
      projects,
      "fr",
      "Projets réalisés (+50)",
    );
    const fr = resolveCv(edited, master, "fr", LABELS.fr).cv;
    expect(fr.sections.map((s) => s.kind).slice(0, 2)).toEqual(["projects", "technical_skills"]);
    expect(fr.sections[0]?.title.text).toBe("Projets réalisés (+50)");
    // Written only for French: the English CV keeps its default heading.
    expect(
      section(resolveCv(edited, master, "en", LABELS.en).cv.sections, "projects")?.title.text,
    ).toBe("Projects");
  });

  it("resolves grouped skills, lists, certifications and custom sections", () => {
    const { cv } = resolveCv(definition(), master, "fr", LABELS.fr);
    const skills = section(cv.sections, "technical_skills")!;
    expect(skills.columns).toBe(2);
    expect(skills.groups.map((g) => [g.title?.text, g.skills.map((s) => s.text)])).toEqual([
      ["Langages", ["TypeScript", "SQL"]],
      ["Contrôle de version", ["Git"]],
    ]);
    expect(
      section(cv.sections, "languages")!.items.map((i) => [i.text.text, i.detail?.text]),
    ).toEqual([
      ["Français", "B1"],
      ["Anglais", "A2"],
    ]);
    const certification = section(cv.sections, "certifications")!.entries[0]!;
    expect([certification.title?.text, certification.subtitle?.text, certification.date]).toEqual([
      "Fondamentaux des conteneurs",
      "Example Academy",
      "Mars 2025",
    ]);
    const custom = section(cv.sections, "custom")!;
    expect(custom.title.text).toBe("Bénévolat");
    expect(custom.subsections[0]!.title).toBeNull();
    expect(
      custom.subsections[0]!.items.map((i) => [i.kind, i.label?.text ?? null, i.text.text]),
    ).toEqual([
      ["bullet", null, "Mentor au club de code"],
      ["key_value", "Rôle", "Organisateur"],
    ]);
  });

  it("respects header and entry field toggles", () => {
    const def = definition();
    const node = nodeOf(def, "projects");
    const edited = updateSection(
      { ...def, header: { ...def.header, showPhoto: false, showEmail: false, showLinks: false } },
      node,
      "projects",
      (s) => ({
        ...s,
        items: updateItem(s.items, IDS.project, (item) => ({
          ...item,
          showDates: false,
          showTechnologies: false,
          showLinks: true,
        })),
      }),
    );
    const { cv } = resolveCv(edited, master, "en", LABELS.en);
    expect(cv.header.showPhoto).toBe(false);
    expect(cv.header.contacts.map((c) => c.key)).toEqual(["phone", "location"]);
    expect(cv.header.links).toEqual([]);
    const project = section(cv.sections, "projects")!.entries[0]!;
    expect(project.date).toBeNull();
    expect(project.technologies).toEqual([]);
    expect(project.links).toEqual([
      { label: "Live", text: "booking.example.com", href: "https://booking.example.com" },
    ]);
  });
});

describe("overrides", () => {
  it("sets and clears one language at a time", () => {
    const en = setOverride(undefined, "en", "Engineer");
    expect(en).toEqual({ en: "Engineer" });
    const both = setOverride(en, "fr", "Ingénieure");
    expect(both).toEqual({ en: "Engineer", fr: "Ingénieure" });
    expect(setOverride(both, "en", "  ")).toEqual({ fr: "Ingénieure" });
    expect(setOverride({ fr: "x" }, "fr", "")).toBeUndefined();
  });
});
