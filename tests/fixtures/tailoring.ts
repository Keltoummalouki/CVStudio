import type { MasterData, MasterProject } from "@/features/cv-builder/master-data";
import type { TailoringJob } from "@/features/cv-tailoring/tailoring";
import type { Requirement } from "@/features/job-posts/schemas";
import { buildMasterData } from "./master-data";

/** Generic career data for tailored CVs: no real person, employer or contact details. */

export const PROJECTS = {
  shop: "00000000-0000-4000-8000-000000000101",
  booking: "00000000-0000-4000-8000-000000000102",
  blog: "00000000-0000-4000-8000-000000000103",
  archived: "00000000-0000-4000-8000-000000000104",
} as const;

export const GROUPS = {
  frontend: "00000000-0000-4000-8000-000000000201",
  backend: "00000000-0000-4000-8000-000000000202",
  design: "00000000-0000-4000-8000-000000000203",
} as const;

export const SKILLS = {
  react: "00000000-0000-4000-8000-000000000301",
  redux: "00000000-0000-4000-8000-000000000302",
  vue: "00000000-0000-4000-8000-000000000303",
  node: "00000000-0000-4000-8000-000000000304",
  laravel: "00000000-0000-4000-8000-000000000305",
  figma: "00000000-0000-4000-8000-000000000306",
  canva: "00000000-0000-4000-8000-000000000307",
} as const;

export const SHOP_DETAILS = {
  stripe: "00000000-0000-4000-8000-000000000401",
  react: "00000000-0000-4000-8000-000000000402",
  node: "00000000-0000-4000-8000-000000000403",
  bullet: "00000000-0000-4000-8000-000000000404",
} as const;

let nextDetail = 0;
const detailId = () => `00000000-0000-4000-9000-${String(++nextDetail).padStart(12, "0")}`;

/** A project with links and dates (which must never reach the AI) and these technologies. */
export function tailoringProject(
  id: string,
  title: MasterProject["title"],
  description: MasterProject["description"],
  technologies: string[],
  archived = false,
): MasterProject {
  return {
    id,
    title,
    description,
    projectUrl: "https://private.example.com/demo",
    sourceUrl: "https://github.com/alex-example/private",
    period: { startYear: 2025, startMonth: 1, endYear: 2025, endMonth: 6, isCurrent: false },
    archived,
    details: technologies.map((name) => ({
      id: detailId(),
      kind: "technology" as const,
      text: { shared: name },
      archived: false,
    })),
  };
}

/**
 * The shared fixture with three active projects (an online shop using React
 * and Node.js, a booking app using PostgreSQL, a blog using PHP), one archived
 * project, and three skill groups (frontend, backend, design).
 */
export function tailoringCareer(): MasterData {
  const master = buildMasterData();
  const shop = tailoringProject(
    PROJECTS.shop,
    { en: "Online shop", fr: "Boutique en ligne" },
    { en: "Store with cart and payments", fr: "Boutique avec panier et paiements" },
    [],
  );
  shop.details = [
    { id: SHOP_DETAILS.stripe, kind: "technology", text: { shared: "Stripe" }, archived: false },
    { id: SHOP_DETAILS.react, kind: "technology", text: { shared: "React" }, archived: false },
    { id: SHOP_DETAILS.node, kind: "technology", text: { shared: "Node.js" }, archived: false },
    {
      id: SHOP_DETAILS.bullet,
      kind: "bullet",
      text: { en: "Built the checkout", fr: "Développement du paiement" },
      archived: false,
    },
  ];
  master.projects = [
    tailoringProject(
      PROJECTS.booking,
      { en: "Booking app", fr: "Application de réservation" },
      { en: "Event booking platform" },
      ["Next.js", "PostgreSQL"],
    ),
    shop,
    tailoringProject(PROJECTS.blog, { shared: "Blog engine" }, { en: "Static blog" }, [
      "PHP",
      "MySQL",
    ]),
    tailoringProject(PROJECTS.archived, { shared: "Old React app" }, {}, ["React"], true),
  ];
  const skills = (names: [string, string][]) =>
    names.map(([id, label]) => ({ id, label: { shared: label }, archived: false }));
  master.skillGroups = [
    {
      id: GROUPS.frontend,
      title: { en: "Frontend", fr: "Frontend" },
      archived: false,
      skills: skills([
        [SKILLS.redux, "Redux"],
        [SKILLS.react, "React"],
        [SKILLS.vue, "Vue.js"],
      ]),
    },
    {
      id: GROUPS.backend,
      title: { en: "Backend", fr: "Backend" },
      archived: false,
      skills: skills([
        [SKILLS.laravel, "Laravel"],
        [SKILLS.node, "Node.js"],
      ]),
    },
    {
      id: GROUPS.design,
      title: { en: "Design", fr: "Design" },
      archived: false,
      skills: skills([
        [SKILLS.figma, "Figma"],
        [SKILLS.canva, "Canva"],
      ]),
    },
  ];
  return master;
}

export const requirement = (
  label: string,
  importance: Requirement["importance"],
  index: number,
): Requirement => ({
  id: `00000000-0000-4000-8000-${String(900 + index).padStart(12, "0")}`,
  label,
  kind: "skill",
  importance,
  aliases: [],
  note: "",
});

/** A French post asking for React, Node.js and Kubernetes, with PostgreSQL as a plus. */
export const TAILORING_JOB: TailoringJob = {
  title: "Développeur Full Stack (H/F)",
  language: "fr",
  requirements: {
    schemaVersion: 1,
    titleAliases: ["Full Stack Developer"],
    items: [
      requirement("React", "required", 1),
      requirement("Node.js", "required", 2),
      requirement("PostgreSQL", "preferred", 3),
      requirement("Kubernetes", "required", 4),
    ],
  },
};
