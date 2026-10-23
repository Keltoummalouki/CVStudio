"use client";

import { useState } from "react";
import {
  ArrowUpRightIcon,
  CopyIcon,
  EllipsisIcon,
  FilePlus2Icon,
  PencilLineIcon,
  Trash2Icon,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { A4SheetIllustration } from "@/components/feedback/a4-sheet-illustration";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
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

/**
 * The grey stage a template's first page stands on, its top half showing like
 * a sheet in a tray. Without a picture, a schematic page stands in.
 */
export function TemplateCover({ children }: { children?: React.ReactNode }) {
  return (
    <div className="border-b bg-ink-100 px-8 pt-7">
      <div className="mx-auto h-52 max-w-60 overflow-hidden rounded-t-[3px] bg-paper shadow-[0_1px_2px_oklch(0.175_0.006_265/0.08),0_10px_28px_oklch(0.175_0.006_265/0.1)] ring-1 ring-ink-200 transition-transform duration-(--duration-base) ease-out group-hover/template:-translate-y-1 motion-reduce:transition-none sm:h-60">
        {children ?? <A4SheetIllustration className="w-full drop-shadow-none" />}
      </div>
    </div>
  );
}

type TemplateListProps = {
  templates: readonly TemplateListItem[];
  /** Each template's first page, rendered on the server, by template id. */
  thumbnails?: Readonly<Partial<Record<string, React.ReactNode>>>;
};

export function TemplateList({ templates, thumbnails = {} }: TemplateListProps) {
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
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {templates.map((template) => (
          <li
            key={template.id}
            className="group/template relative flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card transition-colors hover:border-ink-400"
          >
            <TemplateCover>{thumbnails[template.id]}</TemplateCover>
            <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
              {/* The whole card opens the editor; the actions below sit above this link. */}
              <Link
                href={templateHref(template.id)}
                className="block min-w-0 flex-1 space-y-2 outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:focus-ring"
              >
                <span className="flex items-start gap-2">
                  <span className="line-clamp-2 text-base font-semibold tracking-[-0.015em] wrap-anywhere">
                    {template.name}
                  </span>
                  <ArrowUpRightIcon
                    aria-hidden="true"
                    className="mt-1 size-4 shrink-0 text-muted-foreground transition-colors group-hover/template:text-signal"
                  />
                </span>
                {template.description ? (
                  <span className="line-clamp-2 block text-[0.8125rem] leading-relaxed text-muted-foreground">
                    {template.description}
                  </span>
                ) : null}
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <time dateTime={template.updatedAt}>
                    {t("updated", {
                      date: format.dateTime(new Date(template.updatedAt), { dateStyle: "medium" }),
                    })}
                  </time>
                  <span>{t("usedBy", { count: template.cvCount })}</span>
                </span>
              </Link>
              <div className="relative z-10 flex items-center justify-between gap-2">
                <Button asChild variant="outline" size="sm">
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
                    <DropdownMenuItem
                      onSelect={() => router.push(newCvFromTemplateHref(template.id))}
                    >
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
              </div>
            </div>
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
