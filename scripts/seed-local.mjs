// Creates the owner account on the LOCAL Supabase stack, adds it to the
// allowlist and, unless --account-only is passed, loads a generic demo career
// (no real person, employer or contact details). The career data goes through
// the save functions the app itself uses, signed in as the owner, so RLS and
// the database checks apply exactly as in the dashboard. Only a stack on this
// machine is accepted, so the default password can never reach a hosted
// project: there, create the owner in the Supabase dashboard (see README).
//
//   pnpm db:seed [--email you@example.com] [--password '…'] [--account-only]
import { execSync } from "node:child_process";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_EMAIL = "owner@example.com";
const DEFAULT_PASSWORD = "Owner-Pass-2026";
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
// Mirrors supabase/config.toml, which hosted projects should match too.
const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{12,}$/;
const USAGE = "Usage: pnpm db:seed [--email you@example.com] [--password '…'] [--account-only]";

function fail(message) {
  console.error(message);
  process.exit(1);
}

function readOptions() {
  const args = process.argv.slice(2);
  // `pnpm db:seed -- --email …` forwards the separator as well.
  if (args[0] === "--") args.shift();
  try {
    return parseArgs({
      args,
      options: {
        email: { type: "string", default: DEFAULT_EMAIL },
        password: { type: "string", default: DEFAULT_PASSWORD },
        "account-only": { type: "boolean", default: false },
      },
    }).values;
  } catch (error) {
    return fail(`${error.message}\n${USAGE}`);
  }
}

/** The running local stack's endpoints and keys; anything that is not local is refused. */
function localStack() {
  let raw;
  try {
    // A fixed command string: nothing user-supplied reaches the shell.
    raw = execSync("pnpm exec supabase status -o json", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return fail("Local Supabase is not running. Start it with `pnpm db:start`.");
  }

  const status = JSON.parse(raw.slice(raw.indexOf("{")));
  const url = status.API_URL ?? "";
  if (!URL.canParse(url) || !LOCAL_HOSTS.has(new URL(url).hostname)) {
    return fail(`Refusing to seed a Supabase stack that is not local: ${url || "no API URL"}`);
  }
  return {
    url,
    publishableKey: status.PUBLISHABLE_KEY ?? status.ANON_KEY ?? "",
    secretKey: status.SECRET_KEY ?? status.SERVICE_ROLE_KEY ?? "",
  };
}

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };

/** Creates the account, or resets an existing one to the given password. */
async function ensureAccount(admin, email, password) {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;

  const existing = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
  if (existing) {
    const update = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    if (update.error) throw update.error;
    return { id: existing.id, created: false };
  }

  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) {
    throw created.error ?? new Error(`Could not create ${email}.`);
  }
  return { id: created.data.user.id, created: true };
}

/** Tables holding career data; archived rows count, so nothing the owner entered is mixed with the demo. */
const CAREER_TABLES = [
  "profile_links",
  "experiences",
  "educations",
  "skill_groups",
  "projects",
  "certifications",
  "soft_skills",
  "spoken_languages",
  "custom_sections",
];

