import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "../../../src/lib/supabase/database.types";
import { E2E_BUILDER } from "./accounts";
import { localSupabase } from "./local-supabase";

/**
 * A complete, generic career profile shaped like the reference CVs (no real
 * person, employer or contact details). Written through the same save
 * functions the app uses, signed in as the builder owner, so RLS applies.
 *
 * One project description is English-only on purpose: French CVs built from
 * this data have exactly one missing translation to resolve.
 */

const t = (en: string, fr: string) => ({ en, fr });
const shared = (text: string) => ({ shared: text });
const bullet = (en: string, fr: string) => ({ id: null, kind: "bullet", text_i18n: t(en, fr) });
const tech = (...names: string[]) =>
  names.map((name) => ({ id: null, kind: "technology", text_i18n: shared(name) }));

export const SEED = {
  fullName: "Alex Example",
  title: t("Full stack web developer", "Développeur web full stack"),
  experienceRoles: t("Full stack developer", "Développeur full stack"),
  englishOnlyProject: "Booking platform",
} as const;

async function builderClient() {
  const { url, publishableKey } = localSupabase();
  const client = createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword(E2E_BUILDER);
  if (error) throw error;
  return client;
}

export async function seedBuilderWorkspace() {
  const client = await builderClient();
  const rpc = async (fn: Parameters<typeof client.rpc>[0], payload: Json) => {
    const { error } = await client.rpc(fn, { payload } as never);
    if (error) throw new Error(`${fn}: ${error.message}`);
  };

  const profile = await client.from("profiles").select("updated_at").single();
  if (profile.error) throw profile.error;

  await rpc("save_profile", {
    expectedUpdatedAt: profile.data.updated_at,
    full_name: SEED.fullName,
    title_i18n: SEED.title,
    summary_i18n: {},
    location_i18n: t("Springfield (open to relocation)", "Springfield (mobilité)"),
    email: "alex@example.com",
    phone: "+00 600 000 000",
    links: [
      {
        id: null,
        kind: "github",
        label_i18n: {},
        display_text: "alex-example",
        url: "https://github.com/alex-example",
      },
      {
        id: null,
        kind: "linkedin",
        label_i18n: {},
        display_text: "alex-example",
        url: "https://www.linkedin.com/in/alex-example",
      },
      {
        id: null,
        kind: "portfolio",
        label_i18n: {},
        display_text: "alex.example.com",
        url: "https://alex.example.com",
      },
    ],
  });

  await rpc("save_skill_groups", {
    expectedStamp: null,
    groups: [
      ["Languages", "Langages", ["C", "HTML5", "CSS3", "SQL", "JavaScript", "TypeScript", "PHP"]],
      [
        "Frameworks & APIs",
        "Frameworks & APIs",
        ["Laravel", "Node.js", "React", "Next.js", "Express.js", "NestJS", "Tailwind CSS"],
      ],
      ["DevOps", "DevOps", ["Docker", "CI/CD (GitHub Actions, GitLab)"]],
      ["Databases", "Bases de données", ["MySQL", "PostgreSQL", "MongoDB"]],
      ["Project management", "Gestion de projets", ["Agile methods", "Jira"]],
      ["Modeling & design", "Conception", ["Merise", "UML"]],
      ["Version control", "Contrôle de version", ["Git", "GitHub", "GitLab"]],
      ["UX/UI design", "UX/UI design", ["Figma", "Canva"]],
    ].map(([en, fr, skills]) => ({
      id: null,
      title_i18n: t(en as string, fr as string),
      skills: (skills as string[]).map((label) => ({ id: null, label_i18n: shared(label) })),
    })),
  });

  await rpc("save_experience", {
    id: null,
    expectedUpdatedAt: null,
    organization: "Example Health",
    role_i18n: SEED.experienceRoles,
    location_i18n: shared("Springfield"),
    start_year: 2026,
    start_month: 2,
    end_year: null,
    end_month: null,
    is_current: true,
    details: [
      bullet(
        "Built and maintained features for a medical appointment booking platform.",
        "Développement et maintenance de fonctionnalités pour une plateforme de prise de rendez-vous médicaux.",
      ),
      bullet(
        "Improved user interfaces and the overall user experience.",
        "Amélioration des interfaces et de l’expérience utilisateur.",
      ),
      ...tech("Ruby on Rails", "Angular", "MongoDB", "Docker", "Git/GitHub"),
    ],
  });
  await rpc("save_experience", {
    id: null,
    expectedUpdatedAt: null,
    organization: "Sample Studio",
    role_i18n: t("Web developer intern", "Stagiaire développeur web"),
    location_i18n: shared("Shelbyville"),
    start_year: 2025,
    start_month: 6,
    end_year: 2025,
    end_month: 8,
    is_current: false,
    details: [
      bullet(
        "Built a showcase website and integrated front-end interfaces.",
        "Développement d’un site vitrine et intégration des interfaces front-end.",
      ),
      ...tech("Next.js", "React", "Tailwind CSS", "GSAP", "Git/GitHub"),
    ],
  });

  await rpc("save_education", {
    id: null,
    expectedUpdatedAt: null,
    credential_i18n: t("Full stack development training", "Formation développement full stack"),
    institution_i18n: shared("Example Coding School"),
    location_i18n: shared("Springfield campus"),
    description_i18n: t(
      "Hands-on training in front-end and back-end web development.",
      "Formation pratique en développement web front-end et back-end.",
    ),
    start_year: 2024,
    start_month: null,
    end_year: 2026,
    end_month: null,
    is_current: false,
  });
  await rpc("save_education", {
    id: null,
    expectedUpdatedAt: null,
    credential_i18n: t("Baccalaureate in physical sciences", "Baccalauréat en sciences physiques"),
    institution_i18n: t("Springfield High School", "Lycée de Springfield"),
    location_i18n: {},
    description_i18n: {},
    start_year: 2023,
    start_month: null,
    end_year: 2024,
    end_month: null,
    is_current: false,
  });

  await rpc("save_project", {
    id: null,
    expectedUpdatedAt: null,
    title_i18n: t(
      "EventHub – event booking platform",
      "EventHub – plateforme de réservation d’événements",
    ),
    description_i18n: t(
      "Event discovery and booking platform with secure QR ticketing.",
      "Plateforme de découverte et de réservation d’événements avec billetterie QR sécurisée.",
    ),
    project_url: null,
    source_url: "https://github.com/alex-example/eventhub",
    start_year: null,
    start_month: null,
    end_year: 2026,
    end_month: 2,
    is_current: false,
    details: tech("Next.js", "TypeScript", "NestJS", "PostgreSQL", "Docker", "GitHub Actions"),
  });
  await rpc("save_project", {
    id: null,
    expectedUpdatedAt: null,
    title_i18n: t(SEED.englishOnlyProject, "Plateforme de réservation"),
    description_i18n: { en: "Service booking platform with availability management." },
    project_url: null,
    source_url: null,
    start_year: null,
    start_month: null,
    end_year: 2025,
    end_month: 4,
    is_current: false,
    details: tech("Laravel", "MySQL", "JavaScript", "UML", "Jira"),
  });

  await rpc("save_certification", {
    id: null,
    expectedUpdatedAt: null,
    title_i18n: t(
      "Container fundamentals – professional certificate",
      "Fondamentaux des conteneurs – certificat professionnel",
    ),
    issuer_i18n: {},
    issued_year: null,
    issued_month: null,
    credential_url: null,
  });

  await rpc("save_soft_skills", {
    expectedStamp: null,
    items: [
      t("Time management", "Gestion du temps"),
      t("Adaptability – flexibility", "Adaptabilité – flexibilité"),
      t("Teamwork", "Travail en équipe"),
    ].map((label) => ({ id: null, label_i18n: label })),
  });

  await rpc("save_spoken_languages", {
    expectedStamp: null,
    items: [
      [t("Arabic", "Arabe"), t("native", "maternelle")],
      [t("French", "Français"), shared("B1")],
      [t("English", "Anglais"), shared("A2")],
    ].map(([name, proficiency]) => ({ id: null, name_i18n: name, proficiency_i18n: proficiency })),
  });
}
