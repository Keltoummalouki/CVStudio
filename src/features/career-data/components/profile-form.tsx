"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { LocalizedField } from "@/components/forms/localized-field";
import { SortableList } from "@/components/forms/sortable-list";
import { TextField } from "@/components/forms/text-field";
import { useValidationMessage } from "@/components/forms/use-validation-message";
import { Button } from "@/components/ui/button";
import { fieldControlClassName } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { saveProfile } from "../server/actions";
import { LINK_KINDS, profileSchema, type LinkKind, type ProfileValues } from "../schemas";
import { EditorFrame, EditorSection } from "./editor-frame";
import { PhotoField } from "./photo-field";
import { useRecordEditor } from "./use-record-editor";

const HUB_HREF = "/dashboard/content";

export function ProfileForm({
  initialValues,
  photoUrl,
}: {
  initialValues: ProfileValues;
  photoUrl: string | null;
}) {
  const t = useTranslations("careerData");
  const message = useValidationMessage();
  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: initialValues,
    mode: "onTouched",
  });
  const editor = useRecordEditor({ form, initialValues, action: saveProfile });
  const links = useFieldArray({ control: form.control, name: "links", keyName: "key" });
  const linkKinds = useWatch({ control: form.control, name: "links" });
  const { errors } = form.formState;

  const localized = (name: "title" | "summary" | "location", label: string, multiline = false) => (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <LocalizedField
          label={label}
          multiline={multiline}
          rows={4}
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
      title={t("sections.profile.title")}
      description={t("sections.profile.description")}
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
      <EditorSection title={t("sections.profile.title")}>
        <div className="grid gap-5 lg:grid-cols-2">
          <TextField
            label={t("fields.fullName")}
            autoComplete="name"
            optional
            error={message(errors.fullName)}
            {...form.register("fullName")}
          />
        </div>
        {localized("title", t("fields.professionalTitle"))}
        {localized("summary", t("fields.summary"), true)}
      </EditorSection>

      <EditorSection title={t("fields.photo")}>
        <PhotoField initialUrl={photoUrl} />
      </EditorSection>

      <EditorSection title={t("fields.contact")}>
        <div className="grid gap-5 lg:grid-cols-2">
          <TextField
            label={t("fields.email")}
            type="email"
            autoComplete="email"
            inputMode="email"
            optional
            error={message(errors.email)}
            {...form.register("email")}
          />
          <TextField
            label={t("fields.phone")}
            type="tel"
            autoComplete="tel"
            optional
            error={message(errors.phone)}
            {...form.register("phone")}
          />
        </div>
        {localized("location", t("fields.location"))}
      </EditorSection>

      <EditorSection title={t("fields.links")}>
        {links.fields.length > 0 ? (
          <SortableList
            items={links.fields}
            getKey={(link) => link.key}
            getLabel={(link, index) => link.url || `${t("fields.url")} ${index + 1}`}
            onMove={links.move}
            className="flex flex-col divide-y rounded-md border"
            itemClassName="px-2 py-3"
            renderItem={(_link, index) => {
              const kind = linkKinds?.[index]?.kind;
              return (
                <div className="flex items-start gap-2">
                  <div className="grid min-w-0 flex-1 gap-3 lg:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)]">
                    <label className="min-w-0 space-y-1.5">
                      <span className="text-sm font-medium">{t("fields.linkKind")}</span>
                      <Controller
                        control={form.control}
                        name={`links.${index}.kind`}
                        render={({ field }) => (
                          <select
                            value={field.value}
                            onChange={(event) => field.onChange(event.target.value as LinkKind)}
                            className={cn(fieldControlClassName, "h-9 px-3 pointer-coarse:h-11")}
                          >
                            {LINK_KINDS.map((option) => (
                              <option key={option} value={option}>
                                {t(`fields.linkKinds.${option}`)}
                              </option>
                            ))}
                          </select>
                        )}
                      />
                    </label>
                    <TextField
                      label={t("fields.url")}
                      type="url"
                      inputMode="url"
                      placeholder="https://"
                      error={message(errors.links?.[index]?.url)}
                      {...form.register(`links.${index}.url`)}
                    />
                    <TextField
                      label={t("fields.displayText")}
                      optional
                      error={message(errors.links?.[index]?.displayText)}
                      {...form.register(`links.${index}.displayText`)}
                    />
                    {kind === "other" || kind === "website" ? (
                      <Controller
                        control={form.control}
                        name={`links.${index}.label`}
                        render={({ field, fieldState }) => (
                          <LocalizedField
                            label={t("fields.linkLabel")}
                            value={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            error={message(fieldState.error)}
                            className="lg:col-span-3"
                          />
                        )}
                      />
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => links.remove(index)}
                    aria-label={`${t("fields.remove")}: ${t("fields.url")} ${index + 1}`}
                    className="mt-7 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2Icon aria-hidden="true" />
                  </Button>
                </div>
              );
            }}
          />
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() =>
            links.append(
              { id: null, kind: "github", label: {}, displayText: "", url: "" },
              { shouldFocus: true, focusName: `links.${links.fields.length}.url` },
            )
          }
        >
          <PlusIcon aria-hidden="true" />
          {t("fields.addLink")}
        </Button>
      </EditorSection>
    </EditorFrame>
  );
}
