"use client";

import { useState } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import {
  ArchiveIcon,
  ChevronDownIcon,
  CircleAlertIcon,
  ExternalLinkIcon,
  PlusIcon,
  XIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { SortableList } from "@/components/forms/sortable-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMonthYear, formatPeriod, type Period } from "@/lib/dates/period";
import { Link } from "@/lib/i18n/navigation";
import { resolveLocalizedText, type LocalizedTextValue } from "@/lib/i18n/localized-text";
import { cn } from "@/lib/utils";
import {
  newCertificationItem,
  newEducationItem,
  newExperienceItem,
  newProjectItem,
  type RecordSectionKind,
} from "../defaults";
import type { ItemRef, SectionOf } from "../definition";
import type { MasterDetail } from "../master-data";
import { setOverride, updateItem, updateSection, withOptional } from "../operations";
import { countMissing, useBuilder, useCvText, type DisplayText } from "./builder-context";
import { EditorGroup, OverrideField, ToggleChip, VisibilityToggle } from "./controls";
import { DetailsEditor } from "./details-editor";
import { getRecordHref } from "./section-meta";

type MasterRecord = { id: string; archived: boolean };

type Summary = { title: DisplayText; subtitle: string | null; date: string | null };

type RecordListProps<I extends ItemRef, R extends MasterRecord> = {
  nodeId: string;
  kind: RecordSectionKind;
  items: readonly I[];
  records: readonly R[];
  setItems: (update: (items: I[]) => I[]) => void;
  newItem: (refId: string) => I;
  summarize: (record: R) => Summary;
  renderOptions: (item: I, record: R, patch: (update: (item: I) => I) => void) => React.ReactNode;
};

/**
 * Records are chosen one by one for each CV: the included ones in CV order
 * (each expandable for per-CV options), then everything else to add.
 */
function RecordList<I extends ItemRef, R extends MasterRecord>({
  nodeId,
  kind,
  items,
  records,
  setItems,
  newItem,
  summarize,
  renderOptions,
}: RecordListProps<I, R>) {
  const t = useTranslations("cvBuilder.records");
  const { issues } = useBuilder();
  const [expanded, setExpanded] = useState<string | null>(null);
  const byId = new Map(records.map((record) => [record.id, record]));
  const included = new Set(items.map((item) => item.refId));
  const available = records.filter((record) => !record.archived && !included.has(record.id));

  const nameOf = (item: I) => {
    const record = byId.get(item.refId);
    return (record && summarize(record).title?.text) || t("untitled");
  };

  return (
    <div className="flex flex-col gap-6">
      <EditorGroup
        title={t("included", { count: items.length })}
        description={items.length > 0 ? t("includedHint") : undefined}
      >
        {items.length === 0 ? (
          <p className="rounded-md border border-dashed px-4 py-5 text-center text-[0.8125rem] text-muted-foreground">
            {records.length === 0 ? t("noRecords") : t("noneIncluded")}
          </p>
        ) : (
          <SortableList
            items={items}
            getKey={(item) => item.refId}
            getLabel={(item) => nameOf(item)}
            onMove={(from, to) => setItems((current) => arrayMove(current, from, to))}
            className="flex flex-col gap-2"
            itemClassName="rounded-md border px-2 py-2"
            renderItem={(item) => {
              const record = byId.get(item.refId);
              const name = nameOf(item);
              const isOpen = expanded === item.refId;
              const missing = countMissing(issues, nodeId, item.refId);
              const summary = record ? summarize(record) : null;
              const patch = (update: (item: I) => I) =>
                setItems((current) => updateItem(current, item.refId, update));
              const panelId = `record-options-${item.refId}`;

              return (
                <div className="flex flex-col">
                  <div className="flex items-start gap-1">
                    <button
                      type="button"
                      aria-expanded={record ? isOpen : undefined}
                      aria-controls={record && isOpen ? panelId : undefined}
                      disabled={!record}
                      onClick={() => setExpanded(isOpen ? null : item.refId)}
                      className="group/record flex min-w-0 flex-1 items-start gap-2 rounded-sm px-1 py-0.5 text-left outline-none focus-visible:focus-ring disabled:cursor-default"
                    >
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "block truncate text-sm font-medium",
                            !item.visible &&
                              "text-subtle-foreground line-through decoration-ink-300",
                          )}
                        >
                          {record ? name : t("deleted")}
                        </span>
                        {summary && (summary.subtitle || summary.date) ? (
                          <span className="block truncate text-xs text-muted-foreground">
                            {[summary.subtitle, summary.date].filter(Boolean).join(" · ")}
                          </span>
                        ) : null}
                        {!record || record.archived || missing > 0 ? (
                          <span className="mt-1 flex flex-wrap gap-1">
                            {!record ? (
                              <Badge variant="warning">
                                <CircleAlertIcon aria-hidden="true" />
                                {t("deletedBadge")}
                              </Badge>
                            ) : null}
                            {record?.archived ? (
                              <Badge variant="warning">
                                <ArchiveIcon aria-hidden="true" />
                                {t("archivedBadge")}
                              </Badge>
                            ) : null}
                            {missing > 0 ? (
                              <Badge variant="signal">
                                {t("missingCount", { count: missing })}
                              </Badge>
                            ) : null}
                          </span>
                        ) : null}
                      </span>
                      {record ? (
                        <ChevronDownIcon
                          aria-hidden="true"
                          className={cn(
                            "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover/record:text-foreground",
                            isOpen && "rotate-180",
                          )}
                        />
                      ) : null}
                    </button>
                    {record ? (
                      <VisibilityToggle
                        name={name}
                        visible={item.visible}
                        onChange={(visible) => patch((current) => ({ ...current, visible }))}
                      />
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("remove", { name: record ? name : t("deleted") })}
                      title={t("removeShort")}
                      onClick={() =>
                        setItems((current) => current.filter((entry) => entry.refId !== item.refId))
                      }
                    >
                      <XIcon aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              );
            }}
            renderExpanded={(item) => {
              const record = byId.get(item.refId);
              if (!record || expanded !== item.refId) return null;
              const patch = (update: (item: I) => I) =>
                setItems((current) => updateItem(current, item.refId, update));
              return (
                <div
                  id={`record-options-${item.refId}`}
                  className="flex flex-col gap-5 border-t px-1 pt-4 pb-2"
                >
                  {record.archived ? (
                    <p className="text-xs text-muted-foreground">{t("archivedHint")}</p>
                  ) : null}
                  {renderOptions(item, record, patch)}
                  <Link
                    href={getRecordHref(kind, record.id)}
                    className="inline-flex w-fit items-center gap-1.5 text-[0.8125rem] font-medium underline decoration-ink-300 underline-offset-4 hover:decoration-foreground"
                  >
                    <ExternalLinkIcon aria-hidden="true" className="size-3.5" />
                    {t("editSource")}
                  </Link>
                </div>
              );
            }}
          />
        )}
      </EditorGroup>

      {available.length > 0 ? (
        <EditorGroup
          title={t("available", { count: available.length })}
          description={t("availableHint")}
          actions={
            available.length > 1 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setItems((current) => [
                    ...current,
                    ...available.map((record) => newItem(record.id)),
                  ])
                }
              >
                {t("addAll")}
              </Button>
            ) : null
          }
        >
          <ul className="flex flex-col divide-y rounded-md border">
            {available.map((record) => {
              const summary = summarize(record);
              const name = summary.title?.text || t("untitled");
              return (
                <li key={record.id} className="flex items-center gap-2 px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{name}</span>
                    {summary.subtitle || summary.date ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {[summary.subtitle, summary.date].filter(Boolean).join(" · ")}
                      </span>
                    ) : null}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={t("add", { name })}
                    onClick={() => setItems((current) => [...current, newItem(record.id)])}
                  >
                    <PlusIcon aria-hidden="true" />
                    {t("addShort")}
                  </Button>
                </li>
              );
            })}
          </ul>
        </EditorGroup>
      ) : null}
    </div>
  );
}

