"use client";

import { useState } from "react";
import { CopyIcon, DownloadIcon, LayersIcon, PrinterIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useCvExport } from "@/features/cv-export/components/use-cv-export";
import {
  deleteCv,
  duplicateCv,
  getCvRevision,
  restoreCv,
  saveCv,
} from "@/features/cv-documents/server/actions";
import type { CvDocument } from "@/features/cv-documents/server/queries";
import { SaveAsTemplateDialog } from "@/features/cv-templates/components/save-as-template-dialog";
import { useRouter } from "@/lib/i18n/navigation";
import type { CvLabelSet } from "../labels";
import type { MasterData } from "../master-data";
import { isBlockingIssue } from "../resolve";
import { BuilderWorkspace, useBuilderDocument } from "./builder-workspace";

const CVS_HREF = "/dashboard/cvs";

type CvBuilderProps = {
  document: CvDocument;
  master: MasterData;
  labels: CvLabelSet;
  photoUrl: string | null;
};

export function CvBuilder({ document, master, labels, photoUrl }: CvBuilderProps) {
  const t = useTranslations("cvBuilder");
  const router = useRouter();
  const builder = useBuilderDocument({
    id: document.id,
    revision: document.revision,
    initial: { name: document.name, locale: document.locale, definition: document.definition },
    master,
    labels,
    save: saveCv,
    getRevision: getCvRevision,
  });
  const { draft, autosave, issues } = builder;

  const [issuesOpen, setIssuesOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);

  const exporter = useCvExport();
  const blockingCount = issues.filter(isBlockingIssue).length;

  /** Export only what is saved, and only when every shown text exists in the CV language. */
  const canExport = () => {
    if (blockingCount === 0) return true;
    setIssuesOpen(true);
    toast.error(t("toolbar.exportBlocked", { count: blockingCount }));
    return false;
  };
  const saveFirst = async () => {
    if (await autosave.flush()) return true;
    toast.error(t("toolbar.saveFirst"));
    return false;
  };
  const print = () => {
    if (canExport()) exporter.openPrint(document.id, saveFirst);
  };
  const download = () => {
    if (!canExport()) return;
    void exporter.downloadPdf(document.id, draft.name, saveFirst).then((result) => {
      if (!result.ok && result.error === "missing_translations") setIssuesOpen(true);
    });
  };

  const duplicate = async () => {
    if (!(await saveFirst())) return;
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

  return (
    <>
      <BuilderWorkspace
        builder={builder}
        master={master}
        labels={labels}
        photoUrl={photoUrl}
        purpose="cv"
        backHref={CVS_HREF}
        texts={{
          back: t("toolbar.back"),
          name: t("toolbar.name"),
          renameHint: t("toolbar.renameHint"),
          conflict: t("conflict.message"),
          saveError: autosave.error ? t(`saveErrors.${autosave.error}`) : null,
        }}
        issuesOpen={issuesOpen}
        onIssuesOpenChange={setIssuesOpen}
        actions={
          <>
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
          </>
        }
        menu={
          <>
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
            <DropdownMenuItem onSelect={() => setTemplateOpen(true)}>
              <LayersIcon aria-hidden="true" />
              {t("toolbar.saveAsTemplate")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void duplicate()}>
              <CopyIcon aria-hidden="true" />
              {t("toolbar.duplicate")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
              <Trash2Icon aria-hidden="true" />
              {t("toolbar.delete")}
            </DropdownMenuItem>
          </>
        }
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("toolbar.deleteTitle", { name: draft.name })}
        description={t("toolbar.deleteDescription")}
        confirmLabel={t("toolbar.delete")}
        tone="destructive"
        onConfirm={remove}
      />
      <SaveAsTemplateDialog
        open={templateOpen}
        onOpenChange={setTemplateOpen}
        cvId={document.id}
        cvName={draft.name}
        saveCvFirst={saveFirst}
      />
    </>
  );
}
