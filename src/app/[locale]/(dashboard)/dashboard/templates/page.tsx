import type { Metadata } from "next";
import { ArrowRightIcon, FileTextIcon, LayersIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { A4SheetIllustration } from "@/components/feedback/a4-sheet-illustration";
import { PageContainer, PageHeader, Panel, PanelHeader } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { TemplateList } from "@/features/cv-templates/components/template-list";
import { listTemplates } from "@/features/cv-templates/server/queries";
import { Link } from "@/lib/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("templates");
  return { title: t("title") };
}

const CONCEPTS = ["cv", "template", "style"] as const;

export default async function TemplatesPage() {
  const [t, templates] = await Promise.all([getTranslations("templates"), listTemplates()]);

  return (
    <PageContainer>
      <PageHeader title={t("title")} description={t("description")} />

      <Panel aria-labelledby="templates-library-title">
        {templates.length === 0 ? (
          <Empty className="min-h-80 py-12">
            <EmptyMedia variant="icon">
              <LayersIcon />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle as="h2" id="templates-library-title">
                {t("empty.title")}
              </EmptyTitle>
              <EmptyDescription>{t("empty.description")}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="justify-center">
              <Button asChild variant="default">
                <Link href="/dashboard/cvs">
                  <FileTextIcon aria-hidden="true" />
                  {t("empty.goToCvs")}
                  <ArrowRightIcon aria-hidden="true" />
                </Link>
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <>
            <PanelHeader
              titleId="templates-library-title"
              title={t("library.title")}
              description={t("library.howToAdd")}
            />
            <TemplateList templates={templates} />
          </>
        )}
      </Panel>

      <div className="grid items-start gap-5 lg:grid-cols-12 lg:gap-6">
        <Panel aria-labelledby="concepts-title" className="lg:col-span-7">
          <PanelHeader titleId="concepts-title" title={t("concepts.title")} />
          <dl className="grid gap-px overflow-hidden rounded-b-lg bg-border sm:grid-cols-3 lg:grid-cols-1">
            {CONCEPTS.map((concept) => (
              <div key={concept} className="space-y-1 bg-card px-5 py-4">
                <dt className="text-sm font-semibold">{t(`concepts.${concept}.term`)}</dt>
                <dd className="text-[0.8125rem]/relaxed text-muted-foreground">
                  {t(`concepts.${concept}.definition`)}
                </dd>
              </div>
            ))}
          </dl>
        </Panel>

        <Panel aria-labelledby="visual-style-title" className="lg:col-span-5">
          <PanelHeader titleId="visual-style-title" title={t("visualStyle.title")} />
          <div
            className="flex min-h-52 items-center justify-center gap-7 overflow-hidden bg-ink-100 p-7"
            aria-hidden="true"
          >
            <A4SheetIllustration className="w-28 -rotate-3" />
            <div className="space-y-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">A4</p>
              <p>210 × 297 mm</p>
              <p className="border-t pt-3">EN / FR</p>
            </div>
          </div>
          <div className="p-5">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">{t("visualStyle.name")}</p>
                <Badge variant="secondary">{t("visualStyle.included")}</Badge>
              </div>
              <p className="text-[0.8125rem]/relaxed text-muted-foreground">
                {t("visualStyle.description")}
              </p>
            </div>
          </div>
        </Panel>
      </div>
    </PageContainer>
  );
}
