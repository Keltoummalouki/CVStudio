"use client";

import { useState } from "react";
import { BriefcaseBusinessIcon, EllipsisIcon, PencilLineIcon, Trash2Icon } from "lucide-react";
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
import { Link } from "@/lib/i18n/navigation";
import { jobHref } from "../routes";
import { deleteJobPost, restoreJobPost } from "../server/actions";
import type { JobPostSummary } from "../server/queries";

/** Moves a job post out of the list, with Undo in the confirmation toast. */
export function useDeleteJobPost() {
  const t = useTranslations("jobs.list");
  return async (job: { id: string; title: string }) => {
    const result = await deleteJobPost(job.id);
    if (!result.ok) throw new Error(result.error);
    toast.success(t("deleted", { title: job.title }), {
      action: {
        label: t("undo"),
        onClick: () => {
          void restoreJobPost(job.id).then((restored) => {
            if (!restored.ok) toast.error(t("actionFailed"));
          });
        },
      },
    });
  };
}

export function JobPostList({ jobs }: { jobs: readonly JobPostSummary[] }) {
  const t = useTranslations("jobs.list");
  const tLanguages = useTranslations("jobs.languages");
  const format = useFormatter();
  const remove = useDeleteJobPost();
  const [deleting, setDeleting] = useState<JobPostSummary | null>(null);

  return (
    <>
      <div className="border-b px-4 py-5 sm:px-6">
        <h2 className="text-lg font-semibold tracking-[-0.02em]">{t("title")}</h2>
      </div>
      <ul className="divide-y">
        {jobs.map((job) => (
          <li key={job.id} className="flex items-start gap-3.5 px-4 py-4 sm:px-6">
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-md bg-ink-100 text-muted-foreground"
            >
              <BriefcaseBusinessIcon className="size-4" />
            </span>
            <div className="min-w-0 flex-1 space-y-1.5">
              <Link
                href={jobHref(job.id)}
                className="block truncate rounded-sm text-sm font-semibold hover:underline"
              >
                {job.title}
              </Link>
              <p className="text-xs text-muted-foreground">
                {[job.company, tLanguages(job.language)].filter(Boolean).join(" · ")}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {job.required + job.preferred > 0 ? (
                  <span className="text-xs text-muted-foreground" data-numeric>
                    {[
                      job.required > 0 ? t("requiredCount", { count: job.required }) : null,
                      job.preferred > 0 ? t("preferredCount", { count: job.preferred }) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                ) : (
                  <Badge variant="warning">{t("noRequirements")}</Badge>
                )}
                {job.careerScore !== null ? (
                  <Badge variant="secondary" data-numeric>
                    {t("career", { score: job.careerScore })}
                  </Badge>
                ) : null}
                {job.best ? (
                  <Badge variant="outline" data-numeric>
                    {t("best", { score: job.best.score, cv: job.best.cvName })}
                  </Badge>
                ) : job.required + job.preferred > 0 ? (
                  <span className="text-xs text-muted-foreground">{t("noCv")}</span>
                ) : null}
              </div>
              <p className="text-xs text-subtle-foreground" data-numeric>
                {t("updated", {
                  date: format.dateTime(new Date(job.updatedAt), { dateStyle: "medium" }),
                })}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("moreActions", { title: job.title })}
                >
                  <EllipsisIcon aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={jobHref(job.id)}>
                    <PencilLineIcon aria-hidden="true" />
                    {t("open")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(job)}>
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
        title={t("deleteTitle", { title: deleting?.title ?? "" })}
        description={t("deleteDescription")}
        confirmLabel={t("delete")}
        tone="destructive"
        onConfirm={async () => {
          if (deleting) await remove(deleting);
        }}
      />
    </>
  );
}
