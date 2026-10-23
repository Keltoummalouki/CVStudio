import type { Metadata } from "next";
import { ArrowLeftIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { toAiAccess } from "@/features/ai-settings/access";
import { getAiStatus } from "@/features/ai-settings/server/queries";
import { NewJobPost } from "@/features/job-posts/components/new-job-post";
import { JOBS_HREF } from "@/features/job-posts/routes";
import { Link } from "@/lib/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("jobs.new");
  return { title: t("title") };
}

export default async function Page() {
  const [t, status] = await Promise.all([getTranslations("jobs.new"), getAiStatus()]);

  return (
    <PageContainer className="max-w-5xl">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={JOBS_HREF}>
            <ArrowLeftIcon aria-hidden="true" />
            {t("back")}
          </Link>
        </Button>
      </div>
      <PageHeader title={t("title")} description={t("description")} />
      <NewJobPost ai={toAiAccess(status)} />
    </PageContainer>
  );
}
