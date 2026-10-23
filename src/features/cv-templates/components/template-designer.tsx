"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeftIcon,
  CircleAlertIcon,
  CopyIcon,
  EllipsisIcon,
  FilePlus2Icon,
  Redo2Icon,
  Trash2Icon,
  Undo2Icon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { SaveStatus } from "@/components/feedback/save-status";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LocaleChoice,
  NameField,
  isTextInput,
} from "@/features/cv-builder/components/builder-workspace";
import { useBuilderAutosave } from "@/features/cv-builder/components/use-builder-autosave";
import { useHistory } from "@/features/cv-builder/components/use-history";
import { createDefaultDefinition } from "@/features/cv-builder/defaults";
import type { CvDefinition } from "@/features/cv-builder/definition";
import type { CvLabelSet } from "@/features/cv-builder/labels";
import type { MasterData } from "@/features/cv-builder/master-data";
import { resolveCv } from "@/features/cv-builder/resolve";
import { DesignCanvas } from "@/features/cv-design/components/design-canvas";
import { ElementPalette } from "@/features/cv-design/components/element-palette";
import { ElementProperties } from "@/features/cv-design/components/element-properties";
import { IssueList, PagePanel } from "@/features/cv-design/components/page-panel";
import { useElementLabel } from "@/features/cv-design/components/use-element-label";
import type { Design, DesignElement, ElementContent } from "@/features/cv-design/design";
import { elementsWithIssues, layoutIssues, type Measured } from "@/features/cv-design/layout";
import {
  addElement,
  canDuplicate,
  createElement,
  duplicateElement,
  placedKeys,
  removeElement,
} from "@/features/cv-design/operations";
import { sectionsByKey } from "@/features/cv-renderer/canvas-v1/canvas-cv";
import type { Locale } from "@/lib/i18n/config";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { TEMPLATES_HREF, newCvFromTemplateHref, templateHref } from "../routes";
import {
  deleteTemplate,
  duplicateTemplate,
  getTemplateRevision,
  restoreTemplate,
  saveTemplateDesign,
} from "../server/actions";
import type { CvTemplate } from "../server/queries";

/** What the designer edits and autosaves; the composition rides along unchanged. */
type TemplateDraft = { name: string; locale: Locale; definition: CvDefinition; design: Design };

type TemplateDesignerProps = {
  template: CvTemplate;
  master: MasterData;
  labels: CvLabelSet;
  photoUrl: string | null;
};

/**
 * The free-form designer: elements on A4 pages, previewed with the owner's
 * current career data. Changes save automatically and apply to CVs made from
 * the template afterwards, never to existing ones.
 */
