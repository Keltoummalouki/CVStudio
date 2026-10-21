"use client";

import { useState } from "react";
import {
  ArrowUpRightIcon,
  CopyIcon,
  EllipsisIcon,
  FilePlus2Icon,
  LayersIcon,
  PencilLineIcon,
  Trash2Icon,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { newCvFromTemplateHref, templateHref } from "../routes";
import { deleteTemplate, duplicateTemplate, restoreTemplate } from "../server/actions";
import type { TemplateListItem } from "../server/queries";

function StatusBadge({ template }: { template: TemplateListItem }) {
  const t = useTranslations("templates.status");
  if (template.missingTranslations === null) {
    return <Badge variant="destructive">{t("unreadable")}</Badge>;
  }
  if (template.missingTranslations > 0) {
    return (
      <Badge variant="signal">{t("toTranslate", { count: template.missingTranslations })}</Badge>
    );
  }
  if (template.warnings > 0) {
    return <Badge variant="warning">{t("warnings", { count: template.warnings })}</Badge>;
  }
  return <Badge variant="success">{t("ready")}</Badge>;
}

export function TemplateList({ templates }: { templates: readonly TemplateListItem[] }) {
  const t = useTranslations("templates");
  const format = useFormatter();
  const router = useRouter();
  const [deleting, setDeleting] = useState<TemplateListItem | null>(null);

  const duplicate = async (template: TemplateListItem) => {
    const result = await duplicateTemplate(template.id, t("copyName", { name: template.name }));
    if (result.ok) toast.success(t("duplicated"));
    else toast.error(t("actionFailed"));
  };

  const remove = async () => {
    if (!deleting) return;
    const template = deleting;
    const result = await deleteTemplate(template.id);
    if (!result.ok) throw new Error(result.error);
    toast.success(t("deleted", { name: template.name }), {
      action: {
        label: t("undo"),
        onClick: () => {
          void restoreTemplate(template.id).then((restored) => {
            if (!restored.ok) toast.error(t("actionFailed"));
          });
        },
      },
    });
  };

  return (
    <>
      <ul className="divide-y">
        {templates.map((template) => (
          <li
            key={template.id}
            className="group/template flex items-center gap-2 pr-3 transition-colors hover:bg-ink-50 sm:pr-5"
          >
            <Link
              href={templateHref(template.id)}
              className="flex min-w-0 flex-1 items-center gap-4 px-4 py-5 focus-visible:-outline-offset-2 sm:gap-5 sm:px-6 sm:py-6"
            >
              <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-ink-100 transition-colors group-hover/template:bg-ink-150 sm:size-16">
                <LayersIcon aria-hidden="true" className="size-6 text-ink-700" />
              </span>
              <span className="min-w-0 flex-1 space-y-2">
                <span className="flex items-center gap-2">
                  <span className="truncate text-base font-semibold tracking-[-0.015em]">
                    {template.name}
                  </span>
                  <ArrowUpRightIcon
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground transition-colors group-hover/template:text-signal"
                  />
                </span>
                {template.description ? (
                  <span className="line-clamp-2 text-[0.8125rem] leading-relaxed text-muted-foreground">
                    {template.description}
                  </span>
                ) : null}
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <Badge variant="outline" className="font-semibold tracking-[0.04em]">
                    {template.locale.toUpperCase()}
                  </Badge>
                  <StatusBadge template={template} />
                </span>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <time dateTime={template.updatedAt}>
                    {t("updated", {
                      date: format.dateTime(new Date(template.updatedAt), { dateStyle: "medium" }),
                    })}
                  </time>
                  <span>{t("usedBy", { count: template.cvCount })}</span>
                </span>
              </span>
            </Link>
            <Button asChild variant="outline" size="sm" className="max-sm:hidden">
              <Link href={newCvFromTemplateHref(template.id)}>
                <FilePlus2Icon aria-hidden="true" />
                {t("use")}
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("moreActions", { name: template.name })}
                >
                  <EllipsisIcon aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => router.push(newCvFromTemplateHref(template.id))}>
                  <FilePlus2Icon aria-hidden="true" />
                  {t("use")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => router.push(templateHref(template.id))}>
                  <PencilLineIcon aria-hidden="true" />
                  {t("edit")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void duplicate(template)}>
                  <CopyIcon aria-hidden="true" />
                  {t("duplicate")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(template)}>
                  <Trash2Icon aria-hidden="true" />
                  {t("delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={t("deleteTitle", { name: deleting?.name ?? "" })}
        description={t("deleteDescription", { count: deleting?.cvCount ?? 0 })}
        confirmLabel={t("delete")}
        tone="destructive"
        onConfirm={remove}
      />
    </>
  );
}
