"use client";

import { useState } from "react";
import { CopyIcon, FilePlus2Icon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { TextareaField } from "@/components/forms/textarea-field";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import {
  BuilderWorkspace,
  useBuilderDocument,
} from "@/features/cv-builder/components/builder-workspace";
import type { CvLabelSet } from "@/features/cv-builder/labels";
import type { MasterData } from "@/features/cv-builder/master-data";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { TEMPLATES_HREF, newCvFromTemplateHref, templateHref } from "../routes";
import { TEMPLATE_DESCRIPTION_MAX } from "../schemas";
import {
  deleteTemplate,
  duplicateTemplate,
  getTemplateRevision,
  restoreTemplate,
  saveTemplate,
} from "../server/actions";
import type { CvTemplate } from "../server/queries";

type TemplateBuilderProps = {
  template: CvTemplate;
  master: MasterData;
  labels: CvLabelSet;
  photoUrl: string | null;
};

/**
 * Edits a saved template with the CV builder, previewed with current career
 * data. Changes apply to CVs created from it afterwards, never to existing ones.
 */
export function TemplateBuilder({ template, master, labels, photoUrl }: TemplateBuilderProps) {
  const t = useTranslations("templates.editor");
  const tBuilder = useTranslations("cvBuilder");
  const router = useRouter();
  const builder = useBuilderDocument({
    id: template.id,
    revision: template.revision,
    initial: {
      name: template.name,
      description: template.description,
      locale: template.locale,
      definition: template.definition,
    },
    master,
    labels,
    save: saveTemplate,
    getRevision: getTemplateRevision,
  });
  const { draft, autosave, history } = builder;

  const [issuesOpen, setIssuesOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const duplicate = async () => {
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

  const remove = async () => {
    const result = await deleteTemplate(template.id);
    if (!result.ok) throw new Error(result.error);
    toast.success(t("deleted", { name: draft.name }), {
      action: {
        label: t("undo"),
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
    <>
      <BuilderWorkspace
        builder={builder}
        master={master}
        labels={labels}
        photoUrl={photoUrl}
        purpose="template"
        backHref={TEMPLATES_HREF}
        texts={{
          back: t("back"),
          name: t("name"),
          renameHint: t("renameHint"),
          conflict: t("conflict"),
          saveError: autosave.error ? t(`saveErrors.${autosave.error}`) : null,
        }}
        issuesOpen={issuesOpen}
        onIssuesOpenChange={setIssuesOpen}
        actions={
          // A link: the builder saves pending edits before leaving.
          <Button asChild size="sm">
            <Link href={newCvFromTemplateHref(template.id)}>
              <FilePlus2Icon aria-hidden="true" />
              {t("use")}
            </Link>
          </Button>
        }
        menu={
          <>
            <DropdownMenuItem asChild className="md:hidden">
              <Link href={newCvFromTemplateHref(template.id)}>
                <FilePlus2Icon aria-hidden="true" />
                {t("use")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="md:hidden" />
            <DropdownMenuItem onSelect={() => void duplicate()}>
              <CopyIcon aria-hidden="true" />
              {t("duplicate")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
              <Trash2Icon aria-hidden="true" />
              {t("delete")}
            </DropdownMenuItem>
          </>
        }
        headerIntro={
          <div className="space-y-4 rounded-lg border border-border-strong p-4 sm:p-5">
            <p className="text-sm leading-relaxed text-muted-foreground">{t("intro")}</p>
            <TextareaField
              label={t("descriptionLabel")}
              description={t("descriptionHint")}
              optional
              rows={2}
              maxLength={TEMPLATE_DESCRIPTION_MAX}
              value={draft.description}
              onChange={(event) => {
                const description = event.target.value;
                history.set((current) => ({ ...current, description }));
              }}
            />
          </div>
        }
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("deleteTitle", { name: draft.name })}
        description={t("deleteDescription")}
        confirmLabel={t("delete")}
        tone="destructive"
        onConfirm={remove}
      />
    </>
  );
}
