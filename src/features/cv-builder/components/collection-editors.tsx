"use client";

import { useId } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { ExternalLinkIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { SortableList } from "@/components/forms/sortable-list";
import { Badge } from "@/components/ui/badge";
import { fieldControlClassName } from "@/components/ui/input";
import { Link } from "@/lib/i18n/navigation";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { cn } from "@/lib/utils";
import type { ItemRef, SectionOf } from "../definition";
import { materializeOptOut, setOverride, updateSection, withOptional } from "../operations";
import { mergeOptOut } from "../resolve";
import { countMissing, useBuilder, useCvText, type DisplayText } from "./builder-context";
import { EditorGroup, OverrideField, SourceText, ToggleChip, VisibilityToggle } from "./controls";
import { getSectionMeta } from "./section-meta";

function SourceLink({ href }: { href: string }) {
  const t = useTranslations("cvBuilder");
  return (
    <Link
      href={href}
      className="inline-flex w-fit items-center gap-1.5 text-[0.8125rem] font-medium underline decoration-ink-300 underline-offset-4 hover:decoration-foreground"
    >
      <ExternalLinkIcon aria-hidden="true" className="size-3.5" />
      {t("records.editSource")}
    </Link>
  );
}

function EmptySource({ href, message }: { href: string; message: string }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-md border border-dashed px-4 py-5">
      <p className="text-[0.8125rem] text-muted-foreground">{message}</p>
      <SourceLink href={href} />
    </div>
  );
}

/** Opt-out list rows: everything in the record shows unless hidden here; order is per CV. */
function OptOutList<T extends { id: string; archived: boolean }, R extends ItemRef>({
  refs,
  master,
  createRef,
  onChange,
  label,
  renderLabel,
}: {
  refs: readonly R[];
  master: readonly T[];
  createRef: (refId: string) => R;
  onChange: (refs: R[]) => void;
  label: (item: T, index: number) => string;
  renderLabel: (item: T) => React.ReactNode;
}) {
  const merged = mergeOptOut(refs, master).map(({ item, ref }) => ({
    item,
    ref: ref ?? createRef(item.id),
  }));
  const all = merged.map(({ ref }) => ref);

  return (
    <SortableList
      items={merged}
      getKey={({ item }) => item.id}
      getLabel={({ item }, index) => label(item, index)}
      onMove={(from, to) => onChange(arrayMove(all, from, to))}
      compact
      align="center"
      className="flex flex-col divide-y rounded-md border"
      itemClassName="px-2 py-1.5"
      renderItem={({ item, ref }, index) => (
        <div className="flex items-center gap-1">
          <div
            className={cn(
              "min-w-0 flex-1 py-1 text-sm",
              !ref.visible && "text-subtle-foreground line-through decoration-ink-300",
            )}
          >
            {renderLabel(item)}
          </div>
          <VisibilityToggle
            name={label(item, index)}
            visible={ref.visible}
            onChange={(visible) =>
              onChange(
                all.map((entry) => (entry.refId === item.id ? { ...entry, visible } : entry)),
              )
            }
          />
        </div>
      )}
    />
  );
}

const itemRef = (refId: string): ItemRef => ({ refId, visible: true });

