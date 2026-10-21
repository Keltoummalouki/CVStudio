# CLAUDE.md — CVStudio

> Coding-agent operating instructions. Read this file and `README.md` before planning or changing code.
> Status: **Phases 1–4 implemented** (foundation, owner auth + RLS migrations, career-data CRUD, CV Builder with live A4 preview), plus saved templates (presets, copy-on-apply) and print/PDF download. PDF is verified locally only: the Vercel PDF path is untested. Hardening is next.

## 1. Product mission

**CVStudio** is a secure, owner-managed CV creation and management web application.

The owner maintains structured career data once in Supabase, then composes French or English CVs from that data. Each CV can choose its sections, subsections, records, ordering, presentation, and per-CV wording. The owner can preview, print, download PDF, and save/manage reusable CV templates.

**MVP = entirely manual and deterministic. NO AI.** Do not add LLM APIs, AI SDKs, auto-writing, auto-translation, scoring, or speculative AI abstractions. AI may be considered in a separately approved future phase.

## 2. Non-negotiable priorities (in order)

1. **Excellent UX and UI:** mobile-first admin experience; efficient flows; accessible controls; polished, coherent visuals; no confusing editor behavior.
2. **Fidelity to the supplied CV references:** the first print design (`classic-reference-v1`) should closely follow the user's existing French/English PDFs, not an invented layout.
3. **Content flexibility:** add/edit/delete/reorder/show/hide sections, subsections, entries, fields, and supported custom content blocks.
4. **Reliable printing and PDF output:** same CV content and styles for preview, print, and download; sensible page breaks.
5. **Security and privacy:** one authorized owner/admin; server-side authorization; owner-scoped RLS on all exposed tables and storage.
6. **Maintainability:** typed domain models, DRY reusable components, feature-based organization, tests, small focused changes.
7. **Localization:** full English (`en`) and French (`fr`) support without hardcoded display strings.
8. **Performance:** responsive interactions, bounded queries, avoid large client bundles.

## 3. Reference CV files and design fidelity

Provided visual references (source files, not application fixtures), stored in `docs/reference-cvs/` and gitignored because they contain personal data:

- `Cv ENGLISH + RRENSH.pdf`: two pages with French (page 1) and English (page 2).
- `keltoum_malouki_Developpeuse_web_Full_stack.pdf`: French version.
- `keltoum_malouki_FULL_STACK_WEB_DEVELOPER.pdf`: English version.

What we observed:

- A4 portrait, approximately 595 × 842 PDF points.
- Poppins Regular and Poppins Bold typography.
- Bold professional title and name near the top, compact contact/social rows.
- Fine horizontal separator lines under the header and at section headings.
- Technical skills displayed as categorized content in two columns.
- Experience and project entries with role/name, right-aligned dates, description/bullets, and a technology/tools subsection.
- Education, certifications, soft skills, and languages.
- Some versions display a circular portrait; another English page does not. Make portrait visibility configurable.
- Content and values differ between PDF versions. **Never treat any particular PDF's values as the universal source of truth.** Admin-entered Supabase data is canonical; localizations and per-CV overrides determine output.

Do not embed the user's name, phone, email, picture, employer details, or full CV contents into source code or seed production data. Use empty states or generic development fixtures. Reproduce the *layout*, not hard-coded personal data.

Important: one-page output is preferred when content fits, **not** a forced limit. Prevent clipping, collisions, microscopic text, or split headings if CV content grows.

## 4. Scope: MVP versus later

### Build in MVP

- Owner-only authentication and protected admin routes.
- Dashboard overview and CRUD of canonical profile/career data.
- Structured built-in sections: personal/contact, technical skills (grouped), work experience, education, projects, certifications, soft skills, languages.
- Optional summary section and optional custom sections/subsections/blocks.
- Individual experience achievements/bullets, technology lists, and comparable nested items.
- English and French admin interface, form labels, validation, section labels, dates, and CV output.
- Manually editable localized content where text needs translation.
- CV Builder with section/subsection/item/field-level visibility and ordering.
- Per-CV inclusion of records and optional text overrides without modifying canonical records.
- Live, paper-shaped preview, desktop editing workspace, useful mobile editing experience.
- Save CV drafts/documents, duplicate them, edit or delete them.
- Save a **reusable CV template/preset** from a current CV; list, create, edit, duplicate, apply, and delete saved presets.
- Print CV and download a real PDF; A4; reliable pagination.
- Confirmation/undo patterns for destructive actions; loading, empty, saved, unsaved, error, and success states.
- Secure photo upload/optional visibility.
- Tests for business behavior, authorization, localization, template isolation, and PDF presentation.

