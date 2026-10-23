"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlertIcon, RotateCwIcon, ScanTextIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { FormActionBar } from "@/components/forms/form-action-bar";
import { TermsInput } from "@/components/forms/terms-input";
import { TextField } from "@/components/forms/text-field";
import { TextareaField } from "@/components/forms/textarea-field";
import { useSaveForm } from "@/components/forms/use-save-form";
import { useUnsavedChangesGuard } from "@/components/forms/use-unsaved-changes";
import { useValidationMessage } from "@/components/forms/use-validation-message";
import { Panel, PanelHeader } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import type { AiAccess } from "@/features/ai-settings/access";
import { useAiErrorMessage } from "@/features/ai-settings/components/use-ai-error-message";
import type { AiFailureInfo } from "@/lib/ai/errors";
import { useRouter } from "@/lib/i18n/navigation";
import { termKey } from "../matching";
import { JOBS_HREF } from "../routes";
import { analyzeJobPost, saveJobPost } from "../server/actions";
import { JOB_POST_LANGUAGES, JOB_POST_LIMITS, jobPostSchema, type JobPostValues } from "../schemas";
import { RequirementsEditor } from "./requirements-editor";

type JobPostFormProps = {
  /** The server's values; they change after a save or a reload. */
  initialValues: JobPostValues;
  ai: AiAccess;
  /** A new post not saved yet: leaving warns even before any edit. */
  unsaved?: boolean;
  /** Shown above the fields, e.g. what an analysis found. */
  intro?: React.ReactNode;
  /** Rendered above the form, told whether edits are still unsaved: the CV scores. */
  aside?: (dirty: boolean) => React.ReactNode;
  /** When the saved requirements came from a reviewed analysis. */
  analyzedAt?: string | null;
};

/**
 * Editor of one job post with explicit Save. AI results only ever land in
 * this form as unsaved changes: the owner reviews them, then saves.
 */
