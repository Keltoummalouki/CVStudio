import en from "@messages/en.json";
import fr from "@messages/fr.json";
import type { CvLabelSet, CvLabels } from "@/features/cv-builder/labels";
import type { MasterData } from "@/features/cv-builder/master-data";

/** Generic development data: no real person, employer or contact details. */

export const IDS = {
  linkGithub: "00000000-0000-4000-8000-000000000001",
  linkOther: "00000000-0000-4000-8000-000000000002",
  linkArchived: "00000000-0000-4000-8000-000000000003",
  groupLanguages: "00000000-0000-4000-8000-000000000010",
  groupTools: "00000000-0000-4000-8000-000000000011",
  skillTs: "00000000-0000-4000-8000-000000000012",
  skillSql: "00000000-0000-4000-8000-000000000013",
  skillGit: "00000000-0000-4000-8000-000000000014",
  skillArchived: "00000000-0000-4000-8000-000000000015",
  expCurrent: "00000000-0000-4000-8000-000000000020",
  expPast: "00000000-0000-4000-8000-000000000021",
  expArchived: "00000000-0000-4000-8000-000000000022",
  detailBullet: "00000000-0000-4000-8000-000000000023",
  detailBullet2: "00000000-0000-4000-8000-000000000024",
  detailTech: "00000000-0000-4000-8000-000000000025",
  detailArchived: "00000000-0000-4000-8000-000000000026",
  education: "00000000-0000-4000-8000-000000000030",
  project: "00000000-0000-4000-8000-000000000040",
  projectTech: "00000000-0000-4000-8000-000000000041",
  certification: "00000000-0000-4000-8000-000000000050",
  softTeam: "00000000-0000-4000-8000-000000000060",
  softTime: "00000000-0000-4000-8000-000000000061",
  langFr: "00000000-0000-4000-8000-000000000070",
  langEn: "00000000-0000-4000-8000-000000000071",
  custom: "00000000-0000-4000-8000-000000000080",
  customSub: "00000000-0000-4000-8000-000000000081",
  customItem: "00000000-0000-4000-8000-000000000082",
  customKv: "00000000-0000-4000-8000-000000000083",
  missing: "00000000-0000-4000-8000-0000000000ff",
} as const;

const period = (
  startYear: number | null,
  startMonth: number | null,
  endYear: number | null,
  endMonth: number | null,
  isCurrent = false,
) => ({ startYear, startMonth, endYear, endMonth, isCurrent });