### Explicitly out of MVP

- AI-assisted writing, rewriting, translation, summarization, ATS scoring, or job-post matching.
- Public sign-up or multi-tenant SaaS billing.
- Public CV-sharing URLs and uncontrolled public personal-data access.
- Dozens of visual themes. Ship **one reference-based design** first; saved presets are distinct from visual themes.
- PDF-to-data extraction/import from the supplied CVs.

If a request would expand scope, describe the trade-off and wait for owner approval.

## 5. Domain terminology — never conflate these

- **Master data:** owner-maintained career records (experience, skills, projects, etc.) stored in Supabase.
- **CV document:** a saved, editable CV composition with locale, chosen records, order, visibility, and overrides. Can be printed/exported.
- **Saved CV template / preset:** a reusable configuration created from a document. Applying a preset **copies** its configuration into a new CV, rather than mutating an existing document or linking edits destructively.
- **Visual template:** the actual document styling/layout renderer, initially `classic-reference-v1`.
- **Section:** top-level content area (e.g., Experience).
- **Subsection:** nested logical group (e.g., Frameworks & APIs under Technical Skills; Technologies under Experience).
- **Item:** an individual entry or bullet, selected and optionally hidden/reordered.

Deletion of a saved preset must not delete CV documents previously created from it. Deletion of a canonical record referenced by a CV must be handled predictably (e.g., soft-delete and warning, or a clearly specified snapshot policy). Avoid dangling references and silent data loss.

## 6. Agreed technical foundation

- Next.js App Router with **TypeScript strict mode**.
- React Server Components by default, Client Components only when interaction needs them.
- Tailwind CSS and shadcn/ui as UI foundations; extend a coherent design system.
- Supabase: PostgreSQL, Auth, Storage; use `@supabase/ssr` where appropriate.
- React Hook Form + Zod for validated forms.
- Locale routing and message dictionaries, e.g. `next-intl` with `/en/...` and `/fr/...`.
- A tested accessible drag-and-drop solution (candidate: `dnd-kit`), plus keyboard and touch-friendly move-up/down alternatives.
- Print-specific CSS for A4; one shared document representation feeding preview, print, and PDF export.
- A PDF engine is **not finalized**. Prototype and verify the deployed export path (server-side Chromium/Playwright is a candidate) before selecting it. Do not claim PDF download works until actually tested.
- Use a single lockfile/package manager (recommendation: pnpm), exact compatible dependency versions, and documented setup.

Before implementing Supabase/Next.js APIs, verify currently supported patterns against their official documentation.

## 7. Proposed repository boundaries (not scaffolding that already exists)

```text
src/
  app/
    [locale]/
      (auth)/login/
      (dashboard)/dashboard/
        profile/
        content/
          experiences/
          education/
          skills/
          projects/
          certifications/
          languages/
          custom-sections/
        cvs/
          new/
          [cvId]/
        templates/
          [templateId]/
      (print)/print/[cvId]/
    api/cvs/[cvId]/pdf/
  components/
    ui/                 # Reusable primitives, shadcn-based
    layout/             # Sidebar, topbar, page frames
    forms/              # Form fields, selectors, date/year inputs
    cv/                 # Preview, section tree, print-only presentation
  features/
    profile/
    career-data/
    cv-builder/
    cv-documents/
    cv-templates/
  lib/
    auth/
    supabase/
    i18n/
    validation/
    pdf/
  types/
messages/
  en.json
  fr.json
supabase/
  migrations/
tests/
```

Structure may evolve when implementation justifies it. Keep boundaries: database operations in server-side repositories/services; domain rules in features/lib; presentational components should not import privileged database clients.

## 8. Data-model direction (confirm before first migration)

Prefer canonical entity tables with `owner_id` and stable UUIDs:

- `profiles`
- `experiences` (with nested achievements/technologies)
- `educations`
- `skill_groups` and `skills`
- `projects` (with technology links or lists)
- `certifications`
- `languages`
- `soft_skills`
- `custom_sections` (with subsection/item structures)
- `cv_documents`
- `cv_templates`

CV compositions and presets may hold a **versioned, validated JSONB definition** for ordering, visibility, selections, and overrides. Define a strict Zod schema with stable node IDs, `schema_version`, and discriminated node types; do not persist arbitrary unvalidated JSON. Separate canonical relational data from composition state. Document deletion and migration semantics.

For localized content, consistently model English/French variants (e.g., typed `localized_content` JSONB with `{ en, fr }` keys). Keep language-independent facts (dates, URLs, sort positions) outside translations. Translation data is manual for MVP.

