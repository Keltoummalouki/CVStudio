"use client";

import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import type { SectionDefinition } from "../definition";
import { removeSection, setSectionTitle, setSectionVisible } from "../operations";
import { useBuilder, useCvText } from "./builder-context";
import {
  CustomSectionEditor,
  SimpleListEditor,
  SkillsEditor,
  SummaryEditor,
} from "./collection-editors";
import { OverrideField } from "./controls";
import { RecordSectionEditor } from "./record-section-editor";
import { getSectionMeta, useSectionName } from "./section-meta";

function SectionBody({ section }: { section: SectionDefinition }) {
  switch (section.kind) {
    case "summary":
      return <SummaryEditor section={section} />;
    case "technical_skills":
      return <SkillsEditor section={section} />;
    case "experience":
    case "education":
    case "projects":
    case "certifications":
      return <RecordSectionEditor section={section} />;
    case "soft_skills":
    case "languages":
      return <SimpleListEditor section={section} />;
    case "custom":
      return <CustomSectionEditor section={section} />;
  }
}

export function SectionEditor({
  section,
  headingId,
  onRemoved,
}: {
  section: SectionDefinition;
  headingId: string;
  onRemoved: () => void;
}) {
  const t = useTranslations("cvBuilder.section");
  const tToolbar = useTranslations("cvBuilder.toolbar");
  const { master, cvLocale, cvLabels, update, undo } = useBuilder();
  const cvText = useCvText();
  const sectionName = useSectionName();
  const name = sectionName(section);
  const Icon = getSectionMeta(section.kind).icon;
  const switchId = `${headingId}-visible`;

  const remove = () => {
    update((definition) => removeSection(definition, section.nodeId));
    onRemoved();
    toast.success(t("removed", { name }), { action: { label: tToolbar("undo"), onClick: undo } });
  };

  const defaultHeading =
    section.kind === "custom"
      ? cvText(master.customSections.find((record) => record.id === section.refId)?.title)
      : { text: cvLabels.sections[section.kind], missing: false };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-ink-100">
            <Icon aria-hidden="true" className="size-4" />
          </span>
          <h2 id={headingId} className="truncate text-base font-semibold tracking-[-0.01em]">
            {name}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <label
            htmlFor={switchId}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[0.8125rem] font-medium"
          >
            <Switch
              id={switchId}
              checked={section.visible}
              onCheckedChange={(visible) =>
                update((definition) => setSectionVisible(definition, section.nodeId, visible))
              }
            />
            {t("visible")}
          </label>
          <Button type="button" variant="ghost" size="sm" onClick={remove}>
            <Trash2Icon aria-hidden="true" />
            {t("remove")}
          </Button>
        </div>
      </div>

      {!section.visible ? (
        <p className="rounded-md bg-ink-100 px-3 py-2 text-[0.8125rem] text-muted-foreground">
          {t("hiddenHint")}
        </p>
      ) : null}

      <OverrideField
        label={t("heading")}
        maxLength={120}
        value={(section.title && resolveLocalizedText(section.title, cvLocale)) ?? ""}
        source={defaultHeading}
        onChange={(text) =>
          update((definition) => setSectionTitle(definition, section.nodeId, cvLocale, text))
        }
      />

      <SectionBody section={section} />
    </div>
  );
}
