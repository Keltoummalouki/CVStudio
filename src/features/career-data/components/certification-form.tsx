"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { Controller, useForm, useWatch } from "react-hook-form";
import { LocalizedField } from "@/components/forms/localized-field";
import { MonthYearField } from "@/components/forms/month-year-field";
import { TextField } from "@/components/forms/text-field";
import { useValidationMessage } from "@/components/forms/use-validation-message";
import type { Locale } from "@/lib/i18n/config";
import { displayLocalizedText } from "@/lib/i18n/localized-text";
import { saveCertification } from "../server/actions";
import { certificationSchema, type CertificationValues } from "../schemas";
import { EditorFrame, EditorSection } from "./editor-frame";
import { useRecordEditor } from "./use-record-editor";

const LIST_HREF = "/dashboard/content/certifications";

export function CertificationForm({ initialValues }: { initialValues: CertificationValues }) {
  const t = useTranslations("careerData");
  const locale = useLocale() as Locale;
  const message = useValidationMessage();
  const form = useForm<CertificationValues>({
    resolver: zodResolver(certificationSchema),
    defaultValues: initialValues,
    mode: "onTouched",
  });
  const editor = useRecordEditor({
    form,
    initialValues,
    action: saveCertification,
    recordHref: (id) => `${LIST_HREF}/${id}`,
  });
  const { errors } = form.formState;
  const issuedYear = useWatch({ control: form.control, name: "issuedYear" });
  const issuedMonth = useWatch({ control: form.control, name: "issuedMonth" });

  const title =
    initialValues.id === null
      ? t("editor.newTitle", { item: t("sections.certifications.singular") })
      : (displayLocalizedText(initialValues.title, locale)?.text ?? t("records.untitled"));

  return (
    <EditorFrame
      title={title}
      backHref={LIST_HREF}
      backLabel={t("editor.backTo", { section: t("sections.certifications.title") })}
      state={editor.state}
      isSaving={editor.isSaving}
      error={editor.error}
      onSubmit={editor.save}
      onReloadLatest={editor.reloadLatest}
      isReloading={editor.isReloading}
      guardDialog={editor.guardDialog}
    >
      <EditorSection title={t("sections.certifications.title")}>
        <Controller
          control={form.control}
          name="title"
          render={({ field, fieldState }) => (
            <LocalizedField
              label={t("fields.certificationTitle")}
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
          name="issuer"
          render={({ field, fieldState }) => (
            <LocalizedField
              label={t("fields.issuer")}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              inputRef={field.ref}
              error={message(fieldState.error)}
            />
          )}
        />
        <div className="grid gap-5 lg:grid-cols-2">
          <MonthYearField
            legend={t("fields.issued")}
            value={{ year: issuedYear, month: issuedMonth }}
            onChange={(next) => {
              form.setValue("issuedYear", next.year, { shouldDirty: true, shouldValidate: true });
              form.setValue("issuedMonth", next.month, { shouldDirty: true });
            }}
          />
          <TextField
            label={t("fields.credentialUrl")}
            type="url"
            inputMode="url"
            placeholder="https://"
            optional
            error={message(errors.credentialUrl)}
            {...form.register("credentialUrl")}
          />
        </div>
      </EditorSection>
    </EditorFrame>
  );
}
