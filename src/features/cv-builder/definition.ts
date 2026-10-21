import { z } from "zod";
import { localizedTextSchema } from "@/lib/i18n/localized-text";

/**
 * CV composition (stored in cv_documents.definition and cv_templates.definition).
 *
 * It records choices, never copies of master data:
 * - which top-level records a section includes, in which order (opt-in);
 * - which nested items are hidden or reordered (opt-out: items added to a
 *   record later appear automatically unless hidden here);
 * - per-CV wording overrides, field toggles and layout options.
 *
 * Bump DEFINITION_SCHEMA_VERSION (and the database check) for incompatible
 * changes, with a migration of stored definitions.
 */
export const DEFINITION_SCHEMA_VERSION = 1;

const nodeId = z.uuid();
const refId = z.uuid();
const override = (maxLength: number) => localizedTextSchema(maxLength).optional();

export const itemRefSchema = z.object({ refId, visible: z.boolean() }).strict();
export type ItemRef = z.infer<typeof itemRefSchema>;

export const detailRefSchema = z
  .object({ refId, visible: z.boolean(), text: override(1000) })
  .strict();
export type DetailRef = z.infer<typeof detailRefSchema>;

export const headerSchema = z
  .object({
    showTitle: z.boolean(),
    showName: z.boolean(),
    showPhoto: z.boolean(),
    showEmail: z.boolean(),
    showPhone: z.boolean(),
    showLocation: z.boolean(),
    showLinks: z.boolean(),
    /** Per-CV professional title, e.g. "Frontend developer" for one application. */
    title: override(160),
    links: z.array(itemRefSchema).max(20),
  })
  .strict();
export type HeaderDefinition = z.infer<typeof headerSchema>;

const sectionBase = {
  nodeId,
  visible: z.boolean(),
  /** Per-CV heading, e.g. "Projets réalisés (+60)". */
  title: override(120),
};

export const summarySectionSchema = z
  .object({ ...sectionBase, kind: z.literal("summary"), text: override(2000) })
  .strict();

export const skillsSectionSchema = z
  .object({
    ...sectionBase,
    kind: z.literal("technical_skills"),
    columns: z.union([z.literal(1), z.literal(2)]),
    /** First group of the right column; absent means an even split. */
    rightStartsWith: refId.optional(),
    groups: z
      .array(
        z.object({ refId, visible: z.boolean(), skills: z.array(itemRefSchema).max(60) }).strict(),
      )
      .max(30),
  })
  .strict();

export const experienceItemSchema = z
  .object({
    refId,
    visible: z.boolean(),
    showDates: z.boolean(),
    showLocation: z.boolean(),
    showTechnologies: z.boolean(),
    role: override(160),
    details: z.array(detailRefSchema).max(100),
  })
  .strict();
export type ExperienceItem = z.infer<typeof experienceItemSchema>;

export const experienceSectionSchema = z
  .object({
    ...sectionBase,
    kind: z.literal("experience"),
    items: z.array(experienceItemSchema).max(100),
  })
  .strict();

export const educationItemSchema = z
  .object({
    refId,
    visible: z.boolean(),
    showDates: z.boolean(),
    showLocation: z.boolean(),
    showDescription: z.boolean(),
    credential: override(200),
    description: override(2000),
  })
  .strict();
export type EducationItem = z.infer<typeof educationItemSchema>;

export const educationSectionSchema = z
  .object({
    ...sectionBase,
    kind: z.literal("education"),
    items: z.array(educationItemSchema).max(100),
  })
  .strict();

export const projectItemSchema = z
  .object({
    refId,
    visible: z.boolean(),
    showDates: z.boolean(),
    showDescription: z.boolean(),
    showTechnologies: z.boolean(),
    showLinks: z.boolean(),
    title: override(200),
    description: override(2000),
    details: z.array(detailRefSchema).max(100),
  })
  .strict();
export type ProjectItem = z.infer<typeof projectItemSchema>;

export const projectsSectionSchema = z
  .object({
    ...sectionBase,
    kind: z.literal("projects"),
    items: z.array(projectItemSchema).max(100),
  })
  .strict();

export const certificationItemSchema = z
  .object({
    refId,
    visible: z.boolean(),
    showIssuer: z.boolean(),
    showDate: z.boolean(),
    showLink: z.boolean(),
    title: override(200),
  })
  .strict();
export type CertificationItem = z.infer<typeof certificationItemSchema>;

export const certificationsSectionSchema = z
  .object({
    ...sectionBase,
    kind: z.literal("certifications"),
    items: z.array(certificationItemSchema).max(100),
  })
  .strict();

export const softSkillsSectionSchema = z
  .object({
    ...sectionBase,
    kind: z.literal("soft_skills"),
    items: z.array(itemRefSchema).max(100),
  })
  .strict();

export const languagesSectionSchema = z
  .object({ ...sectionBase, kind: z.literal("languages"), items: z.array(itemRefSchema).max(50) })
  .strict();

