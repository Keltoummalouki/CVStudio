"use client";

import { arrayMove } from "@dnd-kit/sortable";
import { ChevronRightIcon, IdCardIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { SortableList } from "@/components/forms/sortable-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { displayLocalizedText, resolveLocalizedText } from "@/lib/i18n/localized-text";
import { cn } from "@/lib/utils";
import {
  BUILT_IN_SECTION_ORDER,
  createBuiltInSection,
  createCustomSection,
  isRecordSection,
} from "../defaults";
import type { SectionDefinition } from "../definition";
import { addSection, reorderSections, setSectionVisible } from "../operations";
import { countMissing, useBuilder } from "./builder-context";
import { VisibilityToggle } from "./controls";
import { getSectionMeta, useSectionName } from "./section-meta";

export const HEADER_TARGET = "header";

function MissingBadge({ count }: { count: number }) {
  const t = useTranslations("cvBuilder.outline");
  if (count === 0) return null;
  return (
    <Badge variant="signal" className="tabular-nums" aria-label={t("missing", { count })}>
      {count}
    </Badge>
  );
}

function OutlineRow({
  icon: Icon,
  name,
  detail,
  selected,
  hidden,
  missing,
  onSelect,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>;
  name: string;
  detail?: string | null;
  selected: boolean;
  hidden?: boolean;
  missing: number;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-current={selected ? "true" : undefined}
      onClick={onSelect}
      className={cn(
        "group/row flex min-h-12 w-full min-w-0 items-center gap-2.5 rounded-md px-2.5 py-2.5 text-left transition-colors outline-none focus-visible:focus-ring pointer-coarse:min-h-14",
        "hover:bg-ink-100 aria-[current=true]:bg-ink-950 aria-[current=true]:text-paper",
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          "size-4 shrink-0 text-muted-foreground group-aria-[current=true]/row:text-paper/70",
        )}
      />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-sm font-medium",
            hidden &&
              "text-subtle-foreground line-through decoration-ink-300 group-aria-[current=true]/row:text-paper/60",
          )}
        >
          {name}
        </span>
        {detail ? (
          <span className="block truncate text-xs text-muted-foreground group-aria-[current=true]/row:text-paper/70">
            {detail}
          </span>
        ) : null}
      </span>
      <MissingBadge count={missing} />
      <ChevronRightIcon
        aria-hidden="true"
        className="size-4 shrink-0 text-subtle-foreground md:hidden"
      />
    </button>
  );
}

/** The CV's structure: the header, then sections in print order. */
export function SectionOutline({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (target: string) => void;
}) {
  const t = useTranslations("cvBuilder.outline");
  const { definition, master, issues, cvLocale, update } = useBuilder();
  const sectionName = useSectionName();
  const tSections = useTranslations("cvBuilder.sections");
  const tCareer = useTranslations("careerData.sections");

  const detailOf = (section: SectionDefinition): string | null => {
    const heading = section.title ? resolveLocalizedText(section.title, cvLocale) : null;
    if (heading) return `“${heading}”`;
    if (isRecordSection(section)) {
      return t("included", { count: section.items.filter((item) => item.visible).length });
    }
    return null;
  };

  const presentKinds = new Set(definition.sections.map((section) => section.kind));
  const presentCustom = new Set(
    definition.sections.flatMap((section) => (section.kind === "custom" ? [section.refId] : [])),
  );
  const missingBuiltIns = BUILT_IN_SECTION_ORDER.filter((kind) => !presentKinds.has(kind));
  const missingCustom = master.customSections.filter(
    (record) => !record.archived && !presentCustom.has(record.id),
  );

  const add = (section: SectionDefinition) => {
    update((current) => addSection(current, section));
    onSelect(section.nodeId);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="space-y-1 px-2">
        <h2 className="text-base font-semibold tracking-[-0.02em]">{t("title")}</h2>
        <p className="text-xs leading-relaxed text-muted-foreground">{t("hint")}</p>
      </div>
      <OutlineRow
        icon={IdCardIcon}
        name={t("header")}
        detail={t("headerDetail")}
        selected={selected === HEADER_TARGET}
        missing={countMissing(issues, null)}
        onSelect={() => onSelect(HEADER_TARGET)}
      />

      <div className="flex flex-col gap-2 border-t pt-4">
        <h3 className="px-2 text-xs font-semibold text-muted-foreground">
          {t("sections", { count: definition.sections.length })}
        </h3>
        {definition.sections.length === 0 ? (
          <p className="rounded-md border border-dashed px-3 py-4 text-[0.8125rem] text-muted-foreground">
            {t("empty")}
          </p>
        ) : (
          <SortableList
            items={definition.sections}
            getKey={(section) => section.nodeId}
            getLabel={(section) => sectionName(section)}
            onMove={(from, to) =>
              update((current) =>
                reorderSections(
                  current,
                  arrayMove(current.sections, from, to).map((section) => section.nodeId),
                ),
              )
            }
            compact
            align="center"
            className="flex flex-col gap-1"
            itemClassName="items-center gap-1 rounded-md bg-transparent"
            renderItem={(section) => (
              <div className="flex items-center gap-0.5">
                <div className="min-w-0 flex-1">
                  <OutlineRow
                    icon={getSectionMeta(section.kind).icon}
                    name={sectionName(section)}
                    detail={detailOf(section)}
                    hidden={!section.visible}
                    selected={selected === section.nodeId}
                    missing={section.visible ? countMissing(issues, section.nodeId) : 0}
                    onSelect={() => onSelect(section.nodeId)}
                  />
                </div>
                <VisibilityToggle
                  name={sectionName(section)}
                  visible={section.visible}
                  onChange={(visible) =>
                    update((current) => setSectionVisible(current, section.nodeId, visible))
                  }
                />
              </div>
            )}
          />
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-center border-dashed bg-transparent"
          >
            <PlusIcon aria-hidden="true" />
            {t("add")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {missingBuiltIns.length === 0 && missingCustom.length === 0 ? (
            <p className="px-2 py-2 text-[0.8125rem] text-muted-foreground">{t("allAdded")}</p>
          ) : null}
          {missingBuiltIns.length > 0 ? (
            <DropdownMenuGroup>
              <DropdownMenuLabel>{t("builtIn")}</DropdownMenuLabel>
              {missingBuiltIns.map((kind) => {
                const meta = getSectionMeta(kind);
                const Icon = meta.icon;
                return (
                  <DropdownMenuItem
                    key={kind}
                    onSelect={() => add(createBuiltInSection(kind, master))}
                  >
                    <Icon aria-hidden="true" />
                    {meta.messageKey ? tCareer(`${meta.messageKey}.title`) : tSections("summary")}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          ) : null}
          {missingBuiltIns.length > 0 && missingCustom.length > 0 ? (
            <DropdownMenuSeparator />
          ) : null}
          {missingCustom.length > 0 ? (
            <DropdownMenuGroup>
              <DropdownMenuLabel>{t("custom")}</DropdownMenuLabel>
              {missingCustom.map((record) => {
                const Icon = getSectionMeta("custom").icon;
                return (
                  <DropdownMenuItem
                    key={record.id}
                    onSelect={() => add(createCustomSection(record.id))}
                  >
                    <Icon aria-hidden="true" />
                    {displayLocalizedText(record.title, cvLocale)?.text ??
                      tSections("customFallback")}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
