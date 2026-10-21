import type { Metadata } from "next";
import { ArrowLeftIcon, InfoIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { PageContainer, PageHeader, Panel } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { getCareerSummary } from "@/features/career-data/server/queries";
import { NewCvForm } from "@/features/cv-documents/components/new-cv-form";
import { isLocale } from "@/lib/i18n/config";
import { Link } from "@/lib/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("cvs.new");
  return { title: t("title") };
}

export default async function Page() {
  const [t, summary, locale] = await Promise.all([
    getTranslations("cvs.new"),
    getCareerSummary(),
    getLocale(),
  ]);
  const { profileStarted, ...counts } = summary;
  const hasRecords = Object.values(counts).some((count) => count > 0);

  return (
    <PageContainer className="max-w-3xl">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/dashboard/cvs">
            <ArrowLeftIcon aria-hidden="true" />
            {t("back")}
          </Link>
        </Button>
      </div>
      <PageHeader title={t("title")} description={t("description")} />
      {!hasRecords || !profileStarted ? (
        <p className="flex gap-2.5 rounded-md border border-warning/30 bg-warning-soft px-4 py-3 text-sm">
          <InfoIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
          <span>
            {t("emptyData")}{" "}
            <Link
              href="/dashboard/content"
              className="font-medium underline decoration-current/40 underline-offset-4 hover:decoration-current"
            >
              {t("emptyDataLink")}
            </Link>
          </span>
        </p>
      ) : null}
      <Panel className="p-5 sm:p-6">
        <NewCvForm defaultLocale={isLocale(locale) ? locale : "en"} />
      </Panel>
    </PageContainer>
  );
}