function Toggles({ children }: { children: React.ReactNode }) {
  const t = useTranslations("cvBuilder.records");
  return (
    <EditorGroup title={t("show")}>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </EditorGroup>
  );
}

function usePeriodLabel() {
  const t = useTranslations("cvBuilder");
  const { cvLocale } = useBuilder();
  return (period: Period) => formatPeriod(period, cvLocale, t("present")) || null;
}

/** Text of an override in the CV language (empty when there is none). */
function useOverrideValue() {
  const { cvLocale } = useBuilder();
  return (value: LocalizedTextValue | undefined) =>
    (value && resolveLocalizedText(value, cvLocale)) ?? "";
}

type DetailItem = ItemRef & { details: SectionOf<"experience">["items"][number]["details"] };

function Details<I extends DetailItem>({
  item,
  details,
  showTechnologies,
  patch,
}: {
  item: I;
  details: readonly MasterDetail[];
  showTechnologies: boolean;
  patch: (update: (item: I) => I) => void;
}) {
  return (
    <DetailsEditor
      refs={item.details}
      details={details}
      showTechnologies={showTechnologies}
      onChange={(refs) => patch((current) => ({ ...current, details: refs }))}
    />
  );
}

export function RecordSectionEditor({
  section,
}: {
  section: SectionOf<"experience" | "education" | "projects" | "certifications">;
}) {
  const t = useTranslations("cvBuilder.records");
  const { master, cvLocale, update } = useBuilder();
  const cvText = useCvText();
  const periodLabel = usePeriodLabel();
  const overrideValue = useOverrideValue();

  switch (section.kind) {
    case "experience":
      return (
        <RecordList
          nodeId={section.nodeId}
          kind={section.kind}
          items={section.items}
          records={master.experiences}
          newItem={newExperienceItem}
          setItems={(change) =>
            update((definition) =>
              updateSection(definition, section.nodeId, "experience", (current) => ({
                ...current,
                items: change(current.items),
              })),
            )
          }
          summarize={(record) => ({
            title: cvText(record.role),
            subtitle: record.organization || null,
            date: periodLabel(record.period),
          })}
          renderOptions={(item, record, patch) => (
            <>
              <Toggles>
                <ToggleChip
                  pressed={item.showDates}
                  onChange={(showDates) => patch((current) => ({ ...current, showDates }))}
                >
                  {t("fields.dates")}
                </ToggleChip>
                <ToggleChip
                  pressed={item.showLocation}
                  onChange={(showLocation) => patch((current) => ({ ...current, showLocation }))}
                >
                  {t("fields.location")}
                </ToggleChip>
                <ToggleChip
                  pressed={item.showTechnologies}
                  onChange={(showTechnologies) =>
                    patch((current) => ({ ...current, showTechnologies }))
                  }
                >
                  {t("fields.technologies")}
                </ToggleChip>
              </Toggles>
              <OverrideField
                label={t("overrides.role")}
                maxLength={160}
                value={overrideValue(item.role)}
                source={cvText(record.role)}
                onChange={(text) =>
                  patch((current) =>
                    withOptional(current, "role", setOverride(current.role, cvLocale, text)),
                  )
                }
              />
              <Details
                item={item}
                details={record.details}
                showTechnologies={item.showTechnologies}
                patch={patch}
              />
            </>
          )}
        />
      );

    case "education":
      return (
        <RecordList
          nodeId={section.nodeId}
          kind={section.kind}
          items={section.items}
          records={master.educations}
          newItem={newEducationItem}
          setItems={(change) =>
            update((definition) =>
              updateSection(definition, section.nodeId, "education", (current) => ({
                ...current,
                items: change(current.items),
              })),
            )
          }
          summarize={(record) => ({
            title: cvText(record.credential),
            subtitle: cvText(record.institution)?.text ?? null,
            date: periodLabel(record.period),
          })}
          renderOptions={(item, record, patch) => (
            <>
              <Toggles>
                <ToggleChip
                  pressed={item.showDates}
                  onChange={(showDates) => patch((current) => ({ ...current, showDates }))}
                >
                  {t("fields.dates")}
                </ToggleChip>
                <ToggleChip
                  pressed={item.showLocation}
                  onChange={(showLocation) => patch((current) => ({ ...current, showLocation }))}
                >
                  {t("fields.location")}
                </ToggleChip>
                <ToggleChip
                  pressed={item.showDescription}
                  onChange={(showDescription) =>
                    patch((current) => ({ ...current, showDescription }))
                  }
                >
                  {t("fields.description")}
                </ToggleChip>
              </Toggles>
              <OverrideField
                label={t("overrides.credential")}
                maxLength={200}
                value={overrideValue(item.credential)}
                source={cvText(record.credential)}
                onChange={(text) =>
                  patch((current) =>
                    withOptional(
                      current,
                      "credential",
                      setOverride(current.credential, cvLocale, text),
                    ),
                  )
                }
              />
              {item.showDescription ? (
                <OverrideField
                  label={t("overrides.description")}
                  multiline
                  maxLength={2000}
                  value={overrideValue(item.description)}
                  source={cvText(record.description)}
                  onChange={(text) =>
                    patch((current) =>
                      withOptional(
                        current,
                        "description",
                        setOverride(current.description, cvLocale, text),
                      ),
                    )
                  }
                />
              ) : null}
            </>
          )}
        />
      );

    case "projects":
      return (
        <RecordList
          nodeId={section.nodeId}
          kind={section.kind}
          items={section.items}
          records={master.projects}
          newItem={newProjectItem}
          setItems={(change) =>
            update((definition) =>
              updateSection(definition, section.nodeId, "projects", (current) => ({
                ...current,
                items: change(current.items),
              })),
            )
          }
          summarize={(record) => ({
            title: cvText(record.title),
            subtitle: null,
            date: periodLabel(record.period),
          })}
          renderOptions={(item, record, patch) => (
            <>
              <Toggles>
                <ToggleChip
                  pressed={item.showDates}
                  onChange={(showDates) => patch((current) => ({ ...current, showDates }))}
                >
                  {t("fields.dates")}
                </ToggleChip>
                <ToggleChip
                  pressed={item.showDescription}
                  onChange={(showDescription) =>
                    patch((current) => ({ ...current, showDescription }))
                  }
                >
                  {t("fields.description")}
                </ToggleChip>
                <ToggleChip
                  pressed={item.showTechnologies}
                  onChange={(showTechnologies) =>
                    patch((current) => ({ ...current, showTechnologies }))
                  }
                >
                  {t("fields.technologies")}
                </ToggleChip>
                {record.projectUrl || record.sourceUrl ? (
                  <ToggleChip
                    pressed={item.showLinks}
                    onChange={(showLinks) => patch((current) => ({ ...current, showLinks }))}
                  >
                    {t("fields.links")}
                  </ToggleChip>
                ) : null}
              </Toggles>
              <OverrideField
                label={t("overrides.title")}
                maxLength={200}
                value={overrideValue(item.title)}
                source={cvText(record.title)}
                onChange={(text) =>
                  patch((current) =>
                    withOptional(current, "title", setOverride(current.title, cvLocale, text)),
                  )
                }
              />
              {item.showDescription ? (
                <OverrideField
                  label={t("overrides.description")}
                  multiline
                  maxLength={2000}
                  value={overrideValue(item.description)}
                  source={cvText(record.description)}
                  onChange={(text) =>
                    patch((current) =>
                      withOptional(
                        current,
                        "description",
                        setOverride(current.description, cvLocale, text),
                      ),
                    )
                  }
                />
              ) : null}
              <Details
                item={item}
                details={record.details}
                showTechnologies={item.showTechnologies}
                patch={patch}
              />
            </>
          )}
        />
      );

    case "certifications":
      return (
        <RecordList
          nodeId={section.nodeId}
          kind={section.kind}
          items={section.items}
          records={master.certifications}
          newItem={newCertificationItem}
          setItems={(change) =>
            update((definition) =>
              updateSection(definition, section.nodeId, "certifications", (current) => ({
                ...current,
                items: change(current.items),
              })),
            )
          }
          summarize={(record) => ({
            title: cvText(record.title),
            subtitle: cvText(record.issuer)?.text ?? null,
            date:
              record.issuedYear === null
                ? null
                : formatMonthYear(record.issuedYear, record.issuedMonth, cvLocale),
          })}
          renderOptions={(item, record, patch) => (
            <>
              <Toggles>
                <ToggleChip
                  pressed={item.showIssuer}
                  onChange={(showIssuer) => patch((current) => ({ ...current, showIssuer }))}
                >
                  {t("fields.issuer")}
                </ToggleChip>
                <ToggleChip
                  pressed={item.showDate}
                  onChange={(showDate) => patch((current) => ({ ...current, showDate }))}
                >
                  {t("fields.dates")}
                </ToggleChip>
                {record.credentialUrl ? (
                  <ToggleChip
                    pressed={item.showLink}
                    onChange={(showLink) => patch((current) => ({ ...current, showLink }))}
                  >
                    {t("fields.links")}
                  </ToggleChip>
                ) : null}
              </Toggles>
              <OverrideField
                label={t("overrides.title")}
                maxLength={200}
                value={overrideValue(item.title)}
                source={cvText(record.title)}
                onChange={(text) =>
                  patch((current) =>
                    withOptional(current, "title", setOverride(current.title, cvLocale, text)),
                  )
                }
              />
            </>
          )}
        />
      );
  }
}