async function hasCareerData(owner, profile) {
  if (profile.full_name !== "") return true;
  for (const table of CAREER_TABLES) {
    const { count, error } = await owner.from(table).select("id", { count: "exact", head: true });
    if (error) throw error;
    if (count) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Demo career: bilingual throughout, so French and English CVs export without
// missing translations. Three projects, so a CV tailored to a job post has a
// choice to make (it keeps two).
// ---------------------------------------------------------------------------

const t = (en, fr) => ({ en, fr });
const shared = (text) => ({ shared: text });
const bullets = (...pairs) =>
  pairs.map(([en, fr]) => ({ id: null, kind: "bullet", text_i18n: t(en, fr) }));
const technologies = (...names) =>
  names.map((name) => ({ id: null, kind: "technology", text_i18n: shared(name) }));
const added = (fields) => ({ id: null, expectedUpdatedAt: null, ...fields });

const DEMO_PROFILE = {
  full_name: "Camille Example",
  title_i18n: t("Full stack web developer", "Développeur web full stack"),
  summary_i18n: t(
    "Full stack developer building accessible, well-tested web applications with TypeScript, React and Node.js, from database design to deployment.",
    "Développeur full stack qui conçoit des applications web accessibles et testées avec TypeScript, React et Node.js, de la base de données au déploiement.",
  ),
  location_i18n: t("Springfield (open to remote work)", "Springfield (ouvert au télétravail)"),
  email: "camille@example.com",
  phone: "+00 600 000 000",
  links: [
    ["github", "camille-example", "https://github.com/camille-example"],
    ["linkedin", "camille-example", "https://www.linkedin.com/in/camille-example"],
    ["portfolio", "camille.example.com", "https://camille.example.com"],
  ].map(([kind, display_text, url]) => ({ id: null, kind, label_i18n: {}, display_text, url })),
};

const DEMO_SKILL_GROUPS = [
  [t("Languages", "Langages"), ["TypeScript", "JavaScript", "HTML5", "CSS3", "SQL", "Python"]],
  [
    shared("Frameworks & APIs"),
    ["React", "Next.js", "Node.js", "NestJS", "Express.js", "Tailwind CSS"],
  ],
  [t("Databases", "Bases de données"), ["PostgreSQL", "MySQL", "MongoDB", "Redis"]],
  [t("DevOps & tools", "DevOps & outils"), ["Docker", "GitHub Actions", "Git", "Linux"]],
  [t("Testing", "Tests"), ["Vitest", "Playwright", "Jest"]],
  [t("Design", "Conception"), ["Figma", "UML", "Merise"]],
].map(([title_i18n, skills]) => ({
  id: null,
  title_i18n,
  skills: skills.map((label) => ({ id: null, label_i18n: shared(label) })),
}));

const DEMO_EXPERIENCES = [
  added({
    organization: "Example Health",
    role_i18n: t("Full stack developer", "Développeur full stack"),
    location_i18n: shared("Springfield"),
    start_year: 2024,
    start_month: 3,
    end_year: null,
    end_month: null,
    is_current: true,
    details: [
      ...bullets(
        [
          "Built and maintained features of a medical appointment booking platform used by clinics.",
          "Développement et maintenance de fonctionnalités d’une plateforme de prise de rendez-vous médicaux utilisée par des cliniques.",
        ],
        [
          "Cut page load time by 40% by moving key pages to server rendering and caching.",
          "Réduction de 40 % du temps de chargement grâce au rendu serveur et à la mise en cache des pages clés.",
        ],
        [
          "Added end-to-end tests to the release pipeline to catch regressions before deployment.",
          "Ajout de tests de bout en bout au pipeline de livraison pour détecter les régressions avant le déploiement.",
        ],
      ),
      ...technologies("Next.js", "TypeScript", "NestJS", "PostgreSQL", "Docker", "Playwright"),
    ],
  }),
  added({
    organization: "Sample Studio",
    role_i18n: t("Front-end developer", "Développeur front-end"),
    location_i18n: shared("Shelbyville"),
    start_year: 2022,
    start_month: 9,
    end_year: 2024,
    end_month: 2,
    is_current: false,
    details: [
      ...bullets(
        [
          "Built responsive client websites and reusable UI components from Figma designs.",
          "Développement de sites clients responsives et de composants d’interface réutilisables à partir de maquettes Figma.",
        ],
        [
          "Brought the studio’s main page templates to WCAG 2.1 AA.",
          "Mise en conformité WCAG 2.1 AA des principaux gabarits de pages du studio.",
        ],
      ),
      ...technologies("React", "JavaScript", "Tailwind CSS", "Figma", "Git"),
    ],
  }),
];

const DEMO_EDUCATIONS = [
  added({
    credential_i18n: t("Master’s degree in software engineering", "Master en génie logiciel"),
    institution_i18n: t("Example University", "Université Example"),
    location_i18n: shared("Springfield"),
    description_i18n: t(
      "Software architecture, databases, testing and agile project management.",
      "Architecture logicielle, bases de données, tests et gestion de projet agile.",
    ),
    start_year: 2020,
    start_month: null,
    end_year: 2022,
    end_month: null,
    is_current: false,
  }),
  added({
    credential_i18n: t("Bachelor’s degree in computer science", "Licence en informatique"),
    institution_i18n: t("Example University", "Université Example"),
    location_i18n: {},
    description_i18n: {},
    start_year: 2017,
    start_month: null,
    end_year: 2020,
    end_month: null,
    is_current: false,
  }),
];

const project = (fields) =>
  added({
    project_url: null,
    source_url: null,
    start_year: null,
    start_month: null,
    is_current: false,
    ...fields,
  });

const DEMO_PROJECTS = [
  project({
    title_i18n: t(
      "EventHub – event booking platform",
      "EventHub – plateforme de réservation d’événements",
    ),
    description_i18n: t(
      "Event discovery and booking platform with secure QR-code tickets.",
      "Plateforme de découverte et de réservation d’événements avec billets QR sécurisés.",
    ),
    source_url: "https://github.com/camille-example/eventhub",
    end_year: 2026,
    end_month: 6,
    details: [
      ...bullets([
        "Built ticket validation that keeps working offline at the venue entrance.",
        "Validation des billets qui fonctionne même hors ligne à l’entrée du lieu.",
      ]),
      ...technologies("Next.js", "TypeScript", "NestJS", "PostgreSQL", "Docker", "GitHub Actions"),
    ],
  }),
  project({
    title_i18n: t("Stock dashboard for a small shop", "Tableau de bord de stocks pour un commerce"),
    description_i18n: t(
      "Real-time stock and sales dashboard with low-stock alerts.",
      "Tableau de bord des stocks et des ventes en temps réel, avec alertes de rupture.",
    ),
    end_year: 2025,
    end_month: 11,
    details: [
      ...bullets([
        "Designed the MongoDB data model and the REST API.",
        "Conception du modèle de données MongoDB et de l’API REST.",
      ]),
      ...technologies("React", "Node.js", "Express.js", "MongoDB", "Redis"),
    ],
  }),
  project({
    title_i18n: t("Open transport data pipeline", "Pipeline de données de transport ouvertes"),
    description_i18n: t(
      "Nightly pipeline that loads public transit timetables into PostgreSQL and publishes delay statistics.",
      "Pipeline nocturne qui charge les horaires des transports publics dans PostgreSQL et publie des statistiques de retard.",
    ),
    end_year: 2025,
    end_month: 3,
    details: technologies("Python", "PostgreSQL", "Docker", "GitHub Actions", "Linux"),
  }),
];

const DEMO_CERTIFICATIONS = [
  added({
    title_i18n: t(
      "Cloud fundamentals – professional certificate",
      "Fondamentaux du cloud – certificat professionnel",
    ),
    issuer_i18n: shared("Example Academy"),
    issued_year: 2025,
    issued_month: 5,
    credential_url: null,
  }),
];

const DEMO_SOFT_SKILLS = [
  t("Teamwork", "Travail en équipe"),
  t("Problem solving", "Résolution de problèmes"),
  t("Clear communication", "Communication claire"),
].map((label_i18n) => ({ id: null, label_i18n }));

const DEMO_LANGUAGES = [
  [t("French", "Français"), t("native", "langue maternelle")],
  [t("English", "Anglais"), shared("C1")],
  [t("Spanish", "Espagnol"), shared("B1")],
].map(([name_i18n, proficiency_i18n]) => ({ id: null, name_i18n, proficiency_i18n }));

async function loadDemoCareer(owner, profile) {
  const save = async (fn, payload) => {
    const { error } = await owner.rpc(fn, { payload });
    if (error) throw new Error(`${fn}: ${error.message}`);
  };

  await save("save_profile", { expectedUpdatedAt: profile.updated_at, ...DEMO_PROFILE });
  await save("save_skill_groups", { expectedStamp: null, groups: DEMO_SKILL_GROUPS });
  for (const experience of DEMO_EXPERIENCES) await save("save_experience", experience);
  for (const education of DEMO_EDUCATIONS) await save("save_education", education);
  for (const item of DEMO_PROJECTS) await save("save_project", item);
  for (const certification of DEMO_CERTIFICATIONS) {
    await save("save_certification", certification);
  }
  await save("save_soft_skills", { expectedStamp: null, items: DEMO_SOFT_SKILLS });
  await save("save_spoken_languages", { expectedStamp: null, items: DEMO_LANGUAGES });
}

// ---------------------------------------------------------------------------

async function main() {
  const options = readOptions();
  const email = options.email.trim();
  if (!PASSWORD_RULE.test(options.password)) {
    fail("The password needs at least 12 characters, with lowercase, uppercase and digits.");
  }

  const stack = localStack();
  const admin = createClient(stack.url, stack.secretKey, clientOptions);
  const account = await ensureAccount(admin, email, options.password);

  // The allowlist: only accounts listed here can use the workspace. Adding one
  // also creates its empty profile (trigger in the foundation migration).
  const allow = await admin.from("app_owners").upsert({ user_id: account.id });
  if (allow.error) throw allow.error;

  console.log(
    `Owner account ${account.created ? "created" : "updated"} on the local stack (${stack.url}).`,
  );
  console.log(`  Email     ${email}`);
  console.log(
    `  Password  ${options.password === DEFAULT_PASSWORD ? DEFAULT_PASSWORD : "the one you passed with --password"}`,
  );

  if (!options["account-only"]) {
    const owner = createClient(stack.url, stack.publishableKey, clientOptions);
    const signIn = await owner.auth.signInWithPassword({ email, password: options.password });
    if (signIn.error) throw signIn.error;

    const { data: profile, error } = await owner
      .from("profiles")
      .select("full_name, updated_at")
      .single();
    if (error) throw error;

    if (await hasCareerData(owner, profile)) {
      console.log("Demo career data skipped: this workspace already has career data.");
    } else {
      await loadDemoCareer(owner, profile);
      console.log(
        `Demo career data loaded: profile, ${DEMO_SKILL_GROUPS.length} skill groups, ` +
          `${DEMO_EXPERIENCES.length} experiences, ${DEMO_EDUCATIONS.length} education entries, ` +
          `${DEMO_PROJECTS.length} projects, ${DEMO_CERTIFICATIONS.length} certification, ` +
          `${DEMO_SOFT_SKILLS.length} soft skills, ${DEMO_LANGUAGES.length} languages.`,
      );
    }
  }

  console.log(
    [
      "",
      "Next: make sure .env.local points at this stack, run `pnpm dev`,",
      "then sign in at http://localhost:3000/en/login.",
      `  NEXT_PUBLIC_SUPABASE_URL=${stack.url}`,
      `  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${stack.publishableKey}`,
    ].join("\n"),
  );
}

main().catch((error) => {
  console.error(`Seeding failed: ${error?.message ?? error}`);
  console.error(
    "Fix the cause, then run `pnpm db:seed` again. To start over, `pnpm db:reset` " +
      "recreates the local database (it erases everything in it).",
  );
  process.exit(1);
});
