"use client";

import { useState } from "react";
import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { Button } from "@/components/ui/button";
import type { AiAccess } from "@/features/ai-settings/access";
import { useRouter } from "@/lib/i18n/navigation";
import { JOBS_HREF } from "../routes";
import type { JobPostPage } from "../server/queries";
import { CareerMatch } from "./career-match";
import { CvMatchList } from "./cv-match-list";
import { useDeleteJobPost } from "./job-post-list";
import { JobPostForm } from "./job-post-form";

/** A saved job post: how the career and each CV match it, then its editor. */
export function JobPostWorkspace({ page, ai }: { page: JobPostPage; ai: AiAccess }) {
  return (
    <JobPostForm
      initialValues={page.values}
      ai={ai}
      analyzedAt={page.analyzedAt}
      aside={(dirty) => (
        <>
          <CareerMatch report={page.career} dirty={dirty} />
          <CvMatchList
            matches={page.matches}
            hasRequirements={page.values.requirements.items.length > 0}
            dirty={dirty}
          />
        </>
      )}
    />
  );
}

export function DeleteJobPostButton({ id, title }: { id: string; title: string }) {
  const t = useTranslations("jobs.list");
  const router = useRouter();
  const remove = useDeleteJobPost();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="destructive-outline" size="sm" onClick={() => setOpen(true)}>
        <Trash2Icon aria-hidden="true" />
        {t("delete")}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t("deleteTitle", { title })}
        description={t("deleteDescription")}
        confirmLabel={t("delete")}
        tone="destructive"
        onConfirm={async () => {
          // Leave first: this page cannot render a deleted post, the list refreshes after.
          router.push(JOBS_HREF);
          try {
            await remove({ id, title });
          } catch {
            toast.error(t("actionFailed"));
          }
        }}
      />
    </>
  );
}
