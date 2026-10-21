"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Controller, useFieldArray, type Control } from "react-hook-form";
import { LocalizedField } from "@/components/forms/localized-field";
import { SortableList } from "@/components/forms/sortable-list";
import { useValidationMessage } from "@/components/forms/use-validation-message";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/config";
import { displayLocalizedText } from "@/lib/i18n/localized-text";
import type { DetailKind, DetailValues } from "../schemas";

type FormWithDetails = { details: DetailValues[] };

type DetailListEditorProps = {
  // Experience and project forms both expose `details`.
  control: Control<FormWithDetails>;
  kind: Extract<DetailKind, "bullet" | "technology">;
};

/**
 * Edits one kind of detail (achievements or technologies) inside the shared
 * `details` array. Moves are translated to array positions so the other kind's
 * relative order is preserved.
 */
export function DetailListEditor({ control, kind }: DetailListEditorProps) {
  const t = useTranslations("careerData.fields");
  const locale = useLocale() as Locale;
  const message = useValidationMessage();
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "details",
    keyName: "key",
  });

  const rows = fields
    .map((field, index) => ({ field, index }))
    .filter(({ field }) => field.kind === kind);

  const isBullet = kind === "bullet";
  const itemLabel = (position: number) =>
    `${isBullet ? t("bullets") : t("technologies")} ${position + 1}`;

  return (
    <div className="flex flex-col gap-3">
      {rows.length > 0 ? (
        <SortableList
          items={rows}
          getKey={(row) => row.field.key}
          getLabel={(row, position) =>
            displayLocalizedText(row.field.text, locale)?.text ?? itemLabel(position)
          }
          onMove={(from, to) => {
            const source = rows[from];
            const target = rows[to];
            if (source && target) move(source.index, target.index);
          }}
          className="flex flex-col divide-y rounded-md border"
          itemClassName="px-2 py-2.5"
          renderItem={(row, position) => (
            <div className="flex items-start gap-2">
              <Controller
                control={control}
                name={`details.${row.index}.text`}
                render={({ field, fieldState }) => (
                  <LocalizedField
                    label={itemLabel(position)}
                    hideLabel
                    required
                    multiline={isBullet}
                    // A sentence is never language-neutral; names and technologies often are.
                    allowShared={!isBullet}
                    rows={2}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    inputRef={field.ref}
                    error={message(fieldState.error)}
                    className="flex-1"
                  />
                )}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => remove(row.index)}
                aria-label={`${t("remove")}: ${itemLabel(position)}`}
                className="mt-0.5 text-muted-foreground hover:text-destructive"
              >
                <Trash2Icon aria-hidden="true" />
              </Button>
            </div>
          )}
        />
      ) : null}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() =>
          append(
            { id: null, kind, text: isBullet ? {} : { shared: "" } },
            { shouldFocus: true, focusName: `details.${fields.length}.text` },
          )
        }
      >
        <PlusIcon aria-hidden="true" />
        {isBullet ? t("addBullet") : t("addTechnology")}
      </Button>
    </div>
  );
}
