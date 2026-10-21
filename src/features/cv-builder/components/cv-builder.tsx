"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  ArrowLeftIcon,
  CopyIcon,
  DownloadIcon,
  EllipsisIcon,
  EyeIcon,
  PanelsTopLeftIcon,
  PrinterIcon,
  Redo2Icon,
  Trash2Icon,
  Undo2Icon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { SaveStatus } from "@/components/feedback/save-status";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CV_NAME_MAX } from "@/features/cv-documents/schemas";
import { useCvExport } from "@/features/cv-export/components/use-cv-export";
import { deleteCv, duplicateCv, restoreCv } from "@/features/cv-documents/server/actions";
import type { CvDocument } from "@/features/cv-documents/server/queries";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";
import type { CvDefinition } from "../definition";
import type { CvLabelSet } from "../labels";
import type { MasterData } from "../master-data";
import { isBlockingIssue, resolveCv } from "../resolve";
import { BuilderProvider } from "./builder-context";
import { CvPreview } from "./cv-preview";
import { HeaderEditor } from "./header-editor";
import { IssuesPanel } from "./issues-panel";
import { SectionEditor } from "./section-editor";
import { HEADER_TARGET, SectionOutline } from "./section-outline";
import { useCvAutosave, type CvDraft } from "./use-cv-autosave";
import { useHistory } from "./use-history";

const CVS_HREF = "/dashboard/cvs";

type CvBuilderProps = {
  document: CvDocument;
  master: MasterData;
  labels: CvLabelSet;
  photoUrl: string | null;
};

