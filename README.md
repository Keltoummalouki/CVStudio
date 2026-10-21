# CVStudio

> **Your career information, organized once. Your CV, customized any time.**

**Status:** Phases 1–4 implemented (foundation, owner authentication and database, career data, CV Builder with live A4 preview), plus saved templates and print/PDF download. PDF download is verified locally but not yet on Vercel; hardening is next. See [Development and setup](#development-and-setup).

## Overview

CVStudio is a **private, owner/admin-managed CV generator**. Instead of repeatedly editing a PDF or word-processing document, the owner maintains structured career data in a dashboard backed by Supabase. A visual CV Builder then composes that data into a configurable document: choose which experiences and projects to include, reorganize sections/subsections, hide selected information, edit CV-specific wording, save a reusable template, preview, print, or download a PDF.

**MVP has no AI.** A later, separately scoped release may add optional AI features.

### Core product principles

- **Enter once, reuse everywhere.** Career data is the canonical source.
- **Flexible composition.** A CV is not a fixed form; its sections, subsections, entries, and fields can be configured.
- **Design fidelity.** The first visual template follows the owner's supplied CV design.
- **Two languages.** Full admin interface and CV output in French and English.
- **Fast and accessible.** Modern, mobile-first dashboard with clear loading, empty, error, and success feedback.
- **Private by default.** An authenticated owner controls all information and exports.

## Reference CV and visual direction

The initial design, **`classic-reference-v1`**, will be reconstructed from these user-provided PDFs:

| Reference file | Purpose |
| --- | --- |
| `Cv ENGLISH + RRENSH.pdf` | Compare French and English layouts (one page per language) |
| `keltoum_malouki_Developpeuse_web_Full_stack.pdf` | French layout reference |
| `keltoum_malouki_FULL_STACK_WEB_DEVELOPER.pdf` | English layout reference |

**Observed characteristics:** A4 portrait; Poppins Regular/Bold; bold title and name; compact contact row(s); fine horizontal rules; uppercase section labels; two-column technical-skill categories; work/project entries with descriptions, dates and technologies; compact education/certification/language information; optional circular portrait.

The PDFs contain different content revisions, so the actual wording, proficiency values, project counts, and portrait choice are **editable data/settings**, never immutable template constants. A one-page result is desirable only when content fits; multi-page output must remain readable.

## MVP features

### 1. Secure owner dashboard

Authenticated owner/admin only, with no open public registration. Dashboard provides quick actions, saved CVs, saved presets/templates, and completeness/status signals.

### 2. Career data manager

| Section | Structured editing capabilities |
| --- | --- |
| Personal information | Name, professional title, optional summary, contact details, location, profile photo, web/social links |
| Technical skills | Named groups (e.g., Languages, Frameworks & APIs, Databases, DevOps, Testing), individual skills, ordering |
| Work experience | Organization, role, location, start/end or Present, achievements/bullets, technologies, display order |
| Education | Institution, program/degree, location, dates, description |
| Projects | Project name, dates, descriptions, technologies, links, optional achievements |
| Certifications | Certificate, issuer, issued date, optional verification URL |
| Soft skills | Individual skills and optional grouping |
| Languages | Language name, proficiency/level, display order |
| Custom sections | Owner-created sections with titled subsections and supported text/list/entry blocks |

Every applicable entity supports **create, edit, delete, show/hide, and reordering** in the relevant workflow. Nested achievements, skill categories, technology lists, and custom subsections are separately manageable where meaningful. Display visibility in one CV does **not** delete master data.

### 3. CV Builder

Create a CV from scratch or from a saved preset:

1. Choose `English` or `Français` for the CV output.
2. Start with `classic-reference-v1` and select the content to include.
3. Add, hide/show, or reorder top-level sections and eligible subsections.
4. Include/exclude specific records (e.g., a job, project, certificate, skill, bullet).
5. Adjust per-CV wording or field visibility without editing the original master record.
6. See the document update in a live, A4-shaped preview.
7. Save your work; print or download PDF.

The dashboard interface language and the generated CV's language can be selected independently.

### 4. Saved CVs and saved templates

CVStudio deliberately distinguishes **three** things:

| Concept | Description |
| --- | --- |
| **Visual template** | Renderer and styling. Only the reference-based visual template is required at launch. |
| **Saved CV document** | Editable CV composition: language, chosen career records, section order/visibility, overrides. |
| **Saved template (preset)** | Reusable copy of a CV's composition settings. Can be created, named, edited, duplicated, applied, or deleted. |

**Example:** Save a preset called **Full Stack – English** and another called **Frontend – French**. When you create a new CV using either preset, it gets an independent configuration; later preset changes do not unexpectedly rewrite previously saved CVs.

Deleting a saved template must not erase existing CVs. Destructive operations require appropriate confirmation. Document names, creation time, update time, language, and recent actions should be visible in management lists.

### 5. Export and printing

- Print directly from the app.
- Download a genuine, selectable-text PDF.
- A4 print stylesheet with correct spacing, font, contact/URL rendering, and page breaks.
- Print and PDF should visually match the preview, apart from necessary screen-only editor chrome.
- Overflow should paginate instead of clipping or shrinking to unreadable sizes.
- Private generated documents by default; no public share links in the MVP.

The precise downloadable-PDF implementation will be chosen after validating the export path in the target deployment environment. A shared HTML + print CSS renderer is the intended starting point; a server-side Chromium-based export is a candidate.

### 6. Localization (English and French)

| Area | MVP behavior |
| --- | --- |
| Application | Full English/French navigation, forms, status text, errors, accessibility labels |
| CV headings | Localized section and field labels |
| Dates | Locale-aware date formatting without timezone shifts on date-only values |
| Content | Manually maintained English and French versions of text fields |
| Missing translation | Warning in the editor, no misleading automatic translation |
| Export | Uses the chosen CV language; clearly warns before optional fallback to other-language content |

**No AI translation** in the MVP. Changing the application interface language must not overwrite data in the other language.

### 7. UI and UX expectations

The **admin dashboard is mobile-first**, but the printed CV has its own fixed A4 page layout.

- **Desktop:** clear navigation, section tree, editing surface, live preview (side-by-side when space permits).
- **Mobile:** easy section navigation with editor/preview switching; generous touch targets; reorder controls that do not depend exclusively on dragging.
- **Reusable system:** buttons, inputs, textareas, select/combobox, date controls, confirmation dialogs, toggles, form fields, toasts, skeletons, cards, and empty/error states.
- **Feedback:** clear `Saving…`, `Saved`, validation, failed save/retry, loading placeholders matching the expected content, and leave-with-unsaved-changes protection.
- **Accessibility:** keyboard interaction, proper labels, visible focus, adequate contrast, semantic structure, reduced-motion support.
- **Performance:** lean client bundles, lazy-loading for expensive tools, appropriate data fetching and loading strategies.

The goal is a genuinely excellent editing experience, not just a stylish page.

## Functional workflows

### A. Add career information

`Log in → Career data → Choose section → Add/edit entries → Validate → Save to Supabase → Reuse in CV Builder`

### B. Create and export a CV

`Dashboard → New CV → Choose language/preset → Select content → Configure sections/subsections → Preview → Save → Print or Download PDF`

### C. Save and reuse a preset

`Open CV → Save as template → Give it a name → Manage in Templates → Apply to a new CV → Customize independently`

### D. Update a record safely

`Career data → Edit canonical entry → Save → Linked CVs show current canonical content unless an explicit per-CV override exists`

## Technical stack (planned)

| Layer | Proposed technology | Responsibility |
| --- | --- | --- |
| Framework | Next.js App Router + TypeScript | Routes, server/UI composition, type-safe application |
| Styling / design system | Tailwind CSS + shadcn/ui | Responsive reusable UI |
| Data and auth | Supabase PostgreSQL + Auth | Owner data, authenticated access, policies |
| Assets | Supabase Storage | Private profile pictures, if used |
| Forms and schemas | React Hook Form + Zod | Field validation and typed input |
| Internationalization | `next-intl` (candidate) | Locale routing and dictionaries |
| Reordering | `dnd-kit` (candidate) | Accessible section/item management |
| PDF | Shared HTML/print CSS + validated export engine | Preview, print, downloadable PDF |
| Tests | Vitest/RTL + Playwright (candidates) | Logic, components, end-to-end, regression |

Pin dependency versions when implementing. Confirm currently supported Next.js/Supabase setup in official docs before scaffolding.

## Architecture overview

```text
                         OWNER / ADMIN
                               |
                   Next.js authenticated dashboard
                      /                  \
             Career Data Manager       CV Builder
                      |                  |
                      v                  v
              Supabase PostgreSQL  <- CV compositions
              + private Storage     + saved templates
                               |
                      Shared CV renderer
                         /      |      \
                    Preview   Print   Download PDF

            Languages: English (en) / French (fr)
            AI services: NONE in the MVP
```

### Suggested project organization

```text
cvstudio/
├── CLAUDE.md
├── README.md
├── messages/
│   ├── en.json
│   └── fr.json
├── src/
│   ├── app/
│   │   ├── [locale]/
│   │   │   ├── (auth)/login/
│   │   │   ├── (dashboard)/dashboard/
│   │   │   │   ├── profile/
│   │   │   │   ├── content/
│   │   │   │   ├── cvs/
│   │   │   │   └── templates/
│   │   │   └── (print)/print/[cvId]/
│   │   └── api/cvs/[cvId]/pdf/
│   ├── components/{ui,layout,forms,cv}/
│   ├── features/{profile,career-data,cv-builder,cv-documents,cv-templates}/
│   ├── lib/{auth,supabase,i18n,validation,pdf}/
│   └── types/
├── supabase/migrations/
└── tests/
```

This is a **proposed** structure, not a claim that these folders already exist.

## Data model — preliminary proposal

The final schema will be agreed before migrations. Prefer separate relational tables for master data, plus a validated versioned composition format for saved CVs/presets.

| Entity/table | What it stores |
| --- | --- |
| `profiles` | Owner profile and contact fields |
| `experiences` | Roles, companies, dates, localized achievements, technology lists |
| `educations` | Institutions, credentials, dates and localized descriptions |
| `skill_groups`, `skills` | Categories, contained skills, sort order |
| `projects` | Projects, technologies, localized text, links |
| `certifications` | Certificates, issuers, dates, verification URLs |
| `languages`, `soft_skills` | Spoken languages/levels and soft skills |
| `custom_sections` | Custom section/subsection content blocks |
| `cv_documents` | Named editable CVs with a validated, versioned composition definition |
| `cv_templates` | Named reusable presets with their own versioned definitions |

Common expectations: UUID identifiers, `owner_id`, timestamps, relevant order fields, constraints/indexes, and Row Level Security. Use typed localized fields, e.g. a carefully validated `{ en, fr }` object, for content that may differ by language.

### Composition rules

- Stable IDs for sections/subsections/items.
- Ordered section tree and per-node visibility.
- Chosen references to canonical records plus optional field-level overrides.
- `schema_version` for safe future changes.
- Applying a template copies its configuration into a new CV, keeping previous documents independent.
- Explicit strategy for canonical-record deletion and missing references; do not silently lose CV content.
- Resolve a consistent composition snapshot during each export.

## Privacy and security

CVs contain private personal information. Security is mandatory:

- Public sign-up disabled for MVP; access is limited to a provisioned owner.
- Protect dashboard, mutation, print, and PDF endpoints with server-side auth and ownership checks.
- Enable Supabase RLS on every exposed table; use owner-specific policies for read and writes.
- Use private Storage policies; no public access to photos or exports by default.
- Do not expose Supabase secret/service-role keys to the browser.
- Validate every incoming mutation and any persisted CV JSON schema on the server.
- Defend against IDOR, malicious URLs, unsafe rich text, oversized uploads, and uncontrolled PDF generation.
- Do not commit production CV data, credentials, or actual exported documents to the repository.

## Development and setup

**Implemented:** Phase 1 (locale routing, dashboard shell, design system, overview), Phase 2 (owner authentication, reviewed migrations with RLS, private storage, authorization tests), Phase 3 (career data: profile and photo, technical skills, experience, education, projects, certifications, soft skills, languages and custom sections; bilingual fields with a "same in both languages" option; ordering, archiving and atomic saves) and Phase 4 (CV Builder: create, rename, duplicate, delete with undo; per-CV language; section, entry, achievement, skill and link selection, order and visibility; per-CV wording; live `classic-reference-v1` A4 preview; missing-translation and archived-record checks; autosave with conflict detection; undo/redo; phone edit/preview switch). Print and PDF download also work locally (a print-only A4 page, and a server-rendered PDF with selectable text, live links and ATS-friendly reading order, blocked while translations are missing); the PDF path on Vercel is not verified yet. Saved templates are implemented too: save a CV's setup as a new template or over an existing one (after a warning), list them with how many CVs came from each, edit them in the same builder, duplicate, delete with undo, and start new CVs from one. Hardening follows; see the roadmap below.

### Prerequisites

- Node.js `^22.12` or `>=24` (developed on 24.21).
- pnpm `10.30.3`. The version is pinned in `package.json`; `corepack enable` selects it automatically.
- Docker, for the local Supabase stack used by development, database tests and end-to-end tests.
- A **development** Supabase project for shared/hosted use. Never point development at production data.

### First run (local stack)

```bash
pnpm install
pnpm db:start                # local Postgres, Auth and Storage in Docker; applies supabase/migrations
pnpm exec supabase status    # shows the local API URL and publishable key
cp .env.example .env.local   # put the local URL and publishable key in .env.local
pnpm dev                     # http://localhost:3000 → /en or /fr → login
```

The app has **no public sign-up**. Create the owner with the Supabase admin API or the local Studio, then allowlist it (see *Owner provisioning*).

### Connecting a hosted Supabase project

Run these yourself: they need your Supabase login and database password.

```bash
pnpm exec supabase login
pnpm exec supabase link --project-ref <your-project-ref>
pnpm exec supabase db push   # applies the reviewed migrations in supabase/migrations
```

Then, in the Supabase dashboard:

1. **Authentication → Sign In / Providers**: turn **off** "Allow new users to sign up"; keep the Email provider on.
2. **Authentication → Passwords**: minimum length 12, requiring lowercase, uppercase and digits (mirrors `supabase/config.toml`).
3. **Authentication → Users → Add user**: create the owner account with a strong password ("Auto Confirm User").

### Owner provisioning

An account can sign in only when it is on the allowlist. In the SQL editor (or `psql` locally):

```sql
insert into public.app_owners (user_id)
select id from auth.users where email = 'owner@example.com';
```

A trigger creates the owner's empty profile automatically. A signed-in account that is not allowlisted is signed straight back out and sees no data (enforced by RLS on every table and on Storage).

Environment variables (see `.env.example`):

| Variable | Exposure | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser-safe | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe | Publishable key; the app refuses `sb_secret_…` or `service_role` keys here |
| `APP_TIME_ZONE` | Server only | IANA zone used to display timestamps (default `UTC`) |

### Scripts (all verified)

| Command | What it does |
| --- | --- |
| `pnpm dev` | Development server (Turbopack) |
| `pnpm build` / `pnpm start` | Production build (includes the type check) / serve it |
| `pnpm lint` | ESLint (Next core-web-vitals and TypeScript rules, localized-navigation guard) |
| `pnpm typecheck` | Generates route types, then runs `tsc --noEmit` |
| `pnpm format` / `pnpm format:check` | Prettier with Tailwind class sorting |
| `pnpm test` | Vitest unit and component tests (jsdom) |
| `pnpm test:db` | Database integration tests (RLS per table, cross-owner isolation, storage, constraints) against the **local** stack only |
| `pnpm test:e2e` | Playwright on desktop and mobile Chromium against a fresh production build wired to the local stack (login flows, navigation, career data, CV builder, cross-owner access, axe WCAG 2.2 AA). A second allowlisted test owner with a seeded, generic career profile isolates the builder flows. First run: `pnpm exec playwright install chromium` |
| `pnpm check` | format check, lint, typecheck and unit tests |
| `pnpm db:start` / `db:stop` / `db:reset` | Local Supabase stack lifecycle (`db:reset` re-applies all migrations) |
| `pnpm db:types` | Regenerates `src/lib/supabase/database.types.ts` from the local schema |
| `pnpm clean` | Removes `.next` (also works when OneDrive has turned it into read-only placeholders) |

Database and end-to-end tests refuse to run against anything but `127.0.0.1`/`localhost`, and only create disposable `@cvstudio.test` accounts.

### Project layout

```text
src/
  proxy.ts                 # session refresh + optimistic login redirect + next-intl routing
  app/[locale]/            # (auth)/login, (dashboard)/ with the shell and the owner gate
  components/{ui,layout,feedback,forms,brand}/
  config/                  # navigation, career-section registry, milestone availability
  features/{auth,dashboard,career-data}/
  features/cv-builder/     # composition schema, resolver, edit operations, builder UI
  features/cv-documents/   # CV list, creation, autosave, duplicate/delete actions
  features/cv-renderer/    # classic-reference-v1 A4 renderer (Poppins, CSS module)
  components/forms/        # LocalizedField, PeriodField, SortableList, save bar, unsaved-changes guard
  lib/auth/                # route policy, session + allowlist data-access layer
  lib/{i18n,supabase,env,data}/
messages/{en,fr}.json      # every UI string, both languages
supabase/
  config.toml              # local stack: sign-ups disabled, strong passwords
  migrations/              # reviewed schema, RLS, storage (applied by db:start / db push)
tests/{unit,db,e2e}/
docs/                      # specifications; docs/reference-cvs/ is gitignored (personal data)
DESIGN.md                  # dashboard design system ("Swiss grid")
```

### CV composition model (Phase 4)

A CV stores a versioned, Zod-validated `definition` (`src/features/cv-builder/definition.ts`) that records choices, never copies of career data:

- **Live data:** the CV always shows the current career data, except text the owner rewrote for that CV. Overrides are stored per language, so switching a CV between English and French loses nothing.
- **Entries are opt-in:** experience, education, project, certification and custom-section entries are chosen per CV. New career entries are offered under "Not in this CV", never added silently.
- **Details are opt-out:** achievements, technologies, skills, list items and profile links added later appear automatically; each CV can hide or reorder them.
- **Archived entries** keep showing on CVs that use them, with a warning. Entries **deleted** from career data are reported as missing and render nothing.
- **Missing translations** are listed per CV ("Before you export"). They are shown in the preview, marked, and will block print and PDF export (Phase 6). They are resolved by translating in career data, rewording for the CV, or hiding the item.
- **Resolution** is one pure function (`src/features/cv-builder/resolve.ts`) shared by the live preview and the future print/PDF route; the renderer (`src/features/cv-renderer/classic-reference-v1`) is purely presentational, with CSS-module styles in physical units isolated from the dashboard.
- **Saving:** the builder autosaves (debounced) with the document `revision`; a write from another tab or device is reported as a conflict (keep mine / load theirs) instead of being overwritten. Deleted CVs are kept (soft delete) so the deletion can be undone.
- **Templates** (`src/features/cv-templates`) hold the same `definition` plus a name, description and language, and are edited with the same builder. They are copy-on-apply: a CV started from a template gets its own copy of the definition and only records the template's id and name as provenance (no foreign key), so editing, replacing or deleting a template never changes existing CVs. Like CVs, templates read live career data; entries added after a template was saved are not selected in CVs made from it.

### Security model (Phase 2)

- **Allowlist:** `app_owners` lists who may use the workspace. It is read-only for signed-in users; only an administrator can add rows.
- **RLS on every table:** one policy per command, requiring `owner_id = auth.uid()` *and* allowlist membership (a `security definer` helper in the non-exposed `private` schema, evaluated once per statement). Anonymous access is revoked at the grant level.
- **Integrity:** child rows reference `(owner_id, parent_id)`, so nothing can be attached to another owner's record. Localized text, periods and URLs are validated by database checks as well as Zod.
- **Storage:** private `cvstudio-assets` bucket, images only, 5 MiB, owner-prefixed paths; no public URLs.
- **Server-side checks:** the proxy redirect is a convenience; every page and data function verifies the JWT (`getClaims`) and the allowlist again. Post-login redirects only accept same-origin dashboard paths.
- **Concurrency:** CV documents and templates carry a `revision` that increments on every write, so stale editors cannot silently overwrite newer changes.

### Version pins worth knowing

- **TypeScript 6.0**: TypeScript 7 is not supported yet by `typescript-eslint`.
- **ESLint 9**: `eslint-config-next` bundles plugins that do not support ESLint 10 yet.
- **Next.js 16.4** runs with `cacheComponents` and `partialPrefetching` enabled, so pages prerender as static shells per locale.

### Remaining setup steps (later phases)

1. Verify PDF generation on Vercel before advertising Download PDF as supported.
2. Vercel project environment variables (URL and publishable key of the hosted project).

Useful official resources: [Next.js docs](https://nextjs.org/docs), [Supabase docs](https://supabase.com/docs), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [shadcn/ui](https://ui.shadcn.com/), [Tailwind CSS](https://tailwindcss.com/docs).

## Definition of done — MVP acceptance criteria

- [ ] Only the provisioned owner can access the dashboard, career data, CVs, templates, and export routes.
- [ ] The owner can CRUD structured entries (and relevant nested items) through intuitive forms.
- [ ] Each built-in section can be included/hidden/reordered; custom sections/subsections are editable.
- [ ] Individual CV records, bullets, skills, and supported fields can be shown/hidden or reordered.
- [ ] UI is translated to English and French; CV text can be maintained separately in each language.
- [ ] Missing translations are clearly identified; there is no AI or silent text auto-translation.
- [ ] The reference-based `classic-reference-v1` follows the supplied A4 CV layout.
- [ ] Photo, contacts, section order, optional groups, and selected entries are reflected in preview and output.
- [ ] Owner can save/edit/duplicate/delete CVs and saved presets independently without unintended data loss.
- [ ] Print works; Download produces an actual selectable-text PDF with no clipped, overlapping, or lost content.
- [ ] Single-page and multi-page CVs have sensible layout; English/French export tested.
- [ ] Forms have validation and graceful loading, empty, success, and failure states; unsaved work is protected.
- [ ] Desktop and mobile flows are usable; keyboard/touch interactions and basic accessibility are verified.
- [ ] RLS/IDOR checks and core builder/export tests pass.
- [ ] No AI integrations, AI secrets, or AI-backed flows exist in the MVP.

## Development roadmap

| Phase | Deliverable |
| --- | --- |
| **0 — Design & specification** | Confirm CV reference fidelity, data model, interactions, and page-break rules |
| **1 — Foundation** | Next.js repo, design system, i18n, owner auth, Supabase RLS |
| **2 — Data management** | Structured CRUD pages for all built-in sections and optional custom blocks |
| **3 — CV Builder** | Composition state, section tree, selection, overrides, responsive editor/live preview |
| **4 — Saved CVs & presets** | Save, list, edit, duplicate, apply, delete; safe copy/snapshot behavior |
| **5 — Print & PDF** | A4 styling, reference-template fidelity, export, PDF regression tests |
| **6 — MVP hardening** | Accessibility, loading/error states, security review, E2E, performance, release |
| **Later — AI (not MVP)** | Optional, human-reviewed writing/translation/job-tailoring features, separately scoped |

## Contributing / working with Claude

Coding-agent rules, architecture boundaries, security practices, UI conventions, localization expectations, and quality gates are in [`CLAUDE.md`](./CLAUDE.md). Always review that file before implementing features. Prioritize a small, complete, tested slice over broad scaffolding and empty placeholder pages.

---

**CVStudio v1 goal:** A private, bilingual, highly flexible CV workspace that turns structured career data into professional, editable, reusable, print-ready CVs — **without AI**.
