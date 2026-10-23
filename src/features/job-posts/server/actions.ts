"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { AiActionResult } from "@/lib/ai/errors";
import { runAiRequest } from "@/lib/ai/run";
import { fail, issuesFromZod, mapDatabaseError, ok, type ActionResult } from "@/lib/actions/result";
import { getOwnerContext } from "@/lib/auth/session";
import { asJsonObject } from "@/lib/supabase/json";
import {
  ANALYSIS_INSTRUCTIONS,
  ANALYSIS_JSON_SCHEMA,
  ANALYSIS_MAX_OUTPUT_TOKENS,
  analysisAnswerSchema,
  analysisInput,
  draftFromAnalysis,
} from "../analysis";
import { fakeJobPostAnalysis } from "../fake-analysis";
import { analyzeJobPostSchema, jobPostSchema, type JobPostDraft } from "../schemas";

const idSchema = z.uuid();

/**
 * Creates or updates a job post. Updates only apply to the version the editor
 * loaded, so a second tab can never be overwritten silently ("stale").
 */
export async function saveJobPost(
  input: unknown,
): Promise<ActionResult<{ id: string; updatedAt: string }>> {
  const context = await getOwnerContext();
  if (!context) return fail("unauthorized");
  const parsed = jobPostSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_input", issuesFromZod(parsed.error));
  const { id, expectedUpdatedAt, analyzed, requirements, ...fields } = parsed.data;
  const { supabase, owner } = context;

  const row = {
    ...fields,
    requirements: asJsonObject(requirements),
    ...(analyzed ? { analyzed_at: new Date().toISOString() } : {}),
  };

  if (id === null) {
    const { data, error } = await supabase
      .from("job_posts")
      .insert({ ...row, owner_id: owner.id })
      .select("id, updated_at")
      .single();
    if (error) return fail(mapDatabaseError(error));
    refresh();
    return ok({ id: data.id, updatedAt: data.updated_at });
  }

  if (!expectedUpdatedAt) return fail("invalid_input");
  const { data, error } = await supabase
    .from("job_posts")
    .update(row)
    .eq("owner_id", owner.id)
    .eq("id", id)
    .eq("updated_at", expectedUpdatedAt)
    .is("deleted_at", null)
    .select("id, updated_at")
    .maybeSingle();
  if (error) return fail(mapDatabaseError(error));
  if (!data) {
    const current = await supabase
      .from("job_posts")
      .select("id")
      .eq("owner_id", owner.id)
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (current.error) return fail("unavailable");
    return fail(current.data ? "stale" : "not_found");
  }
  refresh();
  return ok({ id: data.id, updatedAt: data.updated_at });
}

async function setDeleted(id: unknown, deleted: boolean): Promise<ActionResult> {
  const context = await getOwnerContext();
  if (!context) return fail("unauthorized");
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return fail("invalid_input");

  const query = context.supabase
    .from("job_posts")
    .update({ deleted_at: deleted ? new Date().toISOString() : null })
    .eq("owner_id", context.owner.id)
    .eq("id", parsedId.data);
  const { data, error } = await (
    deleted ? query.is("deleted_at", null) : query.not("deleted_at", "is", null)
  )
    .select("id")
    .maybeSingle();
  if (error) return fail(mapDatabaseError(error));
  if (!data) return fail("not_found");

  refresh();
  return ok(undefined);
}

/** Moves a job post out of the list. The row is kept so the owner can undo; CVs are untouched. */
export async function deleteJobPost(id: unknown): Promise<ActionResult> {
  return setDeleted(id, true);
}

export async function restoreJobPost(id: unknown): Promise<ActionResult> {
  return setDeleted(id, false);
}

/**
 * Asks the AI providers (Groq, then Gemini if Groq is unavailable) for the
 * requirements of a pasted job post. Only the post's text is sent. Nothing is
 * saved: the owner reviews and corrects the draft, then saves it with
 * saveJobPost.
 */
export async function analyzeJobPost(input: unknown): Promise<AiActionResult<JobPostDraft>> {
  const context = await getOwnerContext();
  if (!context) return fail("unauthorized");
  const parsed = analyzeJobPostSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_input", issuesFromZod(parsed.error));

  const result = await runAiRequest({
    context,
    feature: "job_post_analysis",
    instructions: ANALYSIS_INSTRUCTIONS,
    input: analysisInput(parsed.data.description),
    jsonSchema: ANALYSIS_JSON_SCHEMA,
    schema: analysisAnswerSchema,
    maxOutputTokens: ANALYSIS_MAX_OUTPUT_TOKENS,
    fakeAnswer: fakeJobPostAnalysis,
  });
  if (!result.ok) {
    return result.provider
      ? { ok: false, error: result.error, provider: result.provider }
      : { ok: false, error: result.error };
  }
  return ok(draftFromAnalysis(result.data, parsed.data.description));
}