When CV data is edited, specify whether the document reads the latest master data or uses a frozen snapshot. **Default: live canonical data + explicit per-CV overrides**; exporting should resolve a consistent snapshot for that operation. Templates should be copy-on-apply.

Do not guess final SQL schema from this outline. Design indexes, constraints, foreign keys where possible, RLS, and migration path first.

## 9. Security and privacy rules

- Single-owner MVP: disable unrestricted public account registration. Only a provisioned owner can enter the dashboard.
- Enforce owner authorization on **every** database operation, Server Action, API route, export route, and private asset request. UI hiding is not authorization.
- Every exposed table with user data must have RLS enabled and owner-scoped SELECT/INSERT/UPDATE/DELETE policies. For UPDATE use both `USING` and `WITH CHECK`.
- Use `auth.uid()` (or equivalent trusted identity) in policies; **never** base access on client-submitted `owner_id`, role, or mutable `user_metadata`.
- Never expose Supabase `service_role`/secret keys or server-only environment variables through `NEXT_PUBLIC_*`, browser bundles, logs, or error responses.
- Scope Storage read/write policies to the owner; prefer private buckets for profile photos and generated files.
- Validate input on the server with Zod; sanitize/escape free text and safe links; avoid injecting user content as HTML.
- Guard export routes against IDOR by rechecking ownership, even after a valid session is established.
- Add limits for uploads, content length, and PDF generation to prevent abuse; avoid sensitive data in analytics and logs.
- Include authorization, wrong-owner, and failed-storage tests before declaring MVP complete.

## 10. UX/UI engineering rules

- Mobile first for the **dashboard**. On large screens, use a section/navigation panel + editor + live preview when space allows. On mobile, use an editor/preview toggle; never shrink A4 into an unusable editing control.
- Match the supplied CV only inside the document canvas. The dashboard itself should be contemporary, visually clear, and accessible.
- Define tokens for colors, surfaces, typography, spacing, borders, radii, shadows, focus, and feedback; don't sprinkle arbitrary values.
- **DRY:** use shared Button, Input, Textarea, Select, Combobox, Checkbox/Switch, Date/Month-Year Picker, Dialog, Confirmation Dialog, Tabs, Badge, File Upload, Form Field, Empty State, Error State, Skeleton, and Toast patterns. Extend shadcn/ui rather than cloning near-identical components.
- Loading states: use skeletons approximating the final layout for pages, cards, lists, editors, and preview. For quick actions, show local pending feedback rather than blocking the full screen.
- Error states: plain language, retry where safe, preserve user edits. Empty states: explain what is missing and provide one clear action.
- Indicate `Saving…`, `Saved`, `Unsaved changes`, or a recoverable save failure. Never show success before server confirmation.
- Favor explicit Save/Cancel on entity forms. If builder changes auto-save, debounce appropriately and make status visible. Do not mix save behaviors without clear cues.
- Support touch targets, visible focus, keyboard editing/reordering, screen-reader labels, semantic headings, meaningful contrast, reduced motion, and non-color-only feedback.
- Use confirmation for permanent deletion and expose undo/recovery when reasonable. Warn before discarding unsaved edits or overwriting a selected template.
- Section tree operations: add, rename when supported, reorder, duplicate when useful, hide/show, remove, and select records. Show an immediate preview reflecting the current **draft** state.
- Keep bundle size reasonable: lazy-load heavy drag/PDF tooling, fetch only required columns, avoid wasteful global state.

## 11. Localization rules

- MVP locales: `fr` and `en`. English and French are independent CV output options.
- Translate all dashboard UI, validation messages, navigation, buttons, empty/error/loading states, accessibility labels, document headings, and date labels.
- Use locale dictionaries, not hard-coded UI copy or duplicated full React pages.
- Content (job descriptions, education details, project descriptions, section titles) may differ by language and must be owner-editable separately.
- Show a clear **Missing translation** state when selected content lacks the requested locale. Never imply that switching the UI locale automatically translates stored descriptions.
- No automatic AI translation. Do not silently export mixed-language required content; warn and require an explicit fallback decision for optional content.
- Keep date-only/month-year values free from timezone conversion artifacts; format dates for the selected locale at render time.
- Switching document language should not delete language-specific content or alter another saved document.

## 12. CV renderer, printing, and PDF invariants

