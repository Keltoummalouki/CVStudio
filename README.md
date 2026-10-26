# CVStudio

> **Your career information, organized once. Your CV, customized any time.**

**Status:** Phases 1–4 implemented (foundation, owner authentication and database, career data, CV Builder with live A4 preview), plus template designs (a free-form A4 designer) and print/PDF download, verified locally and in production on Vercel. AI phase: the job-post match score and CVs tailored to a job post are built. Hardening is in progress. To run your own copy, see [Getting started](#getting-started).

## Overview

CVStudio is a **private, owner/admin-managed CV generator**. Instead of repeatedly editing a PDF or word-processing document, the owner maintains structured career data in a dashboard backed by Supabase. A visual CV Builder then composes that data into a configurable document: choose which experiences and projects to include, reorganize sections/subsections, hide selected information, edit CV-specific wording, lay it out with the included Classic design or a template the owner designed, preview, print, or download a PDF.

**The MVP has no AI.** An optional AI phase was approved on 2026-10-22, built in this order: an ATS match score against a pasted job post, then CVs tailored to a job post from the owner's career data, then translation suggestions. The owner reviews every AI suggestion before it is saved or exported; see [`CLAUDE.md`](./CLAUDE.md) §16.

### Core product principles

- **Enter once, reuse everywhere.** Career data is the canonical source.
- **Flexible composition.** A CV is not a fixed form; its sections, subsections, entries, and fields can be configured.
- **Design fidelity.** The first visual template follows the owner's supplied CV design.
- **Two languages.** Full admin interface and CV output in French and English.
- **Fast and accessible.** Modern, mobile-first dashboard with clear loading, empty, error, and success feedback.
- **Private by default.** An authenticated owner controls all information and exports.

## Getting started

How to run your own CVStudio: install it, create its Supabase database, create the owner (admin) account, load demo data, turn on AI with Groq, and deploy. CVStudio serves **one owner**: there is no public sign-up, and only the account you allowlist can use the workspace.

Choose where the database runs. Both options use the same migrations (`supabase/migrations`), so you can start locally and add a hosted project when you deploy.

| | Option A: local stack | Option B: hosted Supabase project |
| --- | --- | --- |
| Good for | Development, trying the app with demo data, the database and end-to-end tests | A deployed instance, or development without Docker |
| Needs | Docker Desktop, running | A free [Supabase](https://supabase.com) account |
| Owner account | `pnpm db:seed`, one command | The Supabase dashboard and one SQL statement |

### 1. Prerequisites

- **Node.js** `^22.12` or `>=24` (developed on 24).
- **pnpm** `10.30.3`, the version pinned in `package.json`: `npm install -g pnpm@10.30.3`, or `corepack enable` with a Node.js that still ships Corepack (Node 24 does), which then uses the pinned version.
- **Git**, and **Docker Desktop** for option A. The Supabase CLI is a project dependency: run it with `pnpm exec supabase …`, no separate install.
- Optional accounts: [Groq](https://console.groq.com) for the AI features, [Vercel](https://vercel.com) to deploy.

### 2. Install

```bash
git clone <repository-url> cvstudio
cd cvstudio
pnpm install
cp .env.example .env.local   # works in PowerShell too
```

`.env.local` holds your settings and keys. Git ignores it: never commit it. Every variable is described in [Environment variables](#environment-variables).

### 3. Set up the database

#### Option A: local stack (Docker)

```bash
pnpm db:start   # Postgres, Auth, Storage and the API in Docker, with every migration applied
pnpm db:seed    # the owner account, allowlisted, with a demo career
```

`pnpm db:seed` ends by printing the two values the app needs. `.env.example` already holds the local URL; replace the placeholder key with the printed one (`pnpm exec supabase status` shows both again at any time):

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
```

What `pnpm db:seed` does (`scripts/seed-local.mjs`):

- **Owner account:** creates `owner@example.com` with the password `Owner-Pass-2026`, already confirmed, and adds it to the allowlist (`public.app_owners`), which also creates its empty profile. Choose your own with `pnpm db:seed --email you@example.com --password Your-Pass-2026`: at least 12 characters, with lowercase, uppercase and digits (the password rules in `supabase/config.toml`).
- **Demo career:** a made-up person, *Camille Example*, written in English and French: profile and links, 6 skill groups, 2 experiences, 2 education entries, 3 projects, a certification, soft skills and languages. It goes through the same database functions as the dashboard, signed in as the owner, so the same checks apply. `--account-only` skips it and leaves the workspace empty.
- **Safe to repeat:** another run sets the account's password again (the default, or the one given) and never touches a workspace that already has career data.
- **Local only:** it refuses any Supabase that is not on this machine, so its well-known default password never reaches a hosted project.

Day to day:

- `pnpm db:stop` stops the stack and keeps its data; `pnpm db:start` brings it back.
- After pulling new migrations, `pnpm exec supabase migration up --local` applies them and keeps your data. `pnpm db:reset` rebuilds the database from scratch and **erases it**; run `pnpm db:seed` again afterwards.
- `pnpm db:start` leaves out Supabase Studio to save memory. To get Studio (http://127.0.0.1:54323), run `pnpm db:stop`, then `pnpm exec supabase start`.

#### Option B: hosted Supabase project

**Create the project and its tables**

1. In the [Supabase dashboard](https://supabase.com/dashboard), select **New project**. Choose a strong database password and keep it (linking asks for it), and the region nearest to where the app will run (see [Deploy to Vercel](#6-deploy-to-vercel-optional)).
2. Link this folder to the project and apply the migrations. The project ref is the id in the dashboard address (`supabase.com/dashboard/project/<project-ref>`), also listed under **Settings → General**.

   ```bash
   pnpm exec supabase login                              # signs in through the browser
   pnpm exec supabase link --project-ref <project-ref>   # asks for the database password
   pnpm exec supabase db push --dry-run                  # lists the migrations to apply
   pnpm exec supabase db push                            # applies them
   ```

   `db push` creates the tables, the Row Level Security policies and the private storage bucket; it loads no data. Run it again whenever new migrations arrive, before deploying the code that needs them.

**Lock down sign-in** (the same rules as `supabase/config.toml`)

3. **Authentication → Sign In / Providers:** turn **off** *Allow new users to sign up*, and keep the **Email** provider on.
4. **Authentication → Sign In / Providers → Email:** minimum password length **12**, requiring lowercase, uppercase letters and digits.

**Create the owner (admin) account**

5. **Authentication → Users → Add user → Create new user:** your email and a strong password, with **Auto Confirm User** ticked. Keep the password in a password manager: the app has no password-reset page.
6. **SQL Editor:** add the account to the allowlist, which also creates its empty profile.

   ```sql
   insert into public.app_owners (user_id)
   select id from auth.users where email = 'you@example.com';

   -- Check: lists the allowlisted accounts.
   select u.email from public.app_owners o join auth.users u on u.id = o.user_id;
   ```

   Any other account that signs in is signed straight back out, and Row Level Security hides every row from it anyway.

**Connect the app**

7. In `.env.local`, set the project URL and its **publishable** key. Both are in the project's **Connect** dialog; the key is also under **Settings → API Keys**.

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
   ```

   Never put a secret key (`sb_secret_…`) or the legacy `service_role` key here: `NEXT_PUBLIC_` values reach the browser, and the app rejects them.

A hosted workspace starts empty: sign in and fill in **Career data**. Demo data stays on the local stack (`pnpm db:seed` is local-only on purpose).

### 4. Run the app

```bash
pnpm dev
```

Open http://localhost:3000 (it redirects to `/en` or `/fr`) and sign in with the owner account. Next.js reads `.env.local` only when it starts: restart `pnpm dev` after editing it.

A first tour: **Career data** holds the master records. **New CV** asks for a template (*Classic* or one of yours), a language and what goes in, then lets you pick, hide and reorder everything next to a live A4 preview; **Print** and **Download PDF** export it. **Templates** → *Create a template* opens the A4 designer. **Job match** compares a pasted job post with your CVs.

**Download PDF** needs a Chromium-based browser on the server. Locally, that is Playwright's Chromium when installed (`pnpm exec playwright install chromium`), otherwise your Chrome or Edge; `PDF_CHROMIUM_PATH` points it at another binary. On Vercel, a packaged Chromium is used.

Before a pull request, run `pnpm check` (format, lint, types, unit tests) and, with the local stack running, `pnpm test:db` and `pnpm test:e2e`; see [Scripts](#scripts-all-verified).

### 5. AI features with Groq (optional)

AI reads a job post once (you review and correct the requirements it lists) and chooses what a CV tailored to a job shows. The match score itself never calls AI, and each AI step has a manual alternative. Groq answers first; Google Gemini is an optional fallback. The keys stay on the server.

**Create a Groq API key**

1. Sign in at [console.groq.com](https://console.groq.com). The free plan is enough to start.
2. Open **API Keys** ([console.groq.com/keys](https://console.groq.com/keys)) → **Create API Key**. Name it after the environment (for example `cvstudio-local`) and copy it at once: it starts with `gsk_` and is shown only once. Use one key per environment, so that each can be revoked on its own.
3. Recommended: in **Settings → Data Controls** ([console.groq.com/settings/data-controls](https://console.groq.com/settings/data-controls)), an organization admin can turn on **Zero Data Retention**. Groq's terms forbid training on what you send, and it keeps no copy of requests by default, apart from logs held for up to 30 days to troubleshoot or investigate abuse; Zero Data Retention stops those too.

**Set it up in the project**

4. Add the key to `.env.local`, then restart `pnpm dev`. These variables are server-only: never prefix them with `NEXT_PUBLIC_`.

   ```dotenv
   AI_PRIMARY_PROVIDER=groq
   GROQ_API_KEY=gsk_…
   # Optional, default openai/gpt-oss-20b. Another model must support strict
   # structured outputs on Groq, for example openai/gpt-oss-120b.
   # GROQ_MODEL=openai/gpt-oss-20b
   ```

5. **Turn AI on.** It stays off until the owner enables it. Open **Settings → AI features**: the primary provider should read *Ready · openai/gpt-oss-20b*, or the panel says what is missing. Tick **Use AI for job posts and CVs**, change the **Daily limit** if you like (10 requests a day by default, from 1 to 50; failed requests count too, and the count resets at midnight UTC), then **Save AI settings**.
6. **Try it.** **Job match → Add a job post**: paste the ad, choose **Analyze with AI**, correct the requirements and save; the job page then scores every CV. **New CV → Tailored to a job post**: paste or pick a post, and review what the AI chose (two projects, the skills shown, a suggested title) before **Create and open**. Without AI, *Enter requirements myself* and *Choose by keywords* do the same by hand.

**Optional: Gemini as the fallback.** Gemini answers only when Groq is unavailable: a timeout, a rate limit, a request too large for your Groq plan, an outage. Create a key in [Google AI Studio](https://aistudio.google.com/apikey) in a Google Cloud project **with billing enabled** (on the free tier, Google may use what you send to improve its products, and its terms forbid personal data there), set it as `GEMINI_API_KEY`, and add a budget alert in Google Cloud Billing. `AI_PRIMARY_PROVIDER=gemini` puts Gemini first.

**No key yet?** `AI_FAKE_PROVIDER=1` in `.env.local` answers with deterministic test data instead of calling Groq or Gemini (Settings shows *Test provider*), so every AI screen can be tried offline. It works locally only; Vercel ignores it.

**What is sent:** reading a job post sends only the pasted text. Tailoring sends the job's requirements and your projects and skills (titles, short descriptions, technologies), never your name, contacts, photo or links. Settings lists today's usage, the latest requests and an estimated monthly cost (for models with a known price; a free-plan Groq key is not billed). How it all works: [Job posts and the ATS match score](#job-posts-and-the-ats-match-score-ai-phase-step-1).

### 6. Deploy to Vercel (optional)

1. Push the repository to GitHub. In Vercel, choose **Add New → Project** and import it: Next.js and pnpm are detected, so keep the default build settings.
2. **Settings → Environment Variables**, for **Production**: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` of the hosted project, `APP_TIME_ZONE` (for example `Europe/Paris`) and, for AI, `AI_PRIMARY_PROVIDER` and `GROQ_API_KEY` (plus `GROQ_MODEL` or `GEMINI_API_KEY` if you use them), with the keys marked **Sensitive**. Point **Preview** deployments at a development project, never at production data. Never set `AI_FAKE_PROVIDER` or `GOOGLE_GENAI_DEBUG`.
3. **Region:** `vercel.json` runs the functions in Dublin (`dub1`), next to a Supabase project in Ireland or London. Change `regions` to the Vercel region nearest your Supabase project: every page reads the database several times.
4. Deploy. Changed variables only reach new deployments, so redeploy after editing them.

Before going live, work through the [Production checklist](#production-checklist). [Continuous integration and deployment](#continuous-integration-and-deployment) covers CI, deployment checks and the manual migrations workflow.

### Troubleshooting

| Problem | Fix |
| --- | --- |
| *Supabase is not configured* on the sign-in page | Add the URL and publishable key to `.env.local`, then restart `pnpm dev` |
| *Email or password is incorrect* | Locally, `pnpm db:seed --email you@example.com --password Your-Pass-2026` sets a new password. Hosted: check the account under **Authentication → Users** |
| *This account is not allowed to use this workspace* | The account is not allowlisted: step 6 of option B (`pnpm db:seed` does it locally) |
| *Local Supabase is not running* | Start Docker Desktop, then `pnpm db:start` |
| Windows: `pnpm db:start` fails with *bind: An attempt was made to access a socket in a way forbidden* | Windows has reserved those ports (`netsh interface ipv4 show excludedportrange protocol=tcp`). In an administrator terminal, run `net stop winnat`, then `net start winnat`, and start again |
| **Settings → AI features** shows *Not set up* | The panel names the problem (missing or malformed key, invalid model). Fix `.env.local` and restart `pnpm dev`, or fix the Vercel variable and redeploy |
| *AI is off. Turn it on in Settings…* | **Settings → AI features** → tick *Use AI for job posts and CVs* → **Save AI settings** |
| *You’ve used today’s AI requests* | The daily limit is reached: wait until midnight UTC, or raise the limit in Settings (up to 50) |
| **Download PDF** fails locally | Install a browser for it: `pnpm exec playwright install chromium`, or Chrome or Edge |
| `EBUSY` or `EPERM` errors, or a `.next` folder that cannot be deleted, inside OneDrive | `pnpm clean`; better, keep the project outside synced folders |

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

Create a CV from the included Classic design or from a template you designed:

1. Choose `English` or `Français` for the CV output.
2. Choose Classic (`classic-reference-v1`) or one of your template designs; the CV starts with all current career data, then keep what fits.
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
| **Visual template** | The renderer: Classic (`classic-reference-v1`, reproduced from the reference CVs) or `canvas-v1`, which draws an owner-made design. |
| **Saved CV document** | Editable CV composition: language, chosen career records, section order/visibility, overrides. |
| **Template (design)** | An owner-made page design: where the name, contacts, career sections, free text, lines, shapes and photo sit on up to three A4 pages, and how they look. It holds no career data. Created from a blank page in the designer, edited, duplicated, applied, or deleted. |

**Example:** Design a template with the photo and contacts in a tinted left column, and another, text-only one for applicant tracking systems. A new CV made from either gets its own copy of the design, filled with the career data; later changes to the template never rewrite CVs already made from it.

Before 2026-10-23, *Save as template* stored a CV's section setup as a template. Those rows are kept in the database but are no longer listed or offered: templates are designs only.

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

**No automatic translation.** The MVP has no AI translation; the AI phase adds translation suggestions that the owner reviews and accepts one by one. Changing the application interface language must not overwrite data in the other language.

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

`Dashboard → New CV → Choose template and language → Select content → Configure sections/subsections → Preview → Save → Print or Download PDF`

### C. Design and reuse a template

`Templates → Create a template (blank A4 page) → Add elements → Drag, resize and style them → Use for a new CV → Customize the CV independently`

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
            AI services: none in the MVP; Groq, with Gemini as fallback (server-only, opt-in), in the AI phase
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
| `cv_documents` | Named editable CVs with a validated, versioned composition definition, and their own copy of the design they were made from |
| `cv_templates` | Owner-made page designs (a validated, versioned `design` layout) |

Common expectations: UUID identifiers, `owner_id`, timestamps, relevant order fields, constraints/indexes, and Row Level Security. Use typed localized fields, e.g. a carefully validated `{ en, fr }` object, for content that may differ by language.

### Composition rules

- Stable IDs for sections/subsections/items.
- Ordered section tree and per-node visibility.
- Chosen references to canonical records plus optional field-level overrides.
- `schema_version` for safe future changes.
- Applying a template copies its design into a new CV, keeping previous documents independent.
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

**Implemented:** Phase 1 (locale routing, dashboard shell, design system, overview), Phase 2 (owner authentication, reviewed migrations with RLS, private storage, authorization tests), Phase 3 (career data: profile and photo, technical skills, experience, education, projects, certifications, soft skills, languages and custom sections; bilingual fields with a "same in both languages" option; ordering, archiving and atomic saves) and Phase 4 (CV Builder: create, rename, duplicate, delete with undo; per-CV language; section, entry, achievement, skill and link selection, order and visibility; per-CV wording; live `classic-reference-v1` A4 preview; missing-translation and archived-record checks; autosave with conflict detection; undo/redo; phone edit/preview switch). Print and PDF download also work locally (a print-only A4 page, and a server-rendered PDF with selectable text, live links and ATS-friendly reading order, blocked while translations are missing), on Vercel too. Templates are page designs: a free-form A4 designer (start from a blank page; add, drag, resize and style elements with snapping guides, keyboard moves, undo/redo and autosave; layout checks), a gallery with how many CVs came from each, duplicate, delete with undo, and new CVs drawn by a design in the preview, print and PDF (see *Template designs*). Hardening follows; see the roadmap below. AI phase, step 1 is implemented: job posts with owner-reviewed requirements (typed, or read by AI: Groq, with Gemini as the fallback) and a deterministic ATS match score for every CV (see *Job posts and the ATS match score*).

To set up a copy from a fresh clone (database, owner account, demo data, AI, deployment), follow [Getting started](#getting-started). The sections below are the reference.

### Environment variables

`.env.example` is the template for `.env.local`. Next.js reads these variables when it starts; on Vercel, set them per environment, then redeploy.

| Variable | Exposure | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser-safe | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe | Publishable key; the app refuses `sb_secret_…` or `service_role` keys here |
| `APP_TIME_ZONE` | Server only | IANA zone used to display timestamps (default `UTC`) |
| `PDF_CHROMIUM_PATH` | Server only, optional | Browser binary for PDF export outside Vercel. Unset: Playwright's Chromium, then the installed Chrome or Edge |
| `AI_PRIMARY_PROVIDER` | Server only | `groq` (default) or `gemini`: which provider answers first; the other is the fallback. Any other value turns AI off and Settings says why |
| `GROQ_API_KEY` | Server only | Groq API key for the AI features (job-post analysis, tailored CVs); never prefix it with `NEXT_PUBLIC_` |
| `GROQ_MODEL` | Server only | Groq model (default `openai/gpt-oss-20b`); it must support strict structured outputs |
| `GEMINI_API_KEY` | Server only | Gemini API key, the fallback; never prefix it with `NEXT_PUBLIC_`. Without either key, AI is shown as not set up |
| `AI_FAKE_PROVIDER` | Server only, local and CI | `1` answers AI requests with deterministic fakes instead of Groq and Gemini (used by the e2e suite). Ignored on Vercel |
| `GOOGLE_GENAI_DEBUG` | Never set | The SDK would log every request and response; AI refuses to run while it is set |

### Scripts (all verified)

| Command | What it does |
| --- | --- |
| `pnpm dev` | Development server (Turbopack) |
| `pnpm build` / `pnpm start` | Production build (includes the type check) / serve it |
| `pnpm lint` | ESLint (Next core-web-vitals and TypeScript rules, localized-navigation guard) |
| `pnpm typecheck` | Generates route types, then runs `tsc --noEmit` |
| `pnpm format` / `pnpm format:check` | Prettier with Tailwind class sorting |
| `pnpm test` | Vitest unit and component tests (jsdom) |
| `pnpm test:coverage` | The same tests with V8 coverage; fails below the thresholds in `vitest.config.mts`. HTML report in `coverage/index.html` |
| `pnpm test:db` | Database integration tests (RLS per table, cross-owner isolation, storage, constraints) against the **local** stack only |
| `pnpm test:e2e` | Playwright on desktop and mobile Chromium against a fresh production build wired to the local stack (login flows, navigation, career data, CV builder, cross-owner access, axe WCAG 2.2 AA). A second allowlisted test owner with a seeded, generic career profile isolates the builder flows. First run: `pnpm exec playwright install chromium` |
| `pnpm check` | format check, lint, typecheck and unit tests |
| `pnpm db:start` / `db:stop` / `db:reset` | Local Supabase stack lifecycle (`db:reset` re-applies all migrations) |
| `pnpm db:seed` | **Local** stack only: creates or resets the owner account (default `owner@example.com` / `Owner-Pass-2026`), allowlists it and loads a generic bilingual demo career into an empty workspace. Options `--email`, `--password`, `--account-only` |
| `pnpm db:types` | Regenerates `src/lib/supabase/database.types.ts` from the local schema |
| `pnpm clean` | Removes `.next` (also works when OneDrive has turned it into read-only placeholders) |

Database and end-to-end tests refuse to run against anything but `127.0.0.1`/`localhost`, and only create disposable `@cvstudio.test` accounts.

### Continuous integration and deployment

**CI** (`.github/workflows/ci.yml`) runs on every pull request and every push to `main`. It needs no secret and never touches a hosted Supabase project, so pull requests from forks run the same checks safely.

| Check | What it runs |
| --- | --- |
| `Lint & types` | `pnpm format:check`, `pnpm lint`, `pnpm typecheck` |
| `Unit tests` | `pnpm test:coverage`; coverage table in the run summary, HTML report in the `coverage` artifact |
| `Database tests` | A disposable local Supabase stack on the runner, then `pnpm test:db` |
| `E2E tests` | Playwright's Chromium and the local stack, then `pnpm test:e2e`; report and traces uploaded when a test fails. Then `scripts/check-pdf-bundle.mjs` renders a PDF from only the files the PDF route's serverless bundle ships, with the packaged Chromium, as Vercel runs it |
| `CI passed` | Succeeds only when all four succeed: the one check to require in GitHub and Vercel |

**Coverage** covers `src/` except route shells (pages, layouts, loading and error boundaries, rendered by the end-to-end tests), the generated shadcn/ui primitives and generated types. The thresholds in `vitest.config.mts` sit just under the measured coverage: 80% of statements overall, and 95–100% for Server Actions and queries, the PDF route and the auth layer. Raise them as tests are added; never lower them to make a change pass.

**Deployment** stays with Vercel's Git integration: pushes to `main` deploy to production and pull requests get preview deployments. To release only commits that passed CI (one-time setup):

1. Vercel → Project → Settings → Build and Deployment → **Deployment Checks** → Add Checks → GitHub → select **CI passed**. Production builds still start on every push, but replace the live site only once CI passed on that commit. *Force Promote* on a deployment overrides it in an emergency.
2. GitHub → Settings → Rules → Rulesets: target `main`, require a pull request and the **CI passed** status check.

**Database migrations** are never applied automatically. Run **Database migrations** from the Actions tab: by default it only lists the pending migrations; tick *Apply* to apply them (from `main` only). One-time setup in GitHub → Settings → Environments → `production`: secrets `SUPABASE_ACCESS_TOKEN` (a Supabase access token) and `SUPABASE_DB_PASSWORD`, variable `SUPABASE_PROJECT_REF`, and, recommended, yourself as a required reviewer so each run waits for your approval. Ship a schema change in two steps: first a migration the running app tolerates (applied with the workflow), then the code that uses it.

Dependabot keeps the workflow actions, pinned to commit SHAs, up to date (one grouped pull request a month).

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
  features/job-posts/      # job posts, requirement editor, deterministic matching and scores
  features/ai-settings/    # AI switch, daily limit, usage and cost (Settings)
  lib/ai/                  # server-only Groq and Gemini clients, fallback chain, fakes, retries, quota and request log
  components/forms/        # LocalizedField, PeriodField, SortableList, save bar, unsaved-changes guard
  lib/auth/                # route policy, session + allowlist data-access layer
  lib/{i18n,supabase,env,data}/
messages/{en,fr}.json      # every UI string, both languages
supabase/
  config.toml              # local stack: sign-ups disabled, strong passwords
  migrations/              # reviewed schema, RLS, storage (applied by db:start / db push)
tests/{unit,db,e2e}/
scripts/                   # db:seed (local owner + demo career), clean, coverage summary, PDF bundle check
.github/                   # CI, manual database migrations, shared setup action, Dependabot
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
- **Templates** (`src/features/cv-templates`) are page designs (see below). They are copy-on-apply: a CV started from one gets its own copy of the design, a fresh definition with all current career data, and only the template's id and name as provenance (no foreign key), so editing or deleting a template never changes existing CVs.

### Template designs (`canvas-v1`)

The **Templates** page lists the owner's designs next to the included Classic design. *Create a template* opens the designer on a blank A4 page; the page previews the owner's current career data in the template's language.

- **Model** (`src/features/cv-design/design.ts`): a Zod-validated, versioned `design` (`schemaVersion` 1) of up to 3 pages and 80 elements, positioned in millimetres. Elements are the name, title, contacts and links, each built-in or custom career section, the photo (each at most once), and free text (English/French), lines and shapes (as many as needed). Each has a box (`x`, `y`, `w`, `h`, optionally growing to fit its text) and a style (Poppins, Inter or Lora at 8–48 pt, weight, alignment, line height, capitals, colours, background, border, radius, inner margin). The database checks the renderer key, the version and a 256 KiB size cap.
- **Designer** (`src/features/cv-design/components`, `src/features/cv-templates/components/template-designer.tsx`): click an element to add it; drag to move it, drag a handle to resize it, with edges snapping to the page, its 15 mm margin, its centre and the other elements (Alt drags freely). Arrow keys move the selected element (Shift for 5 mm), Ctrl/Command with the arrows resizes it, Delete removes it, Ctrl/Command+D duplicates it. The properties panel edits position, size and style; the page panel sets the background, the number of pages and the reading order. Changes autosave with the template `revision` (conflicts reported as in the CV editor), with undo/redo. The designer is laid out for desktop and tablet screens; on a phone its panels stack under the page.
- **Rendering** (`src/features/cv-renderer/canvas-v1`): only element boxes are positioned; the text inside them stays in normal flow. Decorations (photo, lines, shapes) are written first and drawn under the text; text elements follow in the design's **reading order**, which is the order applicant tracking systems and copy-paste read in the PDF. The designer lists that order and can sort it from top to bottom.
- **Layout checks** (`src/features/cv-design/layout.ts`): the browser measures each box after layout. Text cut off by a fixed box, text running past the bottom of its page, and text boxes overlapping each other are listed in the designer and in the CV editor, and block print and PDF export until fixed: the print page measures again, and the PDF route answers `409 layout_issues` instead of printing a broken page. A design never shrinks text to make it fit.
- **Retired setups:** templates saved from a CV's section setup before designs existed keep their rows (renderer `classic-reference-v1`, no design) but are never listed, opened or offered for a new CV.

Apply `supabase/migrations/20261023160000_canvas_designs.sql` before deploying this.

### Job posts and the ATS match score (AI phase, step 1)

The **Jobs** section stores job posts and scores every CV against their requirements. AI only helps read a post; the score itself never calls AI.

- **Adding a job post:** paste the ad, then either *Analyze with AI* or *Enter requirements myself*. The AI provider (Groq, or Gemini when Groq is unavailable) receives **only the pasted text** (never a CV or career data) and returns a draft: title, company, language, and requirements (skill, tool, language, education, certification, domain, soft skill or other; *required* or *nice to have*; other names such as "React.js" or the English/French equivalent; an optional note such as "3+ years"). The draft lands in the editor as unsaved changes: the owner corrects it and saves. *Analyze again* on a saved post works the same way, after a confirmation.
- **Without AI** (switched off, quota used, or no key on the server) the owner types the requirements; scoring works the same.
- **Scores** appear on the job page, best CV first, labelled as an *estimated keyword coverage*, not a real employer's ATS result. Each CV expands into: requirements found (each with the matched words, their context and where they are in the CV), requirements that exist in the career data but are not shown in this CV, and requirements found nowhere. The job-title check is reported apart.

**Scoring formula** (`src/features/job-posts/matching.ts`):

```text
score = round(100 × Σ weight(found requirements) / Σ weight(all requirements))
weight = 2 for a required item, 1 for a nice-to-have
```

- Only text the CV shows counts, as printed: hidden sections, entries and bullets are excluded and per-CV wording replaces the career-data text. Contacts, links, dates and built-in headings are not scored.
- Each requirement counts once, however often its name appears. Two requirements cannot share a name (the editor refuses it).
- Names match as whole terms, ignoring accents and capitals, with these rules: `C++`, `C#`, `.NET`, `Node.js`, `ASP.NET`, `Objective-C` and `R&D` stay whole ("Java" is not found in "JavaScript", "C" not in "C++", "SQL" not in "NoSQL"); "React" is not found in "React Native"; "React.js"/"ReactJS" count as "React", "ASP.NET" as ".NET", "HTML5" as "HTML", "APIs" as "API"; hyphens and spacing do not matter ("front-end" = "front end" = "frontend"); a few French and English function words are skipped inside phrases ("gestion de projet" matches "gestion des projets"); one- or two-letter names ("Go", "R", "AI") only match when written with a capital.
- A requirement missing from the CV but present elsewhere in the career data (any language, archived records excluded) is reported as hidden and earns nothing.
- The job title (and its other names) is looked for in the CV title and the experience roles; it is not part of the score.

**AI providers and fallback** (`src/lib/ai`, CLAUDE.md §16): server-only modules behind one provider interface, chained by `src/lib/ai/run.ts`.

- **Groq first** (`groq-sdk` 1.6.0, model from `GROQ_MODEL`, default `openai/gpt-oss-20b`): chat completions with strict JSON-schema structured outputs, low reasoning effort and no reasoning text in the answer, SDK retries and SDK logging off (`GROQ_LOG=debug` would log job posts), and the base URL pinned to `api.groq.com`. Output is capped at 3,072 tokens: the free plan allows 8,000 tokens per minute and seems to count the prompt plus that cap. In live checks (2026-10-23), a post at the 15,000-character maximum took about 3,900 prompt tokens and analyses used under 600 tokens of output, so posts fit with room to spare; one that does not is refused (413) and goes to Gemini, or, without a fallback, the owner is asked to shorten it.
- **Gemini as the fallback** (`@google/genai` 2.30.0, Interactions API, model `gemini-3.8-flash`, `store: false`), unchanged. `AI_PRIMARY_PROVIDER=gemini` swaps the order.
- **Fallback** happens only when the provider itself is unavailable: a timeout, a rate limit (HTTP 429), a post too large for Groq's plan (413), a server error (5xx, 498) or no connection. A refused key (401/403), a refused request (400/404/422), an unusable answer and our own validation or quota refusals are reported, never handed to the other provider.
- **Time and retries:** 30 seconds for the whole request. While Gemini waits behind it, Groq gets at most 12 seconds; the fallback gets the rest, and is not started with less than 8 seconds left. Each provider retries rate-limit, server and network errors at most twice, after the provider's `Retry-After` or an exponential backoff; timeouts are never retried.
- **Answers** from either provider are validated with the same Zod schema and normalized by the same code into the same draft. The job post is wrapped in tags it cannot close, and the instructions treat it as data. AI is off until the owner turns it on in **Settings**, where the daily limit is set (10 by default, 1–50). `begin_ai_request()` enforces the switch, one request at a time and the daily quota (every request started since midnight UTC, failed ones included) in Postgres under a per-owner advisory lock, so parallel server instances cannot exceed it. An analysis is one request however many providers it tries: one row in `ai_requests` and one unit of the daily quota. `ai_request_attempts` records each provider tried (provider, model, outcome, HTTP status, retries, token counts, estimated cost, duration), and `ai_requests` names the provider and model that answered. Both hold metadata only, never the post or the answer. Settings shows the primary and fallback providers and why one is not set up, the model of the last analysis, today's usage, the month's estimated cost (at list prices; Groq's free plan bills nothing) and the latest requests with the providers they tried. Failures are logged as one JSON line with codes and counts only.

**Setup:** keys, the Settings switch and the privacy options are in [Getting started → AI features with Groq](#5-ai-features-with-groq-optional). A deployment that predates this step applies `supabase/migrations/20261023100000_ai_job_posts.sql`, then `supabase/migrations/20261023130000_ai_provider_attempts.sql`, before the code.

### CVs tailored to a job post (AI phase, step 2)

**New CV** offers two contents: *All my career data* (as before) or *Tailored to a job post*. The job post is pasted there (the AI reads it first, exactly as in Job match) or chosen among the saved posts that have requirements; a job page's *Create a CV for this job* opens this mode with its post selected. Code: `src/features/cv-tailoring`.

- **What the AI decides** (owner's scope, 2026-10-26): the **2 projects** that together best fit the job (two, because a template is laid out for a couple of projects), which **technical skills** show (those the job names and those a recruiter expects next to them; the rest are hidden, never deleted), and a **suggested CV title** made from the job title (in the CV's language, written like the profile title, so "Développeuse" stays feminine, without levels such as "Senior" or markers such as "(H/F)"). Everything else comes from career data unchanged: header, summary, experience, education, certifications, soft skills and languages. Each chosen project keeps its whole technology list, the job's technologies first.
- **Checks on every answer** (`picksFromAnswer`): only the handles offered (`P1`, `S1`…) count; exactly two projects when the career data has them (a short answer is completed with the best keyword matches); a skill named by the requirements or the job title is always shown; skills beyond the request's size budget keep showing; the skills section is never emptied; reasons are plain text, with any project id replaced by its title. `createCv` checks every id again against the owner's active records.
- **Review before anything is saved:** the estimated keyword coverage of the result (the step 1 formula), the title (the suggestion, editable, or the profile title), the projects with the AI's one-line reasons, the skills shown and hidden, and the job's requirements found, present elsewhere in the career data, or missing (never added). *Create and open* accepts it: a pasted post is then saved to Job match (as a reviewed analysis) and the CV links to its post (`cv_documents.job_post_id`); the editor's *More actions* menu opens the post. The AI writes no other CV text, so nothing else needs accepting and export is not blocked by it.
- **Without AI** (off, out of requests or unavailable): *Choose by keywords* makes the same kind of choice with the step 1 matcher, for a saved post or a pasted one already read: the best keyword matches, and the skill groups that hold a skill the job names; the post's own title is suggested when it is written in the CV's language.
- **What is sent** (feature `cv_tailoring`, one request, counted like an analysis; a pasted post costs two: reading, then choosing): the job's title, other names and requirement names (not the post itself), the profile title, and for each project its title, technologies, the start of its description and of its first two bullets, and the requirements its text names; skill and group names. Never the name, contacts, photo, links, employers, dates or education. The request is capped at 30 projects (the best keyword matches first) within about 9,000 characters, and 120 skills; the answer at 2,048 tokens. A live check (2026-10-26, made-up data: 30 projects, 47 skills, `openai/gpt-oss-20b`) used 3,567 tokens, under Groq's free 8,000 per minute, and answered in about 2.5 seconds with the analysis.

**Setup:** apply `supabase/migrations/20261026100000_cv_tailoring.sql` (the job post link and the `cv_tailoring` feature in `ai_requests`) before deploying this.

### Security model (Phase 2)

- **Allowlist:** `app_owners` lists who may use the workspace. It is read-only for signed-in users; only an administrator can add rows.
- **RLS on every table:** one policy per command, requiring `owner_id = auth.uid()` *and* allowlist membership (a `security definer` helper in the non-exposed `private` schema, evaluated once per statement). Anonymous access is revoked at the grant level.
- **Integrity:** child rows reference `(owner_id, parent_id)`, so nothing can be attached to another owner's record. Localized text, periods and URLs are validated by database checks as well as Zod.
- **Storage:** private `cvstudio-assets` bucket, images only, 5 MiB, owner-prefixed paths; no public URLs.
- **Server-side checks:** the proxy redirect is a convenience; every page and data function verifies the JWT (`getClaims`) and the allowlist again. Post-login redirects only accept same-origin dashboard paths.
- **Concurrency:** CV documents and templates carry a `revision` that increments on every write, so stale editors cannot silently overwrite newer changes.
- **HTTP headers** (`src/config/security-headers.ts`): a baseline Content-Security-Policy limits scripts, styles, fonts, connections, frames, plugins and form targets to the site itself; images may also come from the Supabase project (signed portrait URLs). Inline scripts stay allowed because Next.js bootstraps pages with them; a nonce-based policy would block those too, but every page would then render on each request. Also sent: `X-Frame-Options: DENY`, `nosniff`, a strict referrer policy, a restrictive `Permissions-Policy`, `noindex`, and HSTS in production. The end-to-end suite fails on any policy violation.
- **Dependency advisories:** CI fails on high or critical advisories in production dependencies (`pnpm audit --prod`). `pnpm audit` also lists `braces` (GHSA-vfj7-8cjw-p6xm, no fixed version yet): it is only used by ESLint's config, on the project's own file patterns, so it is not exploitable here.

### Production checklist

Settings that live outside the repository; check them once per environment.

- **Supabase → Authentication:** sign-ups off; minimum password length 12 with lower/upper case and digits (mirrors `supabase/config.toml`); only the owner in `app_owners`.
- **Supabase → Storage:** the `cvstudio-assets` bucket stays private (the migration creates it that way).
- **Vercel:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `APP_TIME_ZONE` set for Production; with AI, `AI_PRIMARY_PROVIDER` and `GROQ_API_KEY` (and `GEMINI_API_KEY` for the fallback) as Sensitive variables, and `AI_FAKE_PROVIDER` and `GOOGLE_GENAI_DEBUG` unset. Functions run in Dublin (`dub1`, `vercel.json`) next to the Supabase project (Ireland/London); keep the two in the same area, since every page reads the database several times.
- **Cloudflare (if it proxies the domain):** PDF export makes Vercel's servers open the CV's print page (`/{locale}/print/{id}`) through the public domain, so firewall rules must not challenge those requests.
- **PDF export logs** (Vercel → Logs): a success logs `PDF export` with its duration and size. A failure logs `PDF export failed` with one JSON object: the `stage` that failed (`load-engine`, `launch`, `open-page`, `navigate`, `ready` or `print`), the `reason`, the original `error` with its stack, the `origin` the print page was loaded from and how many session cookies were passed. Messages are redacted: no cookie values, tokens, signed-URL queries, record ids or CV content.

### Version pins worth knowing

- **TypeScript 6.0**: TypeScript 7 is not supported yet by `typescript-eslint`.
- **ESLint 9**: `eslint-config-next` bundles plugins that do not support ESLint 10 yet.
- **Next.js 16.4** runs with `cacheComponents` and `partialPrefetching` enabled, so pages prerender as static shells per locale.

### Remaining setup steps (later phases)

CI/CD: the Vercel Deployment Check, the `main` ruleset and the `production` environment (see *Continuous integration and deployment*).

Useful official resources: [Next.js docs](https://nextjs.org/docs), [Supabase docs](https://supabase.com/docs), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [shadcn/ui](https://ui.shadcn.com/), [Tailwind CSS](https://tailwindcss.com/docs).

## Definition of done — MVP acceptance criteria

- [ ] Only the provisioned owner can access the dashboard, career data, CVs, templates, and export routes.
- [ ] The owner can CRUD structured entries (and relevant nested items) through intuitive forms.
- [ ] Each built-in section can be included/hidden/reordered; custom sections/subsections are editable.
- [ ] Individual CV records, bullets, skills, and supported fields can be shown/hidden or reordered.
- [ ] UI is translated to English and French; CV text can be maintained separately in each language.
- [ ] Missing translations are clearly identified; nothing is auto-translated silently.
- [ ] The reference-based `classic-reference-v1` follows the supplied A4 CV layout.
- [ ] Photo, contacts, section order, optional groups, and selected entries are reflected in preview and output.
- [ ] Owner can save/edit/duplicate/delete CVs and saved presets independently without unintended data loss.
- [ ] Print works; Download produces an actual selectable-text PDF with no clipped, overlapping, or lost content.
- [ ] Single-page and multi-page CVs have sensible layout; English/French export tested.
- [ ] Forms have validation and graceful loading, empty, success, and failure states; unsaved work is protected.
- [ ] Desktop and mobile flows are usable; keyboard/touch interactions and basic accessibility are verified.
- [ ] RLS/IDOR checks and core builder/export tests pass.
- [ ] AI is limited to the approved AI phase: opt-in, server-only key, and every suggestion reviewed before it is saved.

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
| **AI phase (approved 2026-10-22)** | Opt-in, owner-reviewed AI features (Groq, with Gemini as fallback): job-post ATS match score (keyword-based), then job-tailored CVs from career data, then translation suggestions |

## Contributing / working with Claude

Coding-agent rules, architecture boundaries, security practices, UI conventions, localization expectations, and quality gates are in [`CLAUDE.md`](./CLAUDE.md). Always review that file before implementing features. Prioritize a small, complete, tested slice over broad scaffolding and empty placeholder pages.

---

**CVStudio v1 goal:** A private, bilingual, highly flexible CV workspace that turns structured career data into professional, editable, reusable, print-ready CVs — **without AI**.
