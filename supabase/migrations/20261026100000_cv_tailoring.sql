-- CVs tailored to a job post (AI phase, step 2; CLAUDE.md §16), approved by
-- the owner on 2026-10-26.
--
-- A CV remembers the job post it was made for. The composite key makes it one
-- of the CV owner's own posts. Job posts are soft-deleted, so the link usually
-- outlives them (the app hides a deleted post); a post deleted for good only
-- clears the link, never the CV.
--
-- Additive only: existing CVs have no job post, and the running app keeps
-- working before and after this migration.

alter table public.cv_documents
  add column job_post_id uuid,
  add constraint cv_documents_job_post_fk
    foreign key (owner_id, job_post_id) references public.job_posts (owner_id, id)
    on delete set null (job_post_id);

create index cv_documents_owner_job_post_idx
  on public.cv_documents (owner_id, job_post_id)
  where job_post_id is not null;

-- The request log names the new feature: choosing what a CV shows for a job.
alter table public.ai_requests
  drop constraint ai_requests_feature_check,
  add constraint ai_requests_feature_check
    check (feature in ('job_post_analysis', 'cv_tailoring'));
