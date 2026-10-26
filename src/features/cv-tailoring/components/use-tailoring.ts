"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useAiErrorMessage } from "@/features/ai-settings/components/use-ai-error-message";
import { NEW_JOB_POST, type JobPostDraft } from "@/features/job-posts/schemas";
import { analyzeJobPost, saveJobPost } from "@/features/job-posts/server/actions";
import type { JobPostChoice } from "@/features/job-posts/server/queries";
import type { ActionErrorCode } from "@/lib/actions/result";
import { isProviderErrorCode, type AiFailureInfo } from "@/lib/ai/errors";
import type { Locale } from "@/lib/i18n/config";
import type { TailoringProposal } from "../review";
import { tailorCv } from "../server/actions";
import type { TailoringMode } from "../tailoring";

/** The job a CV is tailored to: a saved post, or a pasted one the AI read and nobody saved yet. */
export type TailoredJob =
  { kind: "saved"; job: JobPostChoice } | { kind: "draft"; draft: JobPostDraft };

/** Where the job comes from: one of the above, or text pasted on the page. */
export type TailoringSourceInput = TailoredJob | { kind: "paste"; text: string };

export type TailoringStatus = "idle" | "analyzing" | "choosing" | "matching";

/** Why tailoring stopped: a failed request, or a job post without requirements. */
export type TailoringFailure = AiFailureInfo | { error: "noRequirements" | "noRequirementsFound" };

/** What a job post says about itself, to name the CV and pick its language. */
export type JobFacts = Pick<JobPostDraft, "title" | "company" | "language">;

const jobFacts = (job: TailoredJob): JobFacts => (job.kind === "saved" ? job.job : job.draft);

/** A request the server started and counted toward the daily limit, failed or not. */
const counted = (result: { ok: true } | { ok: false; error: string }) =>
  result.ok || isProviderErrorCode(result.error) || result.error === "ai_providers_unavailable";

/**
 * The steps of a tailored CV before it exists: read a pasted post (one AI
 * request, remembered so another try costs one request, not two), then
 * choose (tailorCv: one more request, or none by keywords). The owner
 * reviews the proposal; a pasted post is saved to Job match only when the CV
 * is created, and only once.
 */
export function useTailoring({ uiLocale }: { uiLocale: Locale }) {
  const [status, setStatus] = useState<TailoringStatus>("idle");
  const [result, setResult] = useState<{ job: TailoredJob; proposal: TailoringProposal } | null>(
    null,
  );
  const [error, setError] = useState<TailoringFailure | null>(null);
  // This page's own requests, so the count of those left stays right without a reload.
  const [spent, setSpent] = useState(0);
  const [outOfRequests, setOutOfRequests] = useState(false);
  // The last pasted post the AI read: the same text is never sent twice.
  const [analyzed, setAnalyzed] = useState<{ text: string; draft: JobPostDraft } | null>(null);
  const saved = useRef<{ draft: JobPostDraft; id: string } | null>(null);

  const note = (outcome: { ok: true } | { ok: false; error: string }) => {
    if (counted(outcome)) setSpent((count) => count + 1);
    if (!outcome.ok && outcome.error === "ai_limit_reached") setOutOfRequests(true);
  };

  async function readPost(text: string): Promise<JobPostDraft | null> {
    const description = text.trim();
    if (analyzed?.text === description) return analyzed.draft;
    setStatus("analyzing");
    const analysis = await analyzeJobPost({ description });
    note(analysis);
    if (!analysis.ok) {
      setError({ error: analysis.error, provider: analysis.provider });
      return null;
    }
    if (analysis.data.requirements.items.length === 0) {
      setError({ error: "noRequirementsFound" });
      return null;
    }
    // A post the AI could not name still needs a title to be saved.
    const firstLine = description.split("\n")[0]?.trim().slice(0, 160) ?? "";
    const draft = { ...analysis.data, title: analysis.data.title || firstLine };
    setAnalyzed({ text: description, draft });
    return draft;
  }

  /**
   * Makes a proposal and returns it, or null after a failure (see `error`).
   * `prepare` sees the job before the choice is made, to name the CV and set
   * its language, and returns the CV's language.
   */
  async function generate(
    mode: TailoringMode,
    source: TailoringSourceInput,
    prepare: (job: JobFacts) => Locale,
  ): Promise<TailoringProposal | null> {
    setError(null);
    try {
      let job: TailoredJob;
      if (source.kind === "paste") {
        const draft = await readPost(source.text);
        if (!draft) return null;
        job = { kind: "draft", draft };
      } else {
        job = source;
      }
      const cvLocale = prepare(jobFacts(job));

      setStatus(mode === "ai" ? "choosing" : "matching");
      const proposal = await tailorCv({
        job: job.kind === "saved" ? { kind: "saved", id: job.job.id } : job,
        cvLocale,
        uiLocale,
        mode,
      });
      // With nothing to choose from, the server picked by keywords and started no request.
      if (mode === "ai" && !(proposal.ok && proposal.data.mode === "keywords")) note(proposal);
      if (!proposal.ok) {
        const noRequirements = proposal.fieldIssues?.some(
          (issue) => issue.message === "noRequirements",
        );
        setError(
          noRequirements
            ? { error: "noRequirements" }
            : { error: proposal.error, provider: proposal.provider },
        );
        return null;
      }
      setResult({ job, proposal: proposal.data });
      return proposal.data;
    } catch {
      setError({ error: "unavailable" });
      return null;
    } finally {
      setStatus("idle");
    }
  }

  /** The proposal's job post as a saved one: a pasted post is saved once, however often this runs. */
  async function savedJobPostId(
    job: TailoredJob,
  ): Promise<{ ok: true; id: string } | { ok: false; error: ActionErrorCode }> {
    if (job.kind === "saved") return { ok: true, id: job.job.id };
    if (saved.current?.draft === job.draft) return { ok: true, id: saved.current.id };
    const result = await saveJobPost({ ...NEW_JOB_POST, ...job.draft, analyzed: true });
    if (!result.ok) return { ok: false, error: result.error };
    saved.current = { draft: job.draft, id: result.data.id };
    return { ok: true, id: result.data.id };
  }

  function startOver() {
    setResult(null);
    setError(null);
  }

  return {
    status,
    busy: status !== "idle",
    result,
    jobTitle: result ? jobFacts(result.job).title : null,
    error,
    spent,
    outOfRequests,
    /** This exact text was read already: choosing by keywords needs no request. */
    hasRead: (text: string) => analyzed?.text === text.trim(),
    generate,
    savedJobPostId,
    startOver,
  };
}

/** Plain-language reason a tailoring step failed, in the New CV page's terms. */
export function useTailoringErrorMessage() {
  const t = useTranslations("cvs.new.tailoring");
  const tProviders = useTranslations("ai.providers");
  const aiMessage = useAiErrorMessage();
  return (failure: TailoringFailure): string => {
    switch (failure.error) {
      case "noRequirementsFound":
        return t("noRequirementsFound");
      case "noRequirements":
      case "ai_not_configured":
      case "ai_disabled":
      case "ai_busy":
      case "ai_providers_unavailable":
      case "not_found":
      case "unavailable":
        return t(`errors.${failure.error}`);
      case "ai_too_large":
      case "ai_rejected":
        return failure.provider
          ? t(`errors.${failure.error}`, { provider: tProviders(failure.provider) })
          : aiMessage(failure);
      default:
        return aiMessage(failure);
    }
  };
}
