"use client";

import { useId } from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Controller, useFieldArray, useWatch, type Control } from "react-hook-form";
import { TermsInput } from "@/components/forms/terms-input";
import { useValidationMessage } from "@/components/forms/use-validation-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { termKey } from "../matching";
import {
  JOB_POST_LIMITS,
  REQUIREMENT_KINDS,
  type JobPostValues,
  type Requirement,
} from "../schemas";
import { ImportanceToggle } from "./importance-toggle";

export function newRequirement(): Requirement {
  return {
    id: crypto.randomUUID(),
    label: "",
    kind: "skill",
    importance: "required",
    aliases: [],
    note: "",
  };
}

function RequirementRow({
  control,
  index,
  onRemove,
}: {
  control: Control<JobPostValues>;
  index: number;
  onRemove: () => void;
}) {
  const t = useTranslations("jobs.requirements");
  const message = useValidationMessage();
  const id = useId();
  const label = useWatch({ control, name: `requirements.items.${index}.label` });
  const name = label.trim() || t("item", { index: index + 1 });

  return (
    <li className="rounded-lg border bg-card p-4 sm:p-5">
      <div className="flex items-start gap-2">
        <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto_11rem]">
          <Controller
            control={control}
            name={`requirements.items.${index}.label`}
            render={({ field, fieldState }) => (
              <div
                className="min-w-0 space-y-1.5"
                data-invalid={fieldState.error ? true : undefined}
              >
                <label htmlFor={`${id}-label`} className="text-sm font-medium">
                  {t("label")} <span className="sr-only">{index + 1}</span>
                </label>
                <Input
                  id={`${id}-label`}
                  {...field}
                  maxLength={JOB_POST_LIMITS.term}
                  placeholder={t("labelPlaceholder")}
                  aria-invalid={fieldState.error ? true : undefined}
                  aria-describedby={fieldState.error ? `${id}-label-error` : undefined}
                />
                {fieldState.error ? (
                  <p
                    id={`${id}-label-error`}
                    role="alert"
                    className="text-[0.8125rem] text-destructive"
                  >
                    {message(fieldState.error)}
                  </p>
                ) : null}
              </div>
            )}
          />
          <Controller
            control={control}
            name={`requirements.items.${index}.importance`}
            render={({ field }) => (
              <ImportanceToggle
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                label={t("importanceOf", { name })}
              />
            )}
          />
          <Controller
            control={control}
            name={`requirements.items.${index}.kind`}
            render={({ field }) => (
              <div className="min-w-0 space-y-1.5">
                <label htmlFor={`${id}-kind`} className="text-sm font-medium">
                  {t("kind")}
                </label>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    id={`${id}-kind`}
                    aria-label={t("kindOf", { name })}
                    className="w-full"
                    onBlur={field.onBlur}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REQUIREMENT_KINDS.map((kind) => (
                      <SelectItem key={kind} value={kind}>
                        {t(`kinds.${kind}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          aria-label={t("remove", { name })}
          className="mt-7 text-muted-foreground hover:text-destructive"
        >
          <Trash2Icon aria-hidden="true" />
        </Button>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_15rem]">
        <Controller
          control={control}
          name={`requirements.items.${index}.aliases`}
          render={({ field, fieldState }) => (
            <TermsInput
              label={t("aliases")}
              labelDetail={name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              max={JOB_POST_LIMITS.aliases}
              maxLength={JOB_POST_LIMITS.term}
              identity={termKey}
              taken={[label]}
              placeholder={t("aliasesPlaceholder")}
              error={message(fieldState.error)}
            />
          )}
        />
        <Controller
          control={control}
          name={`requirements.items.${index}.note`}
          render={({ field, fieldState }) => (
            <div className="min-w-0 space-y-1.5">
              <label htmlFor={`${id}-note`} className="text-sm font-medium">
                {t("note")}{" "}
                <span className="ml-1 text-[0.8125rem] font-normal text-subtle-foreground">
                  {t("optional")}
                </span>
              </label>
              <Input
                id={`${id}-note`}
                aria-label={t("noteOf", { name })}
                {...field}
                maxLength={JOB_POST_LIMITS.note}
                placeholder={t("notePlaceholder")}
                aria-invalid={fieldState.error ? true : undefined}
              />
            </div>
          )}
        />
      </div>
    </li>
  );
}

/** The job's requirements, edited in the form; nothing is saved until the owner saves. */
export function RequirementsEditor({ control }: { control: Control<JobPostValues> }) {
  const t = useTranslations("jobs.requirements");
  const { fields, append, remove } = useFieldArray({
    control,
    name: "requirements.items",
    keyName: "key",
  });
  const items = useWatch({ control, name: "requirements.items" });
  const required = items.filter((item) => item.importance === "required").length;
  const full = fields.length >= JOB_POST_LIMITS.requirements;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[0.8125rem] text-muted-foreground" data-numeric>
        {t("summary", { total: fields.length, required })}
      </p>
      {fields.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm/relaxed text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {fields.map((field, index) => (
            <RequirementRow
              key={field.key}
              control={control}
              index={index}
              onRemove={() => remove(index)}
            />
          ))}
        </ol>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={full}
          onClick={() =>
            append(newRequirement(), {
              shouldFocus: true,
              focusName: `requirements.items.${fields.length}.label`,
            })
          }
        >
          <PlusIcon aria-hidden="true" />
          {t("add")}
        </Button>
        {full ? (
          <p className="text-[0.8125rem] text-muted-foreground">
            {t("limit", { max: JOB_POST_LIMITS.requirements })}
          </p>
        ) : null}
      </div>
    </div>
  );
}
