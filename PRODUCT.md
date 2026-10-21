# Product

<!-- impeccable:product-schema 1 -->

> Derived from `README.md`, `CLAUDE.md` and `docs/` (owner-authored specifications). Items marked
> **Open** are undecided and must not be assumed.

## Platform

web

## Users

A single owner/admin: a bilingual (French/English) full-stack web developer maintaining their own
career record. They apply to roles in both languages and tailor a CV per application. They edit on
a laptop/desktop for long sessions and on a phone for quick fixes (reordering, hiding an item,
checking a preview before sending). No other audience signs in; there is no public sign-up.

## Product Purpose

Replace hand-editing PDFs/word documents with structured career data entered once and composed
into many independent CVs. Success: producing a tailored, print-perfect French or English CV in
minutes, with total confidence that nothing was lost, mistranslated, or silently changed.

## Positioning

Master data and CV compositions are separate. Every CV is a reversible composition (select, order,
hide, override wording per CV) over canonical records, rendered by one renderer that is
pixel-faithful to the owner's existing CV design. Saved presets copy configurations; they never
couple documents.

## Operating Context

- Workflows: maintain career data → compose a CV (locale, preset, selection, overrides) → preview
  on a live A4 page → save → print / download PDF → save as reusable preset.
- Interface language and CV output language are chosen independently.
- The printed CV (`classic-reference-v1`) is a fixed A4, monochrome, Poppins document; the
  dashboard around it is a separate, contemporary UI.

## Capabilities and Constraints

- Next.js App Router + TypeScript strict, Supabase (Postgres, Auth, private Storage), Tailwind +
  shadcn/ui, next-intl (`/en`, `/fr`), React Hook Form + Zod.
- No AI features in the MVP: no generation, translation, scoring.
- Terminology that must never be conflated: master data, CV document, saved preset, visual
  template, section, subsection, item.
- Security: single allowlisted owner, RLS on every table, private storage, server-side checks.
- Deployment target: **Vercel** (confirmed 2026-10-20). The PDF engine must fit serverless limits.
- Missing translations **block export** (confirmed 2026-10-20): every visible localized string is
  required in the CV's language; the owner resolves each gap by translating, hiding the item, or
  writing a per-CV override. No silent fallback.
- Development database: a dedicated Supabase cloud project supplied by the owner. Migrations are
  applied to it only after explicit confirmation that it holds no production data.

## Brand Commitments

- Name: CVStudio. Tagline (README): "Your career information, organized once. Your CV, customized
  any time."
- The CV canvas reproduces the owner's reference PDFs (A4, Poppins, fine rules, two-column skills,
  right-aligned dates, optional circular portrait). The dashboard must not imitate the CV.
- Quality bar: "a carefully designed, production-quality product — not a generic CRUD admin
  panel."

## Evidence on Hand

- Reference CV PDFs in `docs/reference-cvs/` (private, gitignored; contain personal data, never
  copied into code or fixtures).
- `docs/WIREFRAME_NOTES.md` (functional screen notes). The HTML wireframe board referenced there
  was not provided.
- No logo, illustration or brand asset exists. Do not fabricate testimonials, metrics or usage data.

## Product Principles

1. Never lose work silently: every save state is visible, every destructive action is confirmed or
   undoable.
2. One truth per concept: canonical data, compositions and presets stay separate and explicit.
3. The document is the hero: the dashboard serves the CV, it does not compete with it.
4. Bilingual by construction: missing translations are surfaced, never papered over.
5. Phone and desktop are both first-class editing surfaces.

## Accessibility & Inclusion

Keyboard operation everywhere (including reordering without drag), visible focus, WCAG AA contrast,
screen-reader labels in both languages, reduced-motion support, generous touch targets.