function isTextInput(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

function LocaleChoice({ value, onChange }: { value: Locale; onChange: (locale: Locale) => void }) {
  const t = useTranslations("cvBuilder.toolbar");
  const tLanguages = useTranslations("languages");
  return (
    <div
      role="radiogroup"
      aria-label={t("language")}
      className="inline-grid shrink-0 grid-cols-2 gap-0.5 rounded-md bg-ink-100 p-1"
    >
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          role="radio"
          aria-checked={value === locale}
          aria-label={tLanguages(locale)}
          title={t("languageHint")}
          onClick={() => onChange(locale)}
          className={cn(
            "flex h-7 min-w-9 items-center justify-center rounded-sm px-2 text-xs font-semibold tracking-[0.04em] transition-colors outline-none focus-visible:z-10 focus-visible:focus-ring pointer-coarse:h-10 pointer-coarse:min-w-11",
            value === locale
              ? "bg-ink-950 text-paper"
              : "text-muted-foreground hover:bg-ink-150 hover:text-foreground",
          )}
        >
          {locale.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function NameField({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  const t = useTranslations("cvBuilder.toolbar");
  // Local text so the field can be empty while typing; it follows outside changes (undo).
  const [text, setText] = useState(value);
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    setText(value);
  }
  return (
    <input
      aria-label={t("name")}
      value={text}
      maxLength={CV_NAME_MAX}
      onChange={(event) => {
        setText(event.target.value);
        if (event.target.value.trim()) onChange(event.target.value);
      }}
      onBlur={() => {
        if (!text.trim()) setText(value);
      }}
      title={t("renameHint")}
      className="h-10 w-full min-w-0 truncate rounded-md border border-transparent bg-transparent px-2 text-lg font-semibold tracking-[-0.025em] transition-colors outline-none hover:border-input focus-visible:border-ring focus-visible:bg-card focus-visible:ring-1 focus-visible:ring-ring pointer-coarse:h-11"
    />
  );
}

export function CvBuilder({ document, master, labels, photoUrl }: CvBuilderProps) {
  const t = useTranslations("cvBuilder");
  const router = useRouter();
  const headingId = useId();
  const history = useHistory<CvDraft>({
    name: document.name,
    locale: document.locale,
    definition: document.definition,
  });
  const draft = history.value;
  const autosave = useCvAutosave({ id: document.id, revision: document.revision, draft });

  const [selected, setSelected] = useState<string>(HEADER_TARGET);
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [pane, setPane] = useState<"outline" | "editor">("outline");
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { cv, issues } = useMemo(
    () => resolveCv(draft.definition, master, draft.locale, labels[draft.locale]),
    [draft.definition, draft.locale, master, labels],
  );

  const exporter = useCvExport();
  const blockingCount = issues.filter(isBlockingIssue).length;

  /** Export only what is saved, and only when every shown text exists in the CV language. */
  const canExport = () => {
    if (blockingCount === 0) return true;
    setIssuesOpen(true);
    toast.error(t("toolbar.exportBlocked", { count: blockingCount }));
    return false;
  };
  const saveBeforeExport = async () => {
    if (await autosave.flush()) return true;
    toast.error(t("toolbar.saveFirst"));
    return false;
  };
  const print = () => {
    if (canExport()) exporter.openPrint(document.id, saveBeforeExport);
  };
  const download = () => {
    if (!canExport()) return;
    void exporter.downloadPdf(document.id, draft.name, saveBeforeExport).then((result) => {
      if (!result.ok && result.error === "missing_translations") setIssuesOpen(true);
    });
  };

  const updateDefinition = useCallback(
    (change: (definition: CvDefinition) => CvDefinition) =>
      history.set((current) => {
        const definition = change(current.definition);
        return definition === current.definition ? current : { ...current, definition };
      }),
    [history],
  );

  const select = useCallback((target: string) => {
    setSelected(target);
    setPane("editor");
    setView("edit");
  }, []);

  const selectedSection =
    selected === HEADER_TARGET
      ? null
      : (draft.definition.sections.find((section) => section.nodeId === selected) ?? null);
  const activeTarget = selected !== HEADER_TARGET && !selectedSection ? HEADER_TARGET : selected;

  const { undo, redo } = history;
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

  const duplicate = async () => {
    if (!(await autosave.flush())) {
      toast.error(t("toolbar.saveFirst"));
      return;
    }
    const result = await duplicateCv(document.id, t("toolbar.copyName", { name: draft.name }));
    if (!result.ok) {
      toast.error(t("toolbar.actionFailed"));
      return;
    }
    toast.success(t("toolbar.duplicated"));
    router.push(`${CVS_HREF}/${result.data.id}`);
  };

  const remove = async () => {
    const result = await deleteCv(document.id);
    if (!result.ok) throw new Error(result.error);
    toast.success(t("toolbar.deleted", { name: draft.name }), {
      action: {
        label: t("toolbar.undo"),
        onClick: () => {
          void restoreCv(document.id).then((restored) => {
            if (restored.ok) router.push(`${CVS_HREF}/${document.id}`);
            else toast.error(t("toolbar.actionFailed"));
          });
        },
      },
    });
    router.push(CVS_HREF);
  };

  const context = {
    definition: draft.definition,
    master,
    cvLocale: draft.locale,
    cvLabels: labels[draft.locale],
    issues,
    update: updateDefinition,
    select,
    undo,
  };

  const editor = selectedSection ? (
    <SectionEditor
      key={selectedSection.nodeId}
      section={selectedSection}
      headingId={headingId}
      onRemoved={() => {
        setSelected(HEADER_TARGET);
        setPane("outline");
      }}
    />
  ) : (
    <div className="flex flex-col gap-6">
      <div className="space-y-2 border-b pb-5">
        <h2 id={headingId} className="text-xl font-semibold tracking-[-0.025em]">
          {t("outline.header")}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{t("workspace.headerHint")}</p>
      </div>
      <HeaderEditor />
    </div>
  );

  return (
    <BuilderProvider value={context}>
      <div className="flex flex-col bg-card lg:h-[calc(100dvh-var(--workspace-header-height))]">
        {/* Toolbar */}
        <div className="sticky top-[calc(var(--topbar-height)+env(safe-area-inset-top))] z-20 border-b bg-card lg:static">
          {/* Phones: name row, save status beneath the name, then the tools. Wider: one row. */}
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-1 px-3 py-3 [grid-template-areas:'back_name_more'_'back_status_more'_'tools_tools_tools'] sm:px-4 md:grid-cols-[auto_minmax(0,1fr)_auto_auto] md:gap-x-3 md:[grid-template-areas:'back_name_tools_more'_'back_status_tools_more']">
            <Button asChild variant="ghost" size="icon-sm" className="[grid-area:back]">
              <Link href={CVS_HREF} aria-label={t("toolbar.back")}>
                <ArrowLeftIcon aria-hidden="true" />
              </Link>
            </Button>
            <div className="min-w-0 [grid-area:name]">
              <NameField
                value={draft.name}
                onChange={(name) => history.set((current) => ({ ...current, name }))}
              />
            </div>
            <SaveStatus
              state={autosave.state}
              onRetry={autosave.conflict ? undefined : autosave.retry}
              className="min-w-0 px-2 text-xs [grid-area:status]"
            />
            <div className="flex flex-wrap items-center gap-2 pt-2 [grid-area:tools] md:pt-0">
              <LocaleChoice
                value={draft.locale}
                onChange={(locale) => history.set((current) => ({ ...current, locale }))}
              />
              <div className="flex items-center border-x px-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={history.undo}
                  disabled={!history.canUndo}
                  aria-label={t("toolbar.undo")}
                  title={t("toolbar.undoShortcut")}
                >
                  <Undo2Icon aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={history.redo}
                  disabled={!history.canRedo}
                  aria-label={t("toolbar.redo")}
                  title={t("toolbar.redoShortcut")}
                >
                  <Redo2Icon aria-hidden="true" />
                </Button>
              </div>
              <IssuesPanel open={issuesOpen} onOpenChange={setIssuesOpen} onShow={select} />
              <div className="hidden items-center gap-2 md:flex">
                <Button type="button" variant="outline" size="sm" onClick={print}>
                  <PrinterIcon aria-hidden="true" />
                  {t("toolbar.print")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={download}
                  disabled={exporter.downloading}
                  aria-label={exporter.downloading ? undefined : t("toolbar.downloadLabel")}
                >
                  {exporter.downloading ? <Spinner /> : <DownloadIcon aria-hidden="true" />}
                  {exporter.downloading ? t("toolbar.preparing") : t("toolbar.download")}
                </Button>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("toolbar.more")}
                  className="[grid-area:more]"
                >
                  <EllipsisIcon aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="md:hidden" onSelect={print}>
                  <PrinterIcon aria-hidden="true" />
                  {t("toolbar.print")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="md:hidden"
                  disabled={exporter.downloading}
                  onSelect={download}
                >
                  <DownloadIcon aria-hidden="true" />
                  {t("toolbar.downloadLabel")}
                </DropdownMenuItem>
                <DropdownMenuSeparator className="md:hidden" />
                <DropdownMenuItem onSelect={() => void duplicate()}>
                  <CopyIcon aria-hidden="true" />
                  {t("toolbar.duplicate")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
                  <Trash2Icon aria-hidden="true" />
                  {t("toolbar.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {autosave.conflict ? (
            <div
              role="alert"
              className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t bg-warning-soft px-4 py-2.5 text-sm"
            >
              <p className="min-w-0 flex-1">{t("conflict.message")}</p>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={autosave.loadLatest}>
                  {t("conflict.loadLatest")}
                </Button>
                <Button type="button" size="sm" onClick={() => void autosave.keepMine()}>
                  {t("conflict.keepMine")}
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

          {/* Edit / Preview switch below the three-pane breakpoint */}
          <div
            role="tablist"
            aria-label={t("views.label")}
            className="mx-4 mb-3 grid grid-cols-2 gap-1 rounded-md bg-ink-100 p-1 xl:hidden"
          >
            {(["edit", "preview"] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={view === option}
                tabIndex={view === option ? 0 : -1}
                onKeyDown={(event) => {
                  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                  event.preventDefault();
                  const next =
                    event.key === "Home"
                      ? "edit"
                      : event.key === "End"
                        ? "preview"
                        : option === "edit"
                          ? "preview"
                          : "edit";
                  setView(next);
                  const buttons =
                    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                      "[role=tab]",
                    );
                  buttons?.[next === "edit" ? 0 : 1]?.focus();
                }}
                onClick={() => setView(option)}
                className="flex h-10 items-center justify-center gap-2 rounded-sm text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:focus-ring aria-selected:bg-card aria-selected:text-foreground pointer-coarse:h-11"
              >
                {option === "edit" ? (
                  <PanelsTopLeftIcon aria-hidden="true" className="size-4" />
                ) : (
                  <EyeIcon aria-hidden="true" className="size-4" />
                )}
                {t(`views.${option}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Workspace */}
        <div
          className={cn(
            "grid min-h-0 flex-1",
            view === "edit" && "md:grid-cols-[15rem_minmax(0,1fr)]",
            "xl:grid-cols-[14rem_minmax(0,1fr)_minmax(20rem,38%)] 2xl:grid-cols-[16rem_minmax(0,1fr)_minmax(22rem,40%)]",
          )}
        >
          <nav
            aria-label={t("outline.label")}
            className={cn(
              "border-r-0 bg-ink-50 px-3 py-5 md:border-r lg:min-h-0 lg:overflow-y-auto",
              view === "preview" && "hidden xl:block",
              pane === "editor" && "max-md:hidden",
            )}
          >
            <SectionOutline selected={activeTarget} onSelect={select} />
          </nav>

          <section
            aria-labelledby={headingId}
            className={cn(
              "min-w-0 bg-card px-4 py-6 sm:px-6 lg:min-h-0 lg:overflow-y-auto 2xl:px-8",
              view === "preview" && "hidden xl:block",
              pane === "outline" && "max-md:hidden",
            )}
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mb-3 -ml-2 md:hidden"
              onClick={() => setPane("outline")}
            >
              <ArrowLeftIcon aria-hidden="true" />
              {t("outline.back")}
            </Button>
            <div className="mx-auto w-full max-w-2xl">{editor}</div>
          </section>

          <aside
            aria-label={t("preview.label")}
            className={cn(
              "min-w-0 bg-ink-150 px-4 py-5 sm:px-6 lg:min-h-0 lg:overflow-y-auto xl:border-l",
              view === "edit" && "hidden xl:block",
            )}
          >
            <CvPreview
              cv={cv}
              labels={labels[draft.locale]}
              photoUrl={photoUrl}
              selectedNodeId={selectedSection?.nodeId ?? null}
              onSelectSection={select}
              className="mx-auto max-w-[210mm]"
            />
          </aside>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("toolbar.deleteTitle", { name: draft.name })}
        description={t("toolbar.deleteDescription")}
        confirmLabel={t("toolbar.delete")}
        tone="destructive"
        onConfirm={remove}
      />
      {autosave.leaveDialog}
    </BuilderProvider>
  );
}