- Reference style: A4 portrait, Poppins, monochrome/clean dividers, condensed yet readable layout, two-column categorized skills, stable heading + date alignment.
- Photo may be shown/hidden in CV settings; no assumption that one language requires it.
- Show/hide individual contacts, links, dates, headings, bullets, technologies, full sections, subsections, and individual items where applicable.
- Maintain accurate ordering/visibility and manual overrides in **preview, printed output, and downloaded PDF**.
- Both Print and Download must use the same styled HTML/document source or an explicitly tested equivalent. Avoid maintaining three divergent renderers.
- Use `@page { size: A4; }`, print media styles, predictable margins, page-break protections for headings and compact entry blocks. Avoid blank pages, footer overlaps, clipped content, and fake one-page squeezing.
- Real PDF output must retain selectable/searchable text and preferably functional URLs; do not flatten the entire CV into an image.
- Keep CV text in normal flow: no `position`, `float`, `transform`, `opacity` or `z-index` on boxes holding text. Chromium writes PDF text in paint order, which is what copy-paste and ATS parsers read; positioned or floated text lands out of place (e.g. every bullet after the last section). `tests/e2e/cv-export.spec.ts` checks the reading order.
- Do not store exported PDFs publicly by default. Download on demand or use private short-lived signed access when necessary.
- Test French/English, short/long CVs, photo on/off, optional sections, and multi-page overflow using exported artifacts, not just browser preview.

## 13. Coding conventions

- TypeScript strict. No `any` to bypass errors; prefer discriminated unions, explicit domain types, exhaustive checks.
- Small, composable functions and reusable components. Use server-side services/actions for mutations. Keep data access out of view components.
- One domain truth: do not duplicate field mappings, CV section labels, ordering logic, or export layout in unrelated components.
- Store constants/config centrally; never magic-string locale/section types in components.
- Zod schemas at trust boundaries and for versioned composition payloads; consistent errors returned to the UI.
- Conventional, descriptive file/identifier names. Accessible, semantic markup; avoid unnecessary third-party dependencies.
- CSS for the CV is isolated from dashboard styles to protect print fidelity.
- Comment *why* an unusual decision exists, not what self-evident code does.
- No credentials, user personal data, or production exports in git; `.env.local` ignored; `.env.example` placeholders only.
- Do not refactor unrelated behavior while building a feature. Prefer small, testable PRs.

## 14. Testing, quality gates, and definition of done

Recommended testing layers: unit tests for schema/domain helpers; component tests (React Testing Library); integration tests for server/storage/RLS where feasible; Playwright end-to-end flows; PDF regression/snapshot comparison.

For any feature:

1. Describe expected behavior and edge cases before coding.
2. Implement end-to-end, including loading, empty, error, and authorization states.
3. Add/update unit/component/integration/e2e tests as appropriate.
4. Run format/lint/typecheck/tests/build scripts **that actually exist** in the repository. Do not invent passing results.
5. Manually check mobile/desktop, English/French, and keyboard interactions.
6. For renderer changes, inspect an actual A4 print/PDF against the reference files.
7. Report changes made, verification performed, known limitations, and potential migration effects.

Acceptance examples:

- Editing an experience in Supabase updates CVs that use its canonical version, except fields with deliberate per-CV overrides.
- Hiding one subsection never deletes its data and the output omits it consistently.
- Reordering on mobile is possible without drag-only interaction.
- Saving a preset and applying it to a new CV does not mutate the old CV.
- Deleting a preset does not damage existing CVs.
- Switching to French changes labels/dates and picks French content; missing localized text is surfaced.
- A PDF from Download matches Print and has searchable text.
- A non-owner cannot read/write/export the owner's CV by changing an ID.

## 15. How the coding agent should work

1. Read `README.md`, this file, and inspect the real repo before proposing architecture changes.
2. For major work, write a short plan with schema/UI/API/testing impact; identify assumptions. Get approval for irreversible or scope-expanding changes.
3. Build in vertical slices: auth → canonical data → CV composition → reusable presets → renderer/exports → hardening.
4. Preserve reference-template fidelity and existing functionality. Do not modify code outside the requested scope without explaining why.
5. Prefer existing components/helpers; search before creating duplicates.
6. Never claim features, integrations, schemas, routes, deployment, tests, or migrations exist unless verified in the repository.
7. If requirements conflict, **user's current explicit request wins**, then `README.md` product requirements, then this file's implementation guidance. Surface any consequential conflict.
8. Security and UI/UX are part of every task—not optional follow-up polish.

## 16. Future AI phase (planning note only)

AI could later assist with rewriting bullets, translation suggestions, job matching, or ATS-oriented feedback. It must remain strictly **opt-in**, allow owner review of each suggestion, never alter canonical data without approval, and respect CV privacy. **Do not implement any of this in the MVP.**