export function SkillsEditor({ section }: { section: SectionOf<"technical_skills"> }) {
  const t = useTranslations("cvBuilder.skills");
  const { master, update, issues } = useBuilder();
  const cvText = useCvText();
  const splitId = useId();
  const setSection = (
    change: (current: SectionOf<"technical_skills">) => SectionOf<"technical_skills">,
  ) =>
    update((definition) => updateSection(definition, section.nodeId, "technical_skills", change));
  const href = getSectionMeta("technical_skills").href;

  if (master.skillGroups.every((group) => group.archived)) {
    return <EmptySource href={href} message={t("empty")} />;
  }

  const groups = mergeOptOut(section.groups, master.skillGroups).map(({ item, ref }) => ({
    group: item,
    ref: ref ?? { refId: item.id, visible: true, skills: [] },
  }));
  const allGroups = groups.map(({ ref }) => ref);
  const visibleGroups = groups.filter(({ ref }) => ref.visible);
  const splitValue = visibleGroups
    .slice(1)
    .some(({ group }) => group.id === section.rightStartsWith)
    ? (section.rightStartsWith ?? "")
    : "";
  const setGroups = (refs: typeof allGroups) =>
    setSection((current) => ({ ...current, groups: refs }));

  return (
    <div className="flex flex-col gap-6">
      <EditorGroup title={t("layout")}>
        <div role="radiogroup" aria-label={t("layout")} className="flex gap-1.5">
          {([2, 1] as const).map((columns) => (
            <button
              key={columns}
              type="button"
              role="radio"
              aria-checked={section.columns === columns}
              onClick={() => setSection((current) => ({ ...current, columns }))}
              className={cn(
                "h-8 rounded-sm border px-3 text-[0.8125rem] font-medium outline-none focus-visible:focus-ring pointer-coarse:h-11",
                section.columns === columns
                  ? "border-ink-950 bg-ink-950 text-paper"
                  : "border-border-strong bg-card hover:border-ink-600",
              )}
            >
              {t("columns", { count: columns })}
            </button>
          ))}
        </div>
        {section.columns === 2 && visibleGroups.length > 1 ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={splitId} className="text-[0.8125rem] font-medium">
              {t("split")}
            </label>
            <select
              id={splitId}
              value={splitValue}
              onChange={(event) =>
                setSection((current) =>
                  withOptional(current, "rightStartsWith", event.target.value || undefined),
                )
              }
              className={cn(fieldControlClassName, "h-9 px-3 pointer-coarse:h-11")}
            >
              <option value="">{t("splitAuto")}</option>
              {visibleGroups.slice(1).map(({ group }) => (
                <option key={group.id} value={group.id}>
                  {cvText(group.title)?.text ?? t("untitledGroup")}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </EditorGroup>

      <EditorGroup title={t("groups")} description={t("groupsHint")}>
        <SortableList
          items={groups}
          getKey={({ group }) => group.id}
          getLabel={({ group }) => cvText(group.title)?.text ?? t("untitledGroup")}
          onMove={(from, to) => setGroups(arrayMove(allGroups, from, to))}
          className="flex flex-col gap-2"
          itemClassName="rounded-md border px-2 py-2"
          renderItem={({ group, ref }) => {
            const name = cvText(group.title)?.text ?? t("untitledGroup");
            const missing = countMissing(issues, section.nodeId, group.id);
            return (
              <div className="flex items-start gap-1">
                <p
                  className={cn(
                    "min-w-0 flex-1 px-1 py-1 text-sm font-medium",
                    !ref.visible && "text-subtle-foreground line-through decoration-ink-300",
                  )}
                >
                  <SourceText value={cvText(group.title)} fallback={t("untitledGroup")} />
                  {missing > 0 ? (
                    <Badge variant="signal" className="ml-1.5 align-[0.1em]">
                      {t("missingCount", { count: missing })}
                    </Badge>
                  ) : null}
                </p>
                <VisibilityToggle
                  name={name}
                  visible={ref.visible}
                  onChange={(visible) =>
                    setGroups(
                      allGroups.map((entry) =>
                        entry.refId === group.id ? { ...entry, visible } : entry,
                      ),
                    )
                  }
                />
              </div>
            );
          }}
          renderExpanded={({ group, ref }) => {
            const skills = mergeOptOut(ref.skills, group.skills);
            if (skills.length === 0) return null;
            const name = cvText(group.title)?.text ?? t("untitledGroup");
            const setSkills = (skillRefs: ItemRef[]) =>
              setGroups(
                allGroups.map((entry) =>
                  entry.refId === group.id ? { ...entry, skills: skillRefs } : entry,
                ),
              );
            return (
              <ul
                aria-label={t("skillsOf", { name })}
                className={cn("flex flex-wrap gap-1.5 px-1 pb-1", !ref.visible && "opacity-55")}
              >
                {skills.map(({ item: skill }) => {
                  const text = cvText(skill.label);
                  const visible =
                    ref.skills.find((entry) => entry.refId === skill.id)?.visible ?? true;
                  return (
                    <li key={skill.id} className="max-w-full">
                      <ToggleChip
                        pressed={visible}
                        missing={text?.missing}
                        onChange={(pressed) =>
                          setSkills(
                            materializeOptOut(ref.skills, group.skills, itemRef).map((entry) =>
                              entry.refId === skill.id ? { ...entry, visible: pressed } : entry,
                            ),
                          )
                        }
                      >
                        {text?.text ?? "—"}
                      </ToggleChip>
                    </li>
                  );
                })}
              </ul>
            );
          }}
        />
      </EditorGroup>
      <SourceLink href={href} />
    </div>
  );
}

export function SimpleListEditor({ section }: { section: SectionOf<"soft_skills" | "languages"> }) {
  const t = useTranslations("cvBuilder.lists");
  const { master, update } = useBuilder();
  const cvText = useCvText();
  const href = getSectionMeta(section.kind).href;
  const setItems = (items: ItemRef[]) =>
    update((definition) =>
      section.kind === "soft_skills"
        ? updateSection(definition, section.nodeId, "soft_skills", (current) => ({
            ...current,
            items,
          }))
        : updateSection(definition, section.nodeId, "languages", (current) => ({
            ...current,
            items,
          })),
    );

  const rows: { id: string; archived: boolean; text: DisplayText; detail: DisplayText }[] =
    section.kind === "soft_skills"
      ? master.softSkills.map((item) => ({
          id: item.id,
          archived: item.archived,
          text: cvText(item.label),
          detail: null,
        }))
      : master.languages.map((item) => ({
          id: item.id,
          archived: item.archived,
          text: cvText(item.name),
          detail: cvText(item.proficiency),
        }));

  if (rows.every((row) => row.archived)) {
    return (
      <EmptySource
        href={href}
        message={t(section.kind === "soft_skills" ? "emptySoftSkills" : "emptyLanguages")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <EditorGroup title={t("items")} description={t("itemsHint")}>
        <OptOutList
          refs={section.items}
          master={rows}
          createRef={itemRef}
          onChange={setItems}
          label={(row, index) => row.text?.text ?? t("untitled", { number: index + 1 })}
          renderLabel={(row) => (
            <>
              <SourceText value={row.text} fallback="—" />
              {row.detail ? (
                <span className="text-muted-foreground">
                  {" ("}
                  <SourceText value={row.detail} />)
                </span>
              ) : null}
            </>
          )}
        />
      </EditorGroup>
      <SourceLink href={href} />
    </div>
  );
}

export function CustomSectionEditor({ section }: { section: SectionOf<"custom"> }) {
  const t = useTranslations("cvBuilder.custom");
  const { master, update } = useBuilder();
  const cvText = useCvText();
  const record = master.customSections.find((candidate) => candidate.id === section.refId);
  const href = `${getSectionMeta("custom").href}/${section.refId}`;

  if (!record) {
    return <p className="text-[0.8125rem] text-muted-foreground">{t("deleted")}</p>;
  }

  const subsections = mergeOptOut(section.subsections, record.subsections).map(({ item, ref }) => ({
    subsection: item,
    ref: ref ?? { refId: item.id, visible: true, items: [] },
  }));
  const all = subsections.map(({ ref }) => ref);
  const setSubsections = (refs: typeof all) =>
    update((definition) =>
      updateSection(definition, section.nodeId, "custom", (current) => ({
        ...current,
        subsections: refs,
      })),
    );

  return (
    <div className="flex flex-col gap-6">
      {record.archived ? (
        <p className="text-xs text-muted-foreground">{t("archivedHint")}</p>
      ) : null}
      <EditorGroup title={t("subsections")} description={t("subsectionsHint")}>
        <SortableList
          items={subsections}
          getKey={({ subsection }) => subsection.id}
          getLabel={({ subsection }, index) =>
            cvText(subsection.title)?.text ?? t("untitledSubsection", { number: index + 1 })
          }
          onMove={(from, to) => setSubsections(arrayMove(all, from, to))}
          className="flex flex-col gap-2"
          itemClassName="rounded-md border px-2 py-2"
          renderItem={({ subsection, ref }, index) => {
            const name =
              cvText(subsection.title)?.text ?? t("untitledSubsection", { number: index + 1 });
            return (
              <div className="flex items-start gap-1">
                <p
                  className={cn(
                    "min-w-0 flex-1 px-1 py-1 text-sm font-medium",
                    !ref.visible && "text-subtle-foreground line-through decoration-ink-300",
                  )}
                >
                  <SourceText value={cvText(subsection.title)} fallback={name} />
                </p>
                <VisibilityToggle
                  name={name}
                  visible={ref.visible}
                  onChange={(visible) =>
                    setSubsections(
                      all.map((entry) =>
                        entry.refId === subsection.id ? { ...entry, visible } : entry,
                      ),
                    )
                  }
                />
              </div>
            );
          }}
          renderExpanded={({ subsection, ref }) =>
            subsection.items.some((item) => !item.archived) ? (
              <div className={cn(!ref.visible && "opacity-55")}>
                <OptOutList
                  refs={ref.items}
                  master={subsection.items}
                  createRef={itemRef}
                  onChange={(items) =>
                    setSubsections(
                      all.map((entry) =>
                        entry.refId === subsection.id ? { ...entry, items } : entry,
                      ),
                    )
                  }
                  label={(item, itemIndex) =>
                    cvText(item.text)?.text ?? t("untitledItem", { number: itemIndex + 1 })
                  }
                  renderLabel={(item) => (
                    <>
                      {item.kind === "key_value" && cvText(item.label) ? (
                        <span className="mr-1.5 font-medium">{cvText(item.label)?.text}</span>
                      ) : null}
                      <SourceText value={cvText(item.text)} fallback="—" />
                    </>
                  )}
                />
              </div>
            ) : null
          }
        />
      </EditorGroup>
      <SourceLink href={href} />
    </div>
  );
}

export function SummaryEditor({ section }: { section: SectionOf<"summary"> }) {
  const t = useTranslations("cvBuilder.summary");
  const { master, cvLocale, update } = useBuilder();
  const cvText = useCvText();
  const source = cvText(master.profile.summary);

  return (
    <div className="flex flex-col gap-4">
      <OverrideField
        label={t("text")}
        multiline
        maxLength={2000}
        value={(section.text && resolveLocalizedText(section.text, cvLocale)) ?? ""}
        source={source}
        onChange={(text) =>
          update((definition) =>
            updateSection(definition, section.nodeId, "summary", (current) =>
              withOptional(current, "text", setOverride(current.text, cvLocale, text)),
            ),
          )
        }
      />
      {!source ? <p className="text-[0.8125rem] text-muted-foreground">{t("empty")}</p> : null}
      <SourceLink href={getSectionMeta("summary").href} />
    </div>
  );
}
