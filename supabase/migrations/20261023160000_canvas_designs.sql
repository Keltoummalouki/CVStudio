-- Free-form designs ("canvas-v1"), approved by the owner on 2026-10-23.
--
-- A template is a design: elements placed on A4 pages, stored as a validated,
-- versioned JSON document (src/features/cv-design/design.ts). A CV made from a
-- design keeps its own copy (copy-on-apply): editing or deleting the template
-- never changes it. The Classic renderer stays the default and has no design.
--
-- Additive only: existing rows stay Classic with design null, so the running
-- app keeps working before and after this migration.

alter table public.cv_templates
  add column design jsonb
    constraint cv_templates_design_check
      check (design is null or (jsonb_typeof(design) = 'object' and octet_length(design::text) <= 262144));

alter table public.cv_documents
  add column design jsonb
    constraint cv_documents_design_check
      check (design is null or (jsonb_typeof(design) = 'object' and octet_length(design::text) <= 262144));

alter table public.cv_templates
  drop constraint cv_templates_visual_template_key_check,
  add constraint cv_templates_visual_template_key_check
    check (visual_template_key in ('classic-reference-v1', 'canvas-v1')),
  -- A design exactly when the canvas renderer draws it, in a known version.
  add constraint cv_templates_design_renderer
    check ((visual_template_key = 'canvas-v1') = (design is not null)),
  add constraint cv_templates_design_version
    check (design is null or (design ->> 'schemaVersion') = '1');

alter table public.cv_documents
  drop constraint cv_documents_visual_template_key_check,
  add constraint cv_documents_visual_template_key_check
    check (visual_template_key in ('classic-reference-v1', 'canvas-v1')),
  add constraint cv_documents_design_renderer
    check ((visual_template_key = 'canvas-v1') = (design is not null)),
  add constraint cv_documents_design_version
    check (design is null or (design ->> 'schemaVersion') = '1');
