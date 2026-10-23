import type { Metadata } from "next";
import { BriefcaseBusinessIcon, InfoIcon, PlusIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageContainer, PageHeader, Panel } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { JobPostList } from "@/features/job-posts/components/job-post-list";
import { NEW_JOB_HREF } from "@/features/job-posts/routes";
import { listJobPosts } from "@/features/job-posts/server/queries";
import { Link } from "@/lib/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("jobs");
  return { title: t("title") };
}

export default async function JobsPage() {
  const [t, jobs] = await Promise.all([getTranslations("jobs"), listJobPosts()]);
  const addAction = (
    <Button asChild variant="signal">
      <Link href={NEW_JOB_HREF}>
        <PlusIcon aria-hidden="true" />
        {t("add")}
      </Link>
    </Button>
  );

  return (
    <PageContainer>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={jobs.length > 0 ? addAction : null}
      />
      <Panel>
        {jobs.length === 0 ? (
          <Empty className="py-14">
            <EmptyMedia>
              <span className="flex size-14 items-center justify-center rounded-lg bg-ink-100 text-muted-foreground">
                <BriefcaseBusinessIcon aria-hidden="true" className="size-6" />
              </span>
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle as="h2">{t("empty.title")}</EmptyTitle>
              <EmptyDescription>{t("empty.description")}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="flex-col">
              {addAction}
              <p className="max-w-sm text-center text-[0.8125rem] text-muted-foreground">
                <InfoIcon aria-hidden="true" className="mr-1.5 inline size-3.5 align-[-0.15em]" />
                {t("empty.hint")}
              </p>
            </EmptyContent>
          </Empty>
        ) : (
          <JobPostList jobs={jobs} />
        )}
      </Panel>
    </PageContainer>
  );
}