export function TemplateDesigner({ template, master, labels, photoUrl }: TemplateDesignerProps) {
  const t = useTranslations("designer");
  const tBuilder = useTranslations("cvBuilder");
  const router = useRouter();
  const history = useHistory<TemplateDraft>({
    name: template.name,
    locale: template.locale,
    definition: template.definition,
    design: template.design,
  });
  const draft = history.value;
  const { design, locale } = draft;
  const autosave = useBuilderAutosave({
    id: template.id,
    revision: template.revision,
    draft,
    save: saveTemplateDesign,
    getRevision: getTemplateRevision,
  });

  // The preview shows what a new CV made from this design holds: all career data.
  const preview = useMemo(() => createDefaultDefinition(master), [master]);
  const cv = useMemo(
    () => resolveCv(preview, master, locale, labels[locale]).cv,
    [preview, master, locale, labels],
  );
  const sections = useMemo(() => sectionsByKey(preview, cv), [preview, cv]);

  const labelOf = useElementLabel(master, locale);
  const nameOf = useCallback((element: DesignElement) => labelOf(element.content), [labelOf]);
  const placeholder = useCallback(
    (element: DesignElement) => t("canvas.empty", { name: labelOf(element.content) }),
    [t, labelOf],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [measured, setMeasured] = useState<Measured>({});
  const [announcement, setAnnouncement] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const selected = design.elements.find((element) => element.id === selectedId) ?? null;
  const issues = useMemo(() => layoutIssues(design, measured), [design, measured]);
  const flagged = useMemo(() => elementsWithIssues(issues), [issues]);
  const placed = useMemo(() => placedKeys(design), [design]);

  const { set, undo, redo, canUndo, canRedo } = history;
  const change = useCallback(
    (update: (current: Design) => Design) =>
      set((current) => {
        const next = update(current.design);
        return next === current.design ? current : { ...current, design: next };
      }),
    [set],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || isTextInput(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  const add = (content: ElementContent) => {
    const element = createElement(design, content);
    change((current) => addElement(current, element));
    setSelectedId(element.id);
    setAnnouncement(t("canvas.added", { name: labelOf(content) }));
  };

  const remove = useCallback(
    (id: string) => {
      const element = design.elements.find((item) => item.id === id);
      change((current) => removeElement(current, id));
      setSelectedId(null);
      if (element) setAnnouncement(t("canvas.removed", { name: labelOf(element.content) }));
    },
    [change, design.elements, labelOf, t],
  );

  const duplicate = useCallback(
    (id: string) => {
      const copyId = crypto.randomUUID();
      change((current) => duplicateElement(current, id, () => copyId));
      setSelectedId(copyId);
    },
    [change],
  );

  const duplicateTemplateAndOpen = async () => {
    if (!(await autosave.flush())) {
      toast.error(tBuilder("toolbar.saveFirst"));
      return;
    }
    const result = await duplicateTemplate(template.id, t("copyName", { name: draft.name }));
    if (!result.ok) {
      toast.error(t("actionFailed"));
      return;
    }
    toast.success(t("duplicated"));
    router.push(templateHref(result.data.id));
  };

  const deleteAndLeave = async () => {
    const result = await deleteTemplate(template.id);
    if (!result.ok) throw new Error(result.error);
    toast.success(t("deleted", { name: draft.name }), {
      action: {
        label: t("undoDelete"),
        onClick: () => {
          void restoreTemplate(template.id).then((restored) => {
            if (restored.ok) router.push(templateHref(template.id));
            else toast.error(t("actionFailed"));
          });
        },
      },
    });
    router.push(TEMPLATES_HREF);
  };

  return (
    <div className="flex flex-col bg-card lg:h-[calc(100dvh-var(--workspace-header-height))]">
      <div className="border-b bg-card">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2 px-3 py-3 sm:px-4">
          <Button asChild variant="ghost" size="icon-sm">
            <Link href={TEMPLATES_HREF} aria-label={t("back")}>
              <ArrowLeftIcon aria-hidden="true" />
            </Link>
          </Button>
          <div className="min-w-40 flex-1 basis-48">
            <NameField
              value={draft.name}
              label={t("name")}
              hint={t("renameHint")}
              onChange={(name) => set((current) => ({ ...current, name }))}
            />
          </div>
          <SaveStatus
            state={autosave.state}
            onRetry={autosave.conflict ? undefined : autosave.retry}
            className="px-2 text-xs"
          />
          <div className="flex flex-wrap items-center gap-2">
            <LocaleChoice
              value={locale}
              onChange={(next) => set((current) => ({ ...current, locale: next }))}
            />
            <div className="flex items-center border-x px-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={undo}
                disabled={!canUndo}
                aria-label={tBuilder("toolbar.undo")}
                title={tBuilder("toolbar.undoShortcut")}
              >
                <Undo2Icon aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={redo}
                disabled={!canRedo}
                aria-label={tBuilder("toolbar.redo")}
                title={tBuilder("toolbar.redoShortcut")}
              >
                <Redo2Icon aria-hidden="true" />
              </Button>
            </div>
            {issues.length > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive-soft px-2.5 py-1 text-xs font-medium text-destructive">
                <CircleAlertIcon aria-hidden="true" className="size-3.5" />
                {t("issues.count", { count: issues.length })}
              </span>
            ) : null}
            {/* A link: pending edits are saved before leaving. */}
            <Button asChild size="sm">
              <Link href={newCvFromTemplateHref(template.id)}>
                <FilePlus2Icon aria-hidden="true" />
                {t("use")}
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon-sm" aria-label={t("more")}>
                  <EllipsisIcon aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => void duplicateTemplateAndOpen()}>
                  <CopyIcon aria-hidden="true" />
                  {t("duplicate")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
                  <Trash2Icon aria-hidden="true" />
                  {t("delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {autosave.conflict ? (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t bg-warning-soft px-4 py-2.5 text-sm"
          >
            <p className="min-w-0 flex-1">{t("conflict")}</p>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={autosave.loadLatest}>
                {tBuilder("conflict.loadLatest")}
              </Button>
              <Button type="button" size="sm" onClick={() => void autosave.keepMine()}>
                {tBuilder("conflict.keepMine")}
              </Button>
            </div>
          </div>
        ) : autosave.state === "failed" && autosave.error ? (
          <p
            role="alert"
            className="border-t bg-destructive-soft px-4 py-2 text-sm text-destructive"
          >
            {t(`saveErrors.${autosave.error}`)}
          </p>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="order-2 border-t lg:order-1 lg:w-60 lg:shrink-0 lg:overflow-y-auto lg:border-t-0 lg:border-r">
          <ElementPalette master={master} placed={placed} label={labelOf} onAdd={add} />
        </div>
        <div className="order-1 flex min-h-[70vh] min-w-0 flex-1 flex-col lg:order-2 lg:min-h-0">
          <DesignCanvas
            design={design}
            definition={preview}
            sections={sections}
            cv={cv}
            labels={labels[locale]}
            photoUrl={photoUrl}
            measured={measured}
            flagged={flagged}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onChange={change}
            onRemove={remove}
            onDuplicate={duplicate}
            onMeasure={setMeasured}
            announce={setAnnouncement}
            label={nameOf}
            placeholder={placeholder}
          />
        </div>
        <aside
          aria-label={t("properties.title")}
          className="order-3 border-t lg:w-80 lg:shrink-0 lg:overflow-y-auto lg:border-t-0 lg:border-l"
        >
          {selected ? (
            <ElementProperties
              key={selected.id}
              element={selected}
              pages={design.pages}
              name={nameOf(selected)}
              onChange={change}
              onRemove={() => remove(selected.id)}
              onDuplicate={canDuplicate(selected) ? () => duplicate(selected.id) : null}
              onDeselect={() => setSelectedId(null)}
            />
          ) : (
            <PagePanel design={design} nameOf={nameOf} onChange={change} onSelect={setSelectedId} />
          )}
          <div className="border-t">
            <IssueList
              issues={issues}
              nameOf={(id) => {
                const element = design.elements.find((item) => item.id === id);
                return element ? nameOf(element) : "";
              }}
              onSelect={setSelectedId}
            />
          </div>
        </aside>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {autosave.leaveDialog}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("deleteTitle", { name: draft.name })}
        description={t("deleteDescription")}
        confirmLabel={t("delete")}
        tone="destructive"
        onConfirm={deleteAndLeave}
      />
    </div>
  );
}
