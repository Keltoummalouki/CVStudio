"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { Controller, useForm } from "react-hook-form";
import { LocalizedField } from "@/components/forms/localized-field";
import { PeriodField } from "@/components/forms/period-field";
import { useValidationMessage } from "@/components/forms/use-validation-message";
import type { Locale } from "@/lib/i18n/config";
import { displayLocalizedText } from "@/lib/i18n/localized-text";
import { saveEducation } from "../server/actions";
import { educationSchema, type EducationValues } from "../schemas";
import { EditorFrame, EditorSection } from "./editor-frame";
import { useRecordEditor } from "./use-record-editor";

const LIST_HREF = "/dashboard/content/education";

export function EducationForm({ initialValues }: { initialValues: EducationValues }) {
  const t = useTranslations("careerData");
  const locale = useLocale() as Locale;
  const message = useValidationMessage();
  const form = useForm<EducationValues>({
    resolver: zodResolver(educationSchema),
    defaultValues: initialValues,
    mode: "onTouched",
  });
  const editor = useRecordEditor({
    form,
    initialValues,
    action: saveEducation,
    recordHref: (id) => `${LIST_HREF}/${id}`,
  });
  const { errors } = form.formState;

  const title =
    initialValues.id === null
      ? t("editor.newTitle", { item: t("sections.education.singular") })
      : (displayLocalizedText(initialValues.credential, locale)?.text ?? t("records.untitled"));

  const localized = (
    name: "credential" | "institution" | "location" | "description",
    label: string,
    options: { required?: boolean; multiline?: boolean } = {},
  ) => (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <LocalizedField
          label={label}
          required={options.required}
          multiline={options.multiline}
          value={field.value}
          onChange={field.onChange}
          onBlur={field.onBlur}
          inputRef={field.ref}
          error={message(fieldState.error)}
        />
      )}
    />
  );

  return (
    <EditorFrame
      title={title}
      backHref={LIST_HREF}
      backLabel={t("editor.backTo", { section: t("sections.education.title") })}
      state={editor.state}
      isSaving={editor.isSaving}
      error={editor.error}
      onSubmit={editor.save}
      onReloadLatest={editor.reloadLatest}
      isReloading={editor.isReloading}
      guardDialog={editor.guardDialog}
    >
      <EditorSection title={t("sections.education.title")}>
        {localized("credential", t("fields.credential"), { required: true })}
        {localized("institution", t("fields.institution"))}
        {localized("location", t("fields.location"))}
        {localized("description", t("fields.description"), { multiline: true })}
        <Controller
          control={form.control}
          name="period"
          render={({ field }) => (
            <PeriodField
              value={field.value}
              onChange={field.onChange}
              currentLabel={t("period.current.education")}
              startError={message(errors.period?.startYear)}
              endError={message(errors.period?.endYear)}
            />
          )}
        />
      </EditorSection>
    </EditorFrame>
  );
}
