"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ChoiceCard } from "@/components/forms/choice-card";
import { TextField } from "@/components/forms/text-field";
import { TextareaField } from "@/components/forms/textarea-field";
import { useValidationMessage } from "@/components/forms/use-validation-message";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fieldControlClassName } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { ActionErrorCode } from "@/lib/actions/result";
import { useRouter } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";
import { templateHref } from "../routes";
import {
  TEMPLATE_DESCRIPTION_MAX,
  TEMPLATE_NAME_MAX,
  newTemplateDetailsSchema,
  type NewTemplateDetails,
  type SaveCvAsTemplateValues,
} from "../schemas";
import { getTemplateChoices, saveCvAsTemplate } from "../server/actions";
import type { TemplateChoice } from "../server/queries";

type SaveAsTemplateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cvId: string;
  cvName: string;
  /** Saves pending CV edits first, so the template copies what the owner sees. */
  saveCvFirst: () => Promise<boolean>;
};

function SaveAsTemplateForm({
  cvId,
  cvName,
  saveCvFirst,
  onDone,
}: Omit<SaveAsTemplateDialogProps, "open" | "onOpenChange"> & { onDone: () => void }) {
  const t = useTranslations("templates.saveDialog");
  const tLanguages = useTranslations("languages");
  const validationMessage = useValidationMessage();
  const router = useRouter();
  const selectId = useId();
  const [mode, setMode] = useState<"new" | "replace">("new");
  const [choices, setChoices] = useState<TemplateChoice[] | null>(null);
  const [templateId, setTemplateId] = useState("");
  const [error, setError] = useState<ActionErrorCode | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<NewTemplateDetails>({
    resolver: zodResolver(newTemplateDetailsSchema),
    defaultValues: { name: cvName, description: "" },
  });

  useEffect(() => {
    let active = true;
    void getTemplateChoices().then((result) => {
      if (!active) return;
      const loaded = result.ok ? result.data : [];
      setChoices(loaded);
      setTemplateId(loaded[0]?.id ?? "");
    });
    return () => {
      active = false;
    };
  }, []);

  const target = choices?.find((choice) => choice.id === templateId) ?? null;
  const canReplace = (choices?.length ?? 0) > 0;

  const submit = (values: SaveCvAsTemplateValues) => {
    setError(null);
    startTransition(async () => {
      if (!(await saveCvFirst())) return;
      try {
        const result = await saveCvAsTemplate(values);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        onDone();
        toast.success(
          values.mode === "new"
            ? t("created", { name: result.data.name })
            : t("replaced", { name: result.data.name }),
          {
            action: {
              label: t("openTemplate"),
              onClick: () => router.push(templateHref(result.data.id)),
            },
          },
        );
      } catch {
        setError("unavailable");
      }
    });
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (mode === "replace") {
      event.preventDefault();
      if (templateId) submit({ mode, cvId, templateId });
      return;
    }
    void form.handleSubmit((details) => submit({ mode, cvId, ...details }))(event);
  };

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle className="text-xl tracking-[-0.025em]">{t("title")}</DialogTitle>
        <DialogDescription className="leading-relaxed">{t("description")}</DialogDescription>
      </DialogHeader>

      {canReplace ? (
        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="sr-only">{t("modeLabel")}</legend>
          {(["new", "replace"] as const).map((option) => (
            <ChoiceCard
              key={option}
              compact
              name="template-mode"
              value={option}
              checked={mode === option}
              onChange={() => setMode(option)}
              selected={mode === option}
              title={t(`modes.${option}.title`)}
              description={t(`modes.${option}.description`)}
            />
          ))}
        </fieldset>
      ) : null}

      {mode === "new" ? (
        <div className="flex flex-col gap-4">
          <TextField
            label={t("name")}
            maxLength={TEMPLATE_NAME_MAX}
            autoComplete="off"
            error={validationMessage(form.formState.errors.name)}
            {...form.register("name")}
          />
          <TextareaField
            label={t("descriptionLabel")}
            description={t("descriptionHint")}
            optional
            rows={3}
            maxLength={TEMPLATE_DESCRIPTION_MAX}
            error={validationMessage(form.formState.errors.description)}
            {...form.register("description")}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <label htmlFor={selectId} className="text-sm font-medium">
              {t("replaceLabel")}
            </label>
            <select
              id={selectId}
              value={templateId}
              onChange={(event) => setTemplateId(event.target.value)}
              className={cn(fieldControlClassName, "h-10 px-3 pointer-coarse:h-11")}
            >
              {choices?.map((choice) => (
                <option key={choice.id} value={choice.id}>
                  {`${choice.name} (${tLanguages(choice.locale)})`}
                </option>
              ))}
            </select>
          </div>
          {target ? (
            <p className="flex gap-2.5 rounded-md border border-warning/30 bg-warning-soft px-3.5 py-3 text-[0.8125rem] leading-relaxed">
              <TriangleAlertIcon
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-warning"
              />
              <span>{t("replaceWarning", { name: target.name })}</span>
            </p>
          ) : null}
        </div>
      )}

      {error ? (
        <p
          role="alert"
          className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive"
        >
          {t(`errors.${error}`)}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={isPending}>
          {t("cancel")}
        </Button>
        <Button
          type="submit"
          variant={mode === "replace" ? "destructive" : "default"}
          disabled={isPending || (mode === "replace" && !target)}
        >
          {isPending ? <Spinner /> : null}
          {mode === "new" ? t("submitNew") : t("submitReplace")}
        </Button>
      </DialogFooter>
    </form>
  );
}

/**
 * "Save as template" from the CV builder: a new template, or an existing one
 * replaced after a plain warning. CVs never change either way.
 */
export function SaveAsTemplateDialog({ open, onOpenChange, ...props }: SaveAsTemplateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {/* Mounted per opening: fresh name, mode and template list every time. */}
        {open ? <SaveAsTemplateForm {...props} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