export function JobPostForm({
  initialValues,
  ai,
  unsaved = false,
  intro,
  aside,
  analyzedAt = null,
}: JobPostFormProps) {
  const t = useTranslations("jobs.editor");
  const tLanguages = useTranslations("jobs.languages");
  const tStale = useTranslations("careerData.editor.stale");
  const format = useFormatter();
  const router = useRouter();
  const message = useValidationMessage();
  const aiMessage = useAiErrorMessage();
  const id = useId();
  const form = useForm<JobPostValues>({
    resolver: zodResolver(jobPostSchema),
    defaultValues: initialValues,
    mode: "onTouched",
  });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [aiError, setAiError] = useState<AiFailureInfo | null>(null);
  const [reanalyzed, setReanalyzed] = useState(false);
  const reloadRequested = useRef(false);
  const [isReloading, startReload] = useTransition();

  const guard = useUnsavedChangesGuard({
    when: form.formState.isDirty || unsaved,
    onDiscard: () => form.reset(),
  });
  const saver = useSaveForm({
    form,
    action: saveJobPost,
    onSaved: (saved, values) => {
      if (values.id === null) {
        toast.success(t("createdToast"));
        guard.allowNavigation();
        router.replace(`${JOBS_HREF}/${saved.id}`);
        return;
      }
      form.reset({ ...values, expectedUpdatedAt: saved.updatedAt, analyzed: false });
      setReanalyzed(false);
      toast.success(t("savedToast"));
    },
  });

  // After an explicit "reload latest", adopt the refreshed server values.
  useEffect(() => {
    if (!reloadRequested.current) return;
    reloadRequested.current = false;
    form.reset(initialValues);
    saver.clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to new server values
  }, [initialValues]);

  const [title, description] = useWatch({ control: form.control, name: ["title", "description"] });
  const canAnalyze =
    ai.state === "ready" && description.trim().length >= JOB_POST_LIMITS.minDescription;
  const { errors } = form.formState;
  // A draft that was never saved is not "All changes saved".
  const state = unsaved && saver.state === "idle" ? "unsaved" : saver.state;

  async function analyzeAgain() {
    setAiError(null);
    const result = await analyzeJobPost({ description: form.getValues("description") });
    if (!result.ok) {
      setAiError({ error: result.error, provider: result.provider });
      return;
    }
    const draft = result.data;
    const options = { shouldDirty: true } as const;
    // Field arrays update when set by their own name.
    form.setValue("requirements.items", draft.requirements.items, options);
    form.setValue("requirements.titleAliases", draft.requirements.titleAliases, options);
    form.setValue("analyzed", true, options);
    if (!form.getValues("title").trim()) form.setValue("title", draft.title, options);
    if (!form.getValues("company").trim()) form.setValue("company", draft.company, options);
    form.setValue("language", draft.language, options);
    setReanalyzed(true);
    // Updates the remaining daily count shown elsewhere.
    router.refresh();
  }

  return (
    <>
      {aside?.(form.formState.isDirty)}
      <form noValidate onSubmit={saver.save} className="flex flex-col gap-5 lg:gap-6">
        {saver.error === "stale" ? (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-lg border border-warning/40 bg-warning-soft p-5 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="space-y-1">
              <p className="text-sm font-semibold text-warning">{tStale("title")}</p>
              <p className="text-sm/relaxed text-foreground">{tStale("description")}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isReloading}
              onClick={() => {
                reloadRequested.current = true;
                startReload(() => router.refresh());
              }}
            >
              {isReloading ? <Spinner /> : <RotateCwIcon aria-hidden="true" />}
              {tStale("reload")}
            </Button>
          </div>
        ) : saver.error ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md bg-destructive-soft px-3 py-2.5 text-sm text-destructive"
          >
            <CircleAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {t(`errors.${saver.error}`)}
          </p>
        ) : null}

        {intro}

        <Panel aria-labelledby={`${id}-details`}>
          <PanelHeader
            titleId={`${id}-details`}
            title={t("details")}
            description={t("detailsHint")}
          />
          <div className="flex flex-col gap-5 px-5 py-6 sm:px-6">
            <div className="grid gap-5 md:grid-cols-2">
              <TextField
                label={t("jobTitle")}
                maxLength={JOB_POST_LIMITS.title}
                error={message(errors.title)}
                {...form.register("title")}
              />
              <TextField
                label={t("company")}
                optional
                autoComplete="organization"
                maxLength={JOB_POST_LIMITS.company}
                error={message(errors.company)}
                {...form.register("company")}
              />
            </div>
            <Controller
              control={form.control}
              name="language"
              render={({ field }) => (
                <div className="min-w-0 space-y-1.5 md:max-w-xs">
                  <label htmlFor={`${id}-language`} className="text-sm font-medium">
                    {t("language")}
                  </label>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id={`${id}-language`} className="w-full" onBlur={field.onBlur}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {JOB_POST_LANGUAGES.map((language) => (
                        <SelectItem key={language} value={language}>
                          {tLanguages(language)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            />
            <Controller
              control={form.control}
              name="requirements.titleAliases"
              render={({ field, fieldState }) => (
                <TermsInput
                  label={t("titleAliases")}
                  description={t("titleAliasesHint")}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  max={JOB_POST_LIMITS.titleAliases}
                  maxLength={JOB_POST_LIMITS.term}
                  identity={termKey}
                  taken={[title]}
                  error={message(fieldState.error)}
                />
              )}
            />
          </div>
        </Panel>

        <Panel aria-labelledby={`${id}-requirements`}>
          <PanelHeader
            titleId={`${id}-requirements`}
            title={t("requirements")}
            description={t("requirementsHint")}
            aside={
              canAnalyze ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmOpen(true)}
                >
                  <ScanTextIcon aria-hidden="true" />
                  {t("analyzeAgain")}
                </Button>
              ) : null
            }
          />
          <div className="flex flex-col gap-4 px-5 py-6 sm:px-6">
            {reanalyzed ? (
              <p
                role="status"
                className="rounded-md border border-info/30 bg-info-soft px-3 py-2.5 text-sm/relaxed"
              >
                {t("reanalyzed")}
                {ai.fake ? ` ${t("fakeProvider")}` : null}
              </p>
            ) : analyzedAt ? (
              <p className="text-xs text-muted-foreground">
                {t("analyzedOn", {
                  date: format.dateTime(new Date(analyzedAt), { dateStyle: "medium" }),
                })}
              </p>
            ) : null}
            {aiError ? (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-md bg-destructive-soft px-3 py-2.5 text-sm text-destructive"
              >
                <CircleAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                {aiMessage(aiError)}
              </p>
            ) : null}
            <RequirementsEditor control={form.control} />
          </div>
        </Panel>

        <Panel aria-labelledby={`${id}-text`}>
          <PanelHeader
            titleId={`${id}-text`}
            title={t("postText")}
            description={t("postTextHint")}
          />
          <div className="space-y-1.5 px-5 py-6 sm:px-6">
            <TextareaField
              label={t("postTextLabel")}
              optional
              rows={10}
              maxLength={JOB_POST_LIMITS.description}
              error={message(errors.description)}
              {...form.register("description")}
            />
            <p className="text-right text-xs text-muted-foreground" data-numeric>
              {t("counter", { count: description.length, max: JOB_POST_LIMITS.description })}
            </p>
          </div>
        </Panel>

        <FormActionBar
          state={state}
          isSaving={saver.isSaving}
          onRetry={() => void saver.save()}
          cancelHref={JOBS_HREF}
        />
      </form>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("reanalyzeTitle")}
        description={t("reanalyzeDescription")}
        confirmLabel={t("reanalyzeConfirm")}
        onConfirm={analyzeAgain}
      />
      {guard.dialog}
    </>
  );
}
