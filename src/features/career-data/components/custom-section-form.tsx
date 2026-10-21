"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDownIcon, ChevronUpIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Controller, useFieldArray, useForm, useWatch, type Control } from "react-hook-form";
import { LocalizedField } from "@/components/forms/localized-field";
import { SortableList } from "@/components/forms/sortable-list";
import { useValidationMessage } from "@/components/forms/use-validation-message";
import { fieldControlClassName } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/config";
import { displayLocalizedText } from "@/lib/i18n/localized-text";
import { cn } from "@/lib/utils";
import { saveCustomSection } from "../server/actions";
import {
  CUSTOM_ITEM_KINDS,
  customSectionSchema,
  type CustomItemKind,
  type CustomSectionValues,
} from "../schemas";
import { EditorFrame, EditorSection } from "./editor-frame";
import { useRecordEditor } from "./use-record-editor";

const LIST_HREF = "/dashboard/content/custom-sections";

function ItemRow({
  control,
  subsectionIndex,
  itemIndex,
  label,
  onRemove,
}: {
  control: Control<CustomSectionValues>;
  subsectionIndex: number;
  itemIndex: number;
  label: string;
  onRemove: () => void;
}) {
  const t = useTranslations("careerData.fields");
  const message = useValidationMessage();
  const base = `subsections.${subsectionIndex}.items.${itemIndex}` as const;
  const kind = useWatch({ control, name: `${base}.kind` });

  return (
    <div className="flex items-start gap-2">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <Controller
          control={control}
          name={`${base}.kind`}
          render={({ field }) => (
            <label className="flex w-fit items-center gap-2 text-[0.8125rem] text-muted-foreground">
              {t("itemKind")}
              <select
                value={field.value}
                onChange={(event) => field.onChange(event.target.value as CustomItemKind)}
                className={cn(
                  fieldControlClassName,
                  "h-8 w-auto py-0 pr-2 pl-2.5 pointer-coarse:h-10",
                )}
              >
                {CUSTOM_ITEM_KINDS.map((option) => (
                  <option key={option} value={option}>
                    {t(`itemKinds.${option}`)}
                  </option>
                ))}
              </select>
            </label>
          )}
        />
        {kind === "key_value" ? (
          <Controller
            control={control}
            name={`${base}.label`}
            render={({ field, fieldState }) => (
              <LocalizedField
                label={t("itemLabel")}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={message(fieldState.error)}
              />
            )}
          />
        ) : null}
        <Controller
          control={control}
          name={`${base}.text`}
          render={({ field, fieldState }) => (
            <LocalizedField
              label={kind === "key_value" ? t("itemText") : label}
              hideLabel={kind !== "key_value"}
              required
              allowShared={kind === "key_value"}
              multiline={kind !== "key_value"}
              rows={kind === "paragraph" ? 4 : 2}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              inputRef={field.ref}
              error={message(fieldState.error)}
            />
          )}
        />
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onRemove}
        aria-label={`${t("remove")}: ${label}`}
        className="mt-0.5 text-muted-foreground hover:text-destructive"
      >
        <Trash2Icon aria-hidden="true" />
      </Button>
    </div>
  );
}

