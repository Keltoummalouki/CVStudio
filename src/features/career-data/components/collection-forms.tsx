"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDownIcon, ChevronUpIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Controller, useFieldArray, useForm, useWatch, type Control } from "react-hook-form";
import { LocalizedField } from "@/components/forms/localized-field";
import { SortableList } from "@/components/forms/sortable-list";
import { useValidationMessage } from "@/components/forms/use-validation-message";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/config";
import { displayLocalizedText } from "@/lib/i18n/localized-text";
import { saveSkillGroups, saveSoftSkills, saveSpokenLanguages } from "../server/actions";
import {
  skillGroupsSchema,
  softSkillsSchema,
  spokenLanguagesSchema,
  type SkillGroupsValues,
  type SoftSkillsValues,
  type SpokenLanguagesValues,
} from "../schemas";
import { EditorFrame, EditorSection } from "./editor-frame";
import { useRecordEditor } from "./use-record-editor";

const HUB_HREF = "/dashboard/content";

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={onClick}
      aria-label={label}
      className="mt-0.5 text-muted-foreground hover:text-destructive"
    >
      <Trash2Icon aria-hidden="true" />
    </Button>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="outline" size="sm" className="self-start" onClick={onClick}>
      <PlusIcon aria-hidden="true" />
      {label}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Soft skills
// ---------------------------------------------------------------------------

export function SoftSkillsForm({ initialValues }: { initialValues: SoftSkillsValues }) {
  const t = useTranslations("careerData");
  const locale = useLocale() as Locale;
  const message = useValidationMessage();
  const form = useForm<SoftSkillsValues>({
    resolver: zodResolver(softSkillsSchema),
    defaultValues: initialValues,
    mode: "onTouched",
  });
  const editor = useRecordEditor({ form, initialValues, action: saveSoftSkills });
  const items = useFieldArray({ control: form.control, name: "items", keyName: "key" });
  const itemLabel = (index: number) => `${t("fields.softSkill")} ${index + 1}`;

  return (
    <EditorFrame
      title={t("sections.softSkills.title")}
      description={t("sections.softSkills.description")}
      backHref={HUB_HREF}
      backLabel={t("editor.backTo", { section: t("title") })}
      state={editor.state}
      isSaving={editor.isSaving}
      error={editor.error}
      onSubmit={editor.save}
      onReloadLatest={editor.reloadLatest}
      isReloading={editor.isReloading}
      guardDialog={editor.guardDialog}
    >
      <EditorSection title={t("sections.softSkills.title")}>
        {items.fields.length > 0 ? (
          <SortableList
            items={items.fields}
            getKey={(item) => item.key}
            getLabel={(item, index) =>
              displayLocalizedText(item.label, locale)?.text ?? itemLabel(index)
            }
            onMove={items.move}
            className="flex flex-col divide-y rounded-md border"
            itemClassName="px-2 py-2.5"
            renderItem={(_item, index) => (
              <div className="flex items-start gap-2">
                <Controller
                  control={form.control}
                  name={`items.${index}.label`}
                  render={({ field, fieldState }) => (
                    <LocalizedField
                      label={itemLabel(index)}
                      hideLabel
                      required
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      inputRef={field.ref}
                      error={message(fieldState.error)}
                      className="flex-1"
                    />
                  )}
                />
                <RemoveButton
                  label={`${t("fields.remove")}: ${itemLabel(index)}`}
                  onClick={() => items.remove(index)}
                />
              </div>
            )}
          />
        ) : null}
        <AddButton
          label={t("fields.addSoftSkill")}
          onClick={() =>
            items.append(
              { id: null, label: {} },
              { shouldFocus: true, focusName: `items.${items.fields.length}.label` },
            )
          }
        />
      </EditorSection>
    </EditorFrame>
  );
}

// ---------------------------------------------------------------------------
// Spoken languages
// ---------------------------------------------------------------------------

