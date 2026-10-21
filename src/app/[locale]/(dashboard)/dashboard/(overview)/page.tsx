import type { Metadata } from "next";
import { ArrowRightIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { GettingStarted } from "@/features/dashboard/components/getting-started";
import { OverviewCounts } from "@/features/dashboard/components/overview-counts";
import { RecentCvs } from "@/features/dashboard/components/recent-cvs";
import { StudioWelcome } from "@/features/dashboard/components/studio-welcome";
import { getDashboardOverview } from "@/features/dashboard/get-dashboard-overview";
import { isSetupComplete } from "@/features/dashboard/overview";
import { Link } from "@/lib/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("overview");
  return { title: t("title") };
}

export default async function OverviewPage() {
  const [t, tNav, overview] = await Promise.all([
    getTranslations("overview"),
    getTranslations("navigation"),
    getDashboardOverview(),
  ]);
  const showSetup = !isSetupComplete(overview.setup);

  return (
    <PageContainer>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button asChild variant="outline">
            <Link href="/dashboard/content">
              {tNav("careerData")}
              <ArrowRightIcon aria-hidden="true" />
            </Link>
          </Button>
        }
      />
      <StudioWelcome overview={overview} />
      <div className="grid gap-5 lg:gap-6 xl:grid-cols-12">
        <RecentCvs
          cvs={overview.recentCvs}
          className={showSetup ? "xl:col-span-7" : "xl:col-span-12"}
        />
        {showSetup ? <GettingStarted setup={overview.setup} className="xl:col-span-5" /> : null}
      </div>
      <OverviewCounts counts={overview.counts} />
    </PageContainer>
  );
}
