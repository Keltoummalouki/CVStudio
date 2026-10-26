"use server";

import { createDefaultDefinition } from "@/features/cv-builder/defaults";
import type { MasterData } from "@/features/cv-builder/master-data";
import { loadMasterData } from "@/features/cv-builder/server/load-master-data";
import { getCvLabels } from "@/features/cv-documents/server/labels";
import { careerTexts } from "@/features/job-posts/cv-texts";
import { compileRequirements, indexTexts } from "@/features/job-posts/matching";
import { storedRequirementsSchema, toJobPostLanguage } from "@/features/job-posts/schemas";
import type { AiActionResult } from "@/lib/ai/errors";
import { runAiRequest } from "@/lib/ai/run";
import { fail, issuesFromZod, ok, type ActionResult } from "@/lib/actions/result";
import { getOwnerContext, type OwnerContext } from "@/lib/auth/session";
import { displayLocalizedText } from "@/lib/i18n/localized-text";
import { buildCatalog } from "../catalog";
import { fakeTailoringAnswer } from "../fake-tailoring";
import { buildReview, type TailoringProposal } from "../review";
import { tailorCvSchema, type TailorCvValues } from "../schemas";
import { tailorDefinition } from "../tailor-definition";
import {
  jobTitles,
  keywordPicks,
  picksFromAnswer,
  promptCatalog,
  tailoringAnswerSchema,
  tailoringInput,
  tailoringInstructions,
  tailoringJsonSchema,
  TAILORING_MAX_OUTPUT_TOKENS,
  type TailoringJob,
  type TailoringMode,
  type TailoringPicks,
} from "../tailoring";

/** The owner's saved post, or the draft the page analyzed: either way, its requirements. */
async function readJob(
  { supabase, owner }: OwnerContext,
  source: TailorCvValues["job"],
): Promise<ActionResult<TailoringJob>> {
  if (source.kind === "draft") return ok(source.draft);
  const { data, error } = await supabase
    .from("job_posts")
    .select("title, language, requirements")
    .eq("owner_id", owner.id)
    .eq("id", source.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return fail("unavailable");
  if (!data) return fail("not_found");
  const requirements = storedRequirementsSchema.safeParse(data.requirements);
  if (!requirements.success) return fail("unavailable");
  return ok({
    title: data.title,
    language: toJobPostLanguage(data.language),
    requirements: requirements.data,
  });
}

/**
 * Proposes what a CV tailored to a job post shows: two projects, the skills
 * the job calls for and a title, chosen by the AI providers (Groq, then
 * Gemini if Groq is unavailable) or, in "keywords" mode, by keyword matching
 * alone. The AI receives the job's title and requirements and the owner's
 * projects and skills; never their name, contacts, photo, links or dates.
 * Nothing is saved: the owner reviews the proposal, then createCv applies it.
 */
export async function tailorCv(input: unknown): Promise<AiActionResult<TailoringProposal>> {
  const context = await getOwnerContext();
  if (!context) return fail("unauthorized");
  const parsed = tailorCvSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_input", issuesFromZod(parsed.error));
  const { cvLocale, uiLocale, mode } = parsed.data;

  const job = await readJob(context, parsed.data.job);
  if (!job.ok) return job;
  if (job.data.requirements.items.length === 0) {
    return fail("invalid_input", [{ path: "job", message: "noRequirements" }]);
  }

  let master: MasterData;
  try {
    master = await loadMasterData(context);
  } catch {
    return fail("unavailable");
  }
  const compiled = compileRequirements(job.data.title, job.data.requirements);
  const titles = jobTitles(job.data);
  const catalog = buildCatalog(master, compiled, cvLocale, titles);
  const sent = promptCatalog(catalog);

  let picks: TailoringPicks;
  let used: TailoringMode = mode;
  if (mode === "keywords" || (sent.projects.length === 0 && sent.skills.length === 0)) {
    // Nothing to choose from is no reason to spend a request.
    used = "keywords";
    picks = keywordPicks(catalog, job.data, cvLocale);
  } else {
    const result = await runAiRequest({
      context,
      feature: "cv_tailoring",
      instructions: tailoringInstructions({ cvLocale, uiLocale }),
      input: tailoringInput(
        job.data,
        displayLocalizedText(master.profile.title, cvLocale)?.text ?? "",
        sent,
      ),
      jsonSchema: tailoringJsonSchema(sent, { cvLocale, uiLocale }),
      schema: tailoringAnswerSchema,
      maxOutputTokens: TAILORING_MAX_OUTPUT_TOKENS,
      fakeAnswer: fakeTailoringAnswer,
    });
    if (!result.ok) {
      return result.provider
        ? { ok: false, error: result.error, provider: result.provider }
        : { ok: false, error: result.error };
    }
    picks = picksFromAnswer(result.data, catalog, sent);
  }

  const definition = tailorDefinition(createDefaultDefinition(master), master, picks, {
    compiled,
    locale: cvLocale,
    titles,
  });
  const labels = await getCvLabels();
  const { reasons: _reasons, ...choice } = picks;
  return ok({
    mode: used,
    picks: choice,
    review: buildReview({
      definition,
      master,
      catalog,
      sent,
      picks,
      compiled,
      career: indexTexts(careerTexts(master, cvLocale)),
      locale: cvLocale,
      labels: labels[cvLocale],
    }),
  });
}