function SubsectionEditor({
  control,
  index,
  total,
  onMove,
  onRemove,
}: {
  control: Control<CustomSectionValues>;
  index: number;
  total: number;
  onMove: (from: number, to: number) => void;
  onRemove: () => void;
}) {
  const t = useTranslations("careerData.fields");
  const tRecords = useTranslations("careerData.records");
  const locale = useLocale() as Locale;
  const message = useValidationMessage();
  const items = useFieldArray({ control, name: `subsections.${index}.items`, keyName: "key" });
  const title = useWatch({ control, name: `subsections.${index}.title` });
  const heading =
    (title && displayLocalizedText(title, locale)?.text) ||
    t("subsectionFallback", { number: index + 1 });

  return (
    <EditorSection
      title={heading}
      aside={
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={index === 0}
            onClick={() => onMove(index, index - 1)}
            aria-label={`${tRecords("moveUp")}: ${heading}`}
          >
            <ChevronUpIcon aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={index === total - 1}
            onClick={() => onMove(index, index + 1)}
            aria-label={`${tRecords("moveDown")}: ${heading}`}
          >
            <ChevronDownIcon aria-hidden="true" />
          </Button>
          {total > 1 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2Icon aria-hidden="true" />
              {t("removeSubsection")}
            </Button>
          ) : null}
        </div>
      }
    >
      <Controller
        control={control}
        name={`subsections.${index}.title`}
        render={({ field, fieldState }) => (
          <LocalizedField
            label={t("subsectionTitle")}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            error={message(fieldState.error)}
          />
        )}
      />

      {items.fields.length > 0 ? (
        <SortableList
          items={items.fields}
          getKey={(item) => item.key}
          getLabel={(item, position) =>
            displayLocalizedText(item.text, locale)?.text ?? `${t("itemText")} ${position + 1}`
          }
          onMove={items.move}
          className="flex flex-col divide-y rounded-md border"
          itemClassName="px-2 py-3"
          renderItem={(_item, position) => (
            <ItemRow
              control={control}
              subsectionIndex={index}
              itemIndex={position}
              label={`${t("itemText")} ${position + 1}`}
              onRemove={() => items.remove(position)}
            />
          )}
        />
      ) : null}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() =>
          items.append(
            { id: null, kind: "bullet", label: {}, text: {} },
            {
              shouldFocus: true,
              focusName: `subsections.${index}.items.${items.fields.length}.text`,
            },
          )
        }
      >
        <PlusIcon aria-hidden="true" />
        {t("addItem")}
      </Button>
    </EditorSection>
  );
}

export function CustomSectionForm({ initialValues }: { initialValues: CustomSectionValues }) {
  const t = useTranslations("careerData");
  const locale = useLocale() as Locale;
  const message = useValidationMessage();
  const form = useForm<CustomSectionValues>({
    resolver: zodResolver(customSectionSchema),
    defaultValues: initialValues,
    mode: "onTouched",
  });
  const editor = useRecordEditor({
    form,
    initialValues,
    action: saveCustomSection,
    recordHref: (id) => `${LIST_HREF}/${id}`,
  });
  const subsections = useFieldArray({ control: form.control, name: "subsections", keyName: "key" });

  const title =
    initialValues.id === null
      ? t("editor.newTitle", { item: t("sections.custom.singular") })
      : (displayLocalizedText(initialValues.title, locale)?.text ?? t("records.untitled"));

  return (
    <EditorFrame
      title={title}
      backHref={LIST_HREF}
      backLabel={t("editor.backTo", { section: t("sections.custom.title") })}
      state={editor.state}
      isSaving={editor.isSaving}
      error={editor.error}
      onSubmit={editor.save}
      onReloadLatest={editor.reloadLatest}
      isReloading={editor.isReloading}
      guardDialog={editor.guardDialog}
    >
      <EditorSection title={t("sections.custom.title")}>
        <Controller
          control={form.control}
          name="title"
          render={({ field, fieldState }) => (
            <LocalizedField
              label={t("fields.sectionTitle")}
              required
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              inputRef={field.ref}
              error={message(fieldState.error)}
            />
          )}
        />
      </EditorSection>

      {subsections.fields.map((subsection, index) => (
        <SubsectionEditor
          key={subsection.key}
          control={form.control}
          index={index}
          total={subsections.fields.length}
          onMove={subsections.move}
          onRemove={() => subsections.remove(index)}
        />
      ))}

      <Button
        type="button"
        variant="outline"
        className="self-start"
        onClick={() => subsections.append({ id: null, title: {}, items: [] })}
      >
        <PlusIcon aria-hidden="true" />
        {t("fields.addSubsection")}
      </Button>
    </EditorFrame>
  );
}
