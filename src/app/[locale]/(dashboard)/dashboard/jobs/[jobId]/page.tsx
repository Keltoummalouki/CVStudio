import type { Metadata } from "next";
import { ArrowLeftIcon, FilePlus2Icon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { toAiAccess } from "@/features/ai-settings/access";
import { getAiStatus } from "@/features/ai-settings/server/queries";
import {
  DeleteJobPostButton,
  JobPostWorkspace,
} from "@/features/job-posts/components/job-post-workspace";
import { JOBS_HREF, newCvForJobHref } from "@/features/job-posts/routes";
import { getJobPost } from "@/features/job-posts/server/queries";
import { requireUuid } from "@/lib/data/params";
import { Link } from "@/lib/i18n/navigation";

type Props = { params: Promise<{ jobId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { jobId } = await params;
  const page = await getJobPost(requireUuid(jobId));
  return { title: page.values.title };
}

export default async function Page({ params }: Props) {
  const id = requireUuid((await params).jobId);
  const [t, page, status] = await Promise.all([
    getTranslations("jobs"),
    getJobPost(id),
    getAiStatus(),
  ]);
  const { values } = page;

  return (
    <PageContainer className="max-w-5xl">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={JOBS_HREF}>
            <ArrowLeftIcon aria-hidden="true" />
            {t("editor.backTo")}
          </Link>
        </Button>
      </div>
      <PageHeader
        title={values.title}
        description={values.company || undefined}
        actions={
          <>
            <Button asChild variant="signal" size="sm">
              <Link href={newCvForJobHref(id)}>
                <FilePlus2Icon aria-hidden="true" />
                {t("createCv")}
              </Link>
            </Button>
            <DeleteJobPostButton id={id} title={values.title} />
          </>
        }
      />
      <JobPostWorkspace page={page} ai={toAiAccess(status)} />
    </PageContainer>
  );
}