export const customSectionSchema = z
  .object({
    ...sectionBase,
    kind: z.literal("custom"),
    refId,
    subsections: z
      .array(
        z.object({ refId, visible: z.boolean(), items: z.array(itemRefSchema).max(60) }).strict(),
      )
      .max(20),
  })
  .strict();

export const sectionSchema = z.discriminatedUnion("kind", [
  summarySectionSchema,
  skillsSectionSchema,
  experienceSectionSchema,
  educationSectionSchema,
  projectsSectionSchema,
  certificationsSectionSchema,
  softSkillsSectionSchema,
  languagesSectionSchema,
  customSectionSchema,
]);

export type SectionDefinition = z.infer<typeof sectionSchema>;
export type SectionKind = SectionDefinition["kind"];
export type SectionOf<K extends SectionKind> = Extract<SectionDefinition, { kind: K }>;

/** Built-in sections appear at most once per CV; custom sections may repeat. */
export const SINGLETON_SECTION_KINDS = [
  "summary",
  "technical_skills",
  "experience",
  "education",
  "projects",
  "certifications",
  "soft_skills",
  "languages",
] as const satisfies readonly SectionKind[];

function sectionRefIds(section: SectionDefinition): string[] {
  switch (section.kind) {
    case "summary":
      return [];
    case "technical_skills":
      return section.groups.map((group) => group.refId);
    case "custom":
      return [section.refId];
    default:
      return section.items.map((item) => item.refId);
  }
}

export const definitionSchema = z
  .object({
    schemaVersion: z.literal(DEFINITION_SCHEMA_VERSION),
    header: headerSchema,
    sections: z.array(sectionSchema).max(30),
  })
  .strict()
  .superRefine((definition, context) => {
    const nodeIds = new Set<string>();
    const kinds = new Set<string>();
    const customRefs = new Set<string>();

    definition.sections.forEach((section, index) => {
      if (nodeIds.has(section.nodeId)) {
        context.addIssue({
          code: "custom",
          path: ["sections", index, "nodeId"],
          message: "duplicateNode",
        });
      }
      nodeIds.add(section.nodeId);

      if ((SINGLETON_SECTION_KINDS as readonly string[]).includes(section.kind)) {
        if (kinds.has(section.kind)) {
          context.addIssue({
            code: "custom",
            path: ["sections", index, "kind"],
            message: "duplicateSection",
          });
        }
        kinds.add(section.kind);
      }
      if (section.kind === "custom") {
        if (customRefs.has(section.refId)) {
          context.addIssue({
            code: "custom",
            path: ["sections", index, "refId"],
            message: "duplicateSection",
          });
        }
        customRefs.add(section.refId);
      }

      const refs = sectionRefIds(section);
      if (new Set(refs).size !== refs.length) {
        context.addIssue({ code: "custom", path: ["sections", index], message: "duplicateRecord" });
      }
    });
  });

export type CvDefinition = z.infer<typeof definitionSchema>;

/** Every record id a definition points to, grouped by the table it must live in. */
export function collectReferences(definition: CvDefinition) {
  const refs = {
    profile_links: definition.header.links.map((link) => link.refId),
    skill_groups: [] as string[],
    skills: [] as string[],
    experiences: [] as string[],
    experience_details: [] as string[],
    educations: [] as string[],
    projects: [] as string[],
    project_details: [] as string[],
    certifications: [] as string[],
    soft_skills: [] as string[],
    spoken_languages: [] as string[],
    custom_sections: [] as string[],
    custom_subsections: [] as string[],
    custom_items: [] as string[],
  };

  for (const section of definition.sections) {
    switch (section.kind) {
      case "summary":
        break;
      case "technical_skills":
        for (const group of section.groups) {
          refs.skill_groups.push(group.refId);
          refs.skills.push(...group.skills.map((skill) => skill.refId));
        }
        break;
      case "experience":
        for (const item of section.items) {
          refs.experiences.push(item.refId);
          refs.experience_details.push(...item.details.map((detail) => detail.refId));
        }
        break;
      case "education":
        refs.educations.push(...section.items.map((item) => item.refId));
        break;
      case "projects":
        for (const item of section.items) {
          refs.projects.push(item.refId);
          refs.project_details.push(...item.details.map((detail) => detail.refId));
        }
        break;
      case "certifications":
        refs.certifications.push(...section.items.map((item) => item.refId));
        break;
      case "soft_skills":
        refs.soft_skills.push(...section.items.map((item) => item.refId));
        break;
      case "languages":
        refs.spoken_languages.push(...section.items.map((item) => item.refId));
        break;
      case "custom":
        refs.custom_sections.push(section.refId);
        for (const subsection of section.subsections) {
          refs.custom_subsections.push(subsection.refId);
          refs.custom_items.push(...subsection.items.map((item) => item.refId));
        }
        break;
    }
  }
  return refs;
}
