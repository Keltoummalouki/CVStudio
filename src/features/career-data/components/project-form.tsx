"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { Controller, useForm, type Control } from "react-hook-form";
import { LocalizedField } from "@/components/forms/localized-field";
import { PeriodField } from "@/components/forms/period-field";
import { TextField } from "@/components/forms/text-field";
import { useValidationMessage } from "@/components/forms/use-validation-message";
import type { Locale } from "@/lib/i18n/config";
import { displayLocalizedText } from "@/lib/i18n/localized-text";
import { saveProject } from "../server/actions";
import { projectSchema, type DetailValues, type ProjectValues } from "../schemas";
import { DetailListEditor } from "./detail-list-editor";
import { EditorFrame, EditorSection } from "./editor-frame";
import { useRecordEditor } from "./use-record-editor";

const LIST_HREF = "/dashboard/content/projects";

export function ProjectForm({ initialValues }: { initialValues: ProjectValues }) {
  const t = useTranslations("careerData");
  const locale = useLocale() as Locale;
  const message = useValidationMessage();
  const form = useForm<ProjectValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: initialValues,
    mode: "onTouched",
  });
  const editor = useRecordEditor({
    form,
    initialValues,
    action: saveProject,
    recordHref: (id) => `${LIST_HREF}/${id}`,
  });
  const { errors } = form.formState;
  // The shared details editor only touches `details`; both forms expose it with the same shape.
  const detailsControl = form.control as unknown as Control<{ details: DetailValues[] }>;

  const title =
    initialValues.id === null
      ? t("editor.newTitle", { item: t("sections.projects.singular") })
      : (displayLocalizedText(initialValues.title, locale)?.text ?? t("records.untitled"));

  return (
    <EditorFrame
      title={title}
      backHref={LIST_HREF}
      backLabel={t("editor.backTo", { section: t("sections.projects.title") })}
      state={editor.state}
      isSaving={editor.isSaving}
      error={editor.error}
      onSubmit={editor.save}
      onReloadLatest={editor.reloadLatest}
      isReloading={editor.isReloading}
      guardDialog={editor.guardDialog}
    >
      <EditorSection title={t("sections.projects.title")}>
        <Controller
          control={form.control}
          name="title"
          render={({ field, fieldState }) => (
            <LocalizedField
              label={t("fields.title")}
              required
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              inputRef={field.ref}
              error={message(fieldState.error)}
            />
          )}
        />
        <Controller
          control={form.control}
          name="description"
          render={({ field, fieldState }) => (
            <LocalizedField
              label={t("fields.description")}
              multiline
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              inputRef={field.ref}
              error={message(fieldState.error)}
            />
          )}
        />
        <div className="grid gap-5 lg:grid-cols-2">
          <TextField
            label={t("fields.projectUrl")}
            type="url"
            inputMode="url"
            placeholder="https://"
            optional
            error={message(errors.projectUrl)}
            {...form.register("projectUrl")}
          />
          <TextField
            label={t("fields.sourceUrl")}
            type="url"
            inputMode="url"
            placeholder="https://"
            optional
            error={message(errors.sourceUrl)}
            {...form.register("sourceUrl")}
          />
        </div>
        <Controller
          control={form.control}
          name="period"
          render={({ field }) => (
            <PeriodField
              value={field.value}
              onChange={field.onChange}
              currentLabel={t("period.current.projects")}
              startError={message(errors.period?.startYear)}
              endError={message(errors.period?.endYear)}
            />
          )}
        />
      </EditorSection>

      <EditorSection title={t("fields.bullets")} description={t("fields.bulletsHint")}>
        <DetailListEditor control={detailsControl} kind="bullet" />
      </EditorSection>

      <EditorSection title={t("fields.technologies")} description={t("fields.technologiesHint")}>
        <DetailListEditor control={detailsControl} kind="technology" />
      </EditorSection>
    </EditorFrame>
  );
}
