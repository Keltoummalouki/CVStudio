"use client";

import { useState } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { PencilLineIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { SortableList } from "@/components/forms/sortable-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { cn } from "@/lib/utils";
import type { DetailRef } from "../definition";
import type { MasterDetail } from "../master-data";
import { setOverride, withOptional } from "../operations";
import { mergeOptOut } from "../resolve";
import { useBuilder, useCvText } from "./builder-context";
import { EditorGroup, OverrideField, SourceText, ToggleChip, VisibilityToggle } from "./controls";

/**
 * Bullets, paragraphs and technologies of one experience or project, for one
 * CV: hide, reorder, or reword each without changing the career data.
 */
export function DetailsEditor({
  refs,
  details,
  onChange,
  showTechnologies,
}: {
  refs: readonly DetailRef[];
  details: readonly MasterDetail[];
  onChange: (refs: DetailRef[]) => void;
  showTechnologies: boolean;
}) {
  const t = useTranslations("cvBuilder.details");
  const { cvLocale } = useBuilder();
  const cvText = useCvText();
  const [editing, setEditing] = useState<string | null>(null);

  const merged = mergeOptOut(refs, details).map(({ item, ref }) => ({
    detail: item,
    ref: ref ?? { refId: item.id, visible: true },
  }));
  const body = merged.filter(({ detail }) => detail.kind !== "technology");
  const technologies = merged.filter(({ detail }) => detail.kind === "technology");
  const all = merged.map(({ ref }) => ref);

  const patch = (refId: string, update: (ref: DetailRef) => DetailRef) =>
    onChange(all.map((ref) => (ref.refId === refId ? update(ref) : ref)));

  if (merged.length === 0) {
    return (
      <p className="rounded-md bg-ink-50 px-4 py-5 text-sm leading-relaxed text-muted-foreground">
        {t("empty")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {body.length > 0 ? (
        <EditorGroup title={t("bullets")} description={t("bulletsHint")}>
          <SortableList
            items={body}
            getKey={({ detail }) => detail.id}
            getLabel={({ detail }, index) =>
              cvText(detail.text)?.text ?? t("bulletFallback", { number: index + 1 })
            }
            onMove={(from, to) =>
              onChange([
                ...arrayMove(
                  body.map(({ ref }) => ref),
                  from,
                  to,
                ),
                ...technologies.map(({ ref }) => ref),
              ])
            }
            compact
            className="flex flex-col divide-y rounded-lg border"
            itemClassName="bg-transparent px-2 py-3 first:rounded-t-lg last:rounded-b-lg"
            renderItem={({ detail, ref }, index) => {
              const override = ref.text ? resolveLocalizedText(ref.text, cvLocale) : null;
              const label = cvText(detail.text)?.text ?? t("bulletFallback", { number: index + 1 });
              const isEditing = editing === detail.id;
              return (
                <div className="flex flex-col gap-2">
                  <div className="flex items-start gap-1">
                    <p
                      className={cn(
                        "min-w-0 flex-1 py-1 text-[0.8125rem] leading-relaxed",
                        !ref.visible && "text-subtle-foreground line-through decoration-ink-300",
                      )}
                    >
                      {override ? (
                        <>
                          {override}
                          <Badge variant="info" className="ml-1.5 align-[0.1em]">
                            {t("edited")}
                          </Badge>
                        </>
                      ) : (
                        <SourceText value={cvText(detail.text)} />
                      )}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-expanded={isEditing}
                      aria-label={t("editWording", { name: label })}
                      onClick={() => setEditing(isEditing ? null : detail.id)}
                    >
                      <PencilLineIcon aria-hidden="true" />
                    </Button>
                    <VisibilityToggle
                      name={label}
                      visible={ref.visible}
                      onChange={(visible) =>
                        patch(detail.id, (current) => ({ ...current, visible }))
                      }
                    />
                  </div>
                </div>
              );
            }}
            renderExpanded={({ detail, ref }) =>
              editing === detail.id ? (
                <div className="rounded-md bg-ink-50 p-3">
                  <OverrideField
                    label={t("wording")}
                    multiline
                    maxLength={1000}
                    value={(ref.text && resolveLocalizedText(ref.text, cvLocale)) ?? ""}
                    source={cvText(detail.text)}
                    onChange={(text) =>
                      patch(detail.id, (current) =>
                        withOptional(current, "text", setOverride(current.text, cvLocale, text)),
                      )
                    }
                  />
                </div>
              ) : null
            }
          />
        </EditorGroup>
      ) : null}

      {technologies.length > 0 ? (
        <EditorGroup
          title={t("technologies")}
          description={showTechnologies ? t("technologiesHint") : t("technologiesOff")}
        >
          <ul className={cn("flex flex-wrap gap-1.5", !showTechnologies && "opacity-55")}>
            {technologies.map(({ detail, ref }) => {
              const text = cvText(detail.text);
              return (
                <li key={detail.id} className="max-w-full">
                  <ToggleChip
                    pressed={ref.visible}
                    missing={text?.missing}
                    onChange={(visible) => patch(detail.id, (current) => ({ ...current, visible }))}
                  >
                    {text?.text ?? "—"}
                  </ToggleChip>
                </li>
              );
            })}
          </ul>
        </EditorGroup>
      ) : null}
    </div>
  );
}