export function SpokenLanguagesForm({ initialValues }: { initialValues: SpokenLanguagesValues }) {
  const t = useTranslations("careerData");
  const locale = useLocale() as Locale;
  const message = useValidationMessage();
  const form = useForm<SpokenLanguagesValues>({
    resolver: zodResolver(spokenLanguagesSchema),
    defaultValues: initialValues,
    mode: "onTouched",
  });
  const editor = useRecordEditor({ form, initialValues, action: saveSpokenLanguages });
  const items = useFieldArray({ control: form.control, name: "items", keyName: "key" });
  const itemLabel = (index: number) => `${t("fields.language")} ${index + 1}`;

  return (
    <EditorFrame
      title={t("sections.languages.title")}
      description={t("sections.languages.description")}
      backHref={HUB_HREF}
      backLabel={t("editor.backTo", { section: t("title") })}
      state={editor.state}
      isSaving={editor.isSaving}
      error={editor.error}
      onSubmit={editor.save}
      onReloadLatest={editor.reloadLatest}
      isReloading={editor.isReloading}
      guardDialog={editor.guardDialog}
    >
      <EditorSection title={t("sections.languages.title")}>
        {items.fields.length > 0 ? (
          <SortableList
            items={items.fields}
            getKey={(item) => item.key}
            getLabel={(item, index) =>
              displayLocalizedText(item.name, locale)?.text ?? itemLabel(index)
            }
            onMove={items.move}
            className="flex flex-col divide-y rounded-md border"
            itemClassName="px-2 py-3"
            renderItem={(_item, index) => (
              <div className="flex items-start gap-2">
                <div className="grid min-w-0 flex-1 gap-4 xl:grid-cols-2">
                  <Controller
                    control={form.control}
                    name={`items.${index}.name`}
                    render={({ field, fieldState }) => (
                      <LocalizedField
                        label={t("fields.language")}
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
                    name={`items.${index}.proficiency`}
                    render={({ field, fieldState }) => (
                      <LocalizedField
                        label={t("fields.proficiency")}
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        error={message(fieldState.error)}
                      />
                    )}
                  />
                </div>
                <RemoveButton
                  label={`${t("fields.remove")}: ${itemLabel(index)}`}
                  onClick={() => items.remove(index)}
                />
              </div>
            )}
          />
        ) : null}
        <AddButton
          label={t("fields.addLanguage")}
          onClick={() =>
            items.append(
              { id: null, name: {}, proficiency: {} },
              { shouldFocus: true, focusName: `items.${items.fields.length}.name` },
            )
          }
        />
      </EditorSection>
    </EditorFrame>
  );
}

// ---------------------------------------------------------------------------
// Technical skills: groups with skills
// ---------------------------------------------------------------------------

function SkillGroupEditor({
  control,
  index,
  total,
  onMove,
  onRemove,
}: {
  control: Control<SkillGroupsValues>;
  index: number;
  total: number;
  onMove: (from: number, to: number) => void;
  onRemove: () => void;
}) {
  const t = useTranslations("careerData");
  const locale = useLocale() as Locale;
  const message = useValidationMessage();
  const skills = useFieldArray({ control, name: `groups.${index}.skills`, keyName: "key" });
  const title = useWatch({ control, name: `groups.${index}.title` });
  const heading =
    (title && displayLocalizedText(title, locale)?.text) ||
    t("fields.groupFallback", { number: index + 1 });
  const skillLabel = (position: number) => `${t("fields.skills")} ${position + 1}`;

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
            aria-label={`${t("records.moveUp")}: ${heading}`}
          >
            <ChevronUpIcon aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={index === total - 1}
            onClick={() => onMove(index, index + 1)}
            aria-label={`${t("records.moveDown")}: ${heading}`}
          >
            <ChevronDownIcon aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2Icon aria-hidden="true" />
            {t("fields.removeGroup")}
          </Button>
        </div>
      }
    >
      <Controller
        control={control}
        name={`groups.${index}.title`}
        render={({ field, fieldState }) => (
          <LocalizedField
            label={t("fields.skillGroup")}
            required
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            inputRef={field.ref}
            error={message(fieldState.error)}
          />
        )}
      />
      <div className="space-y-2">
        <p className="text-sm font-medium">{t("fields.skills")}</p>
        {skills.fields.length > 0 ? (
          <SortableList
            items={skills.fields}
            getKey={(skill) => skill.key}
            getLabel={(skill, position) =>
              displayLocalizedText(skill.label, locale)?.text ?? skillLabel(position)
            }
            onMove={skills.move}
            className="flex flex-col divide-y rounded-md border"
            itemClassName="px-2 py-2.5"
            renderItem={(_skill, position) => (
              <div className="flex items-start gap-2">
                <Controller
                  control={control}
                  name={`groups.${index}.skills.${position}.label`}
                  render={({ field, fieldState }) => (
                    <LocalizedField
                      label={skillLabel(position)}
                      hideLabel
                      required
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      inputRef={field.ref}
                      error={message(fieldState.error)}
                      className="flex-1"
                    />
                  )}
                />
                <RemoveButton
                  label={`${t("fields.remove")}: ${skillLabel(position)}`}
                  onClick={() => skills.remove(position)}
                />
              </div>
            )}
          />
        ) : null}
      </div>
      <AddButton
        label={t("fields.addSkill")}
        onClick={() =>
          skills.append(
            { id: null, label: { shared: "" } },
            {
              shouldFocus: true,
              focusName: `groups.${index}.skills.${skills.fields.length}.label`,
            },
          )
        }
      />
    </EditorSection>
  );
}

export function SkillGroupsForm({ initialValues }: { initialValues: SkillGroupsValues }) {
  const t = useTranslations("careerData");
  const form = useForm<SkillGroupsValues>({
    resolver: zodResolver(skillGroupsSchema),
    defaultValues: initialValues,
    mode: "onTouched",
  });
  const editor = useRecordEditor({ form, initialValues, action: saveSkillGroups });
  const groups = useFieldArray({ control: form.control, name: "groups", keyName: "key" });

  return (
    <EditorFrame
      title={t("sections.technicalSkills.title")}
      description={t("sections.technicalSkills.description")}
      backHref={HUB_HREF}
      backLabel={t("editor.backTo", { section: t("title") })}
      state={editor.state}
      isSaving={editor.isSaving}
      error={editor.error}
      onSubmit={editor.save}
      onReloadLatest={editor.reloadLatest}
      isReloading={editor.isReloading}
      guardDialog={editor.guardDialog}
    >
      {groups.fields.map((group, index) => (
        <SkillGroupEditor
          key={group.key}
          control={form.control}
          index={index}
          total={groups.fields.length}
          onMove={groups.move}
          onRemove={() => groups.remove(index)}
        />
      ))}
      <AddButton
        label={t("fields.addGroup")}
        onClick={() =>
          groups.append(
            { id: null, title: {}, skills: [] },
            { shouldFocus: true, focusName: `groups.${groups.fields.length}.title` },
          )
        }
      />
    </EditorFrame>
  );
}