export function buildMasterData(): MasterData {
  return {
    profile: {
      fullName: "Alex Example",
      title: { en: "Full stack web developer", fr: "Développeur web full stack" },
      summary: {},
      location: { en: "Springfield", fr: "Springfield" },
      email: "alex@example.com",
      phone: "+00 123 456 789",
      hasPhoto: true,
    },
    links: [
      {
        id: IDS.linkGithub,
        kind: "github",
        label: {},
        displayText: "alex-example",
        url: "https://github.com/alex-example",
        archived: false,
      },
      {
        id: IDS.linkOther,
        kind: "other",
        label: { en: "Blog" },
        displayText: "",
        url: "https://blog.example.com/",
        archived: false,
      },
      {
        id: IDS.linkArchived,
        kind: "website",
        label: {},
        displayText: "old.example.com",
        url: "https://old.example.com",
        archived: true,
      },
    ],
    skillGroups: [
      {
        id: IDS.groupLanguages,
        title: { en: "Languages", fr: "Langages" },
        archived: false,
        skills: [
          { id: IDS.skillTs, label: { shared: "TypeScript" }, archived: false },
          { id: IDS.skillSql, label: { shared: "SQL" }, archived: false },
          { id: IDS.skillArchived, label: { shared: "Perl" }, archived: true },
        ],
      },
      {
        id: IDS.groupTools,
        title: { en: "Version control", fr: "Contrôle de version" },
        archived: false,
        skills: [{ id: IDS.skillGit, label: { shared: "Git" }, archived: false }],
      },
    ],
    experiences: [
      {
        id: IDS.expCurrent,
        organization: "Example Corp",
        role: { en: "Developer", fr: "Développeur" },
        location: { shared: "Springfield" },
        period: period(2026, 2, null, null, true),
        archived: false,
        details: [
          {
            id: IDS.detailBullet,
            kind: "bullet",
            text: { en: "Built features", fr: "Développement de fonctionnalités" },
            archived: false,
          },
          {
            id: IDS.detailBullet2,
            kind: "bullet",
            text: { en: "Improved the interface" },
            archived: false,
          },
          {
            id: IDS.detailTech,
            kind: "technology",
            text: { shared: "TypeScript" },
            archived: false,
          },
          { id: IDS.detailArchived, kind: "bullet", text: { en: "Removed" }, archived: true },
        ],
      },
      {
        id: IDS.expPast,
        organization: "Sample Studio",
        role: { en: "Intern", fr: "Stagiaire" },
        location: {},
        period: period(2025, 6, 2025, 8),
        archived: false,
        details: [],
      },
      {
        id: IDS.expArchived,
        organization: "Old Company",
        role: { en: "Assistant", fr: "Assistant" },
        location: {},
        period: period(2020, null, 2021, null),
        archived: true,
        details: [],
      },
    ],
    educations: [
      {
        id: IDS.education,
        credential: { en: "Web development training", fr: "Formation développement web" },
        institution: { shared: "Example School" },
        location: {},
        description: { en: "Hands-on training", fr: "Formation pratique" },
        period: period(2024, null, 2026, null),
        archived: false,
      },
    ],
    projects: [
      {
        id: IDS.project,
        title: { en: "Booking app", fr: "Application de réservation" },
        description: { en: "Event booking platform", fr: "Plateforme de réservation" },
        projectUrl: "https://booking.example.com",
        sourceUrl: null,
        period: period(null, null, 2025, 4),
        archived: false,
        details: [
          { id: IDS.projectTech, kind: "technology", text: { shared: "Next.js" }, archived: false },
        ],
      },
    ],
    certifications: [
      {
        id: IDS.certification,
        title: { en: "Container fundamentals", fr: "Fondamentaux des conteneurs" },
        issuer: { shared: "Example Academy" },
        issuedYear: 2025,
        issuedMonth: 3,
        credentialUrl: "https://academy.example.com/cert/1",
        archived: false,
      },
    ],
    softSkills: [
      { id: IDS.softTeam, label: { en: "Teamwork", fr: "Travail en équipe" }, archived: false },
      {
        id: IDS.softTime,
        label: { en: "Time management", fr: "Gestion du temps" },
        archived: false,
      },
    ],
    languages: [
      {
        id: IDS.langFr,
        name: { en: "French", fr: "Français" },
        proficiency: { shared: "B1" },
        archived: false,
      },
      {
        id: IDS.langEn,
        name: { en: "English", fr: "Anglais" },
        proficiency: { shared: "A2" },
        archived: false,
      },
    ],
    customSections: [
      {
        id: IDS.custom,
        title: { en: "Volunteering", fr: "Bénévolat" },
        archived: false,
        subsections: [
          {
            id: IDS.customSub,
            title: {},
            archived: false,
            items: [
              {
                id: IDS.customItem,
                kind: "bullet",
                label: {},
                text: { en: "Coding club mentor", fr: "Mentor au club de code" },
                archived: false,
              },
              {
                id: IDS.customKv,
                kind: "key_value",
                label: { en: "Role", fr: "Rôle" },
                text: { en: "Organizer", fr: "Organisateur" },
                archived: false,
              },
            ],
          },
        ],
      },
    ],
  };
}

export const LABELS: CvLabelSet = { en: en.cv, fr: fr.cv as CvLabels };

/** Deterministic ids for definitions created in tests. */
export function sequentialIds(prefix = "10000000-0000-4000-8000-") {
  let counter = 0;
  return () => `${prefix}${String(++counter).padStart(12, "0")}`;
}
