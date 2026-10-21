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
import { saveExperience } from "../server/actions";
import { experienceSchema, type DetailValues, type ExperienceValues } from "../schemas";
import { DetailListEditor } from "./detail-list-editor";
import { EditorFrame, EditorSection } from "./editor-frame";
import { useRecordEditor } from "./use-record-editor";

const LIST_HREF = "/dashboard/content/experiences";

export function ExperienceForm({ initialValues }: { initialValues: ExperienceValues }) {
  const t = useTranslations("careerData");
  const locale = useLocale() as Locale;
  const message = useValidationMessage();
  const form = useForm<ExperienceValues>({
    resolver: zodResolver(experienceSchema),
    defaultValues: initialValues,
    mode: "onTouched",
  });
  const editor = useRecordEditor({
    form,
    initialValues,
    action: saveExperience,
    recordHref: (id) => `${LIST_HREF}/${id}`,
  });
  const { errors } = form.formState;
  const detailsControl = form.control as unknown as Control<{ details: DetailValues[] }>;

  const title =
    initialValues.id === null
      ? t("editor.newTitle", { item: t("sections.experience.singular") })
      : (displayLocalizedText(initialValues.role, locale)?.text ?? initialValues.organization);

  return (
    <EditorFrame
      title={title}
      backHref={LIST_HREF}
      backLabel={t("editor.backTo", { section: t("sections.experience.title") })}
      state={editor.state}
      isSaving={editor.isSaving}
      error={editor.error}
      onSubmit={editor.save}
      onReloadLatest={editor.reloadLatest}
      isReloading={editor.isReloading}
      guardDialog={editor.guardDialog}
    >
      <EditorSection title={t("sections.experience.title")}>
        <Controller
          control={form.control}
          name="role"
          render={({ field, fieldState }) => (
            <LocalizedField
              label={t("fields.role")}
              required
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
            label={t("fields.organization")}
            autoComplete="organization"
            error={message(errors.organization)}
            {...form.register("organization")}
          />
        </div>
        <Controller
          control={form.control}
          name="location"
          render={({ field, fieldState }) => (
            <LocalizedField
              label={t("fields.location")}
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
          name="period"
          render={({ field }) => (
            <PeriodField
              value={field.value}
              onChange={field.onChange}
              currentLabel={t("period.current.experience")}
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
