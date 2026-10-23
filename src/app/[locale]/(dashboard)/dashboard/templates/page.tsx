import type { Metadata } from "next";
import { FilePlus2Icon, LayersIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
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
import { NEW_CV_HREF } from "@/config/navigation";
import { getCvLabels } from "@/features/cv-documents/server/labels";
import { getPortraitUrl } from "@/features/cv-documents/server/queries";
import { CanvasCv } from "@/features/cv-renderer/canvas-v1/canvas-cv";
import { ClassicCv } from "@/features/cv-renderer/classic-reference-v1/classic-cv";
import { PageThumbnail } from "@/features/cv-renderer/page-thumbnail";
import { CreateTemplateButton } from "@/features/cv-templates/components/create-template-button";
import { TemplateCover, TemplateList } from "@/features/cv-templates/components/template-list";
import { getTemplateGallery } from "@/features/cv-templates/server/queries";
import { isLocale } from "@/lib/i18n/config";
import { Link } from "@/lib/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("templates");
  return { title: t("title") };
}

const CONCEPTS = ["cv", "template", "style"] as const;

export default async function TemplatesPage() {
  const requested = await getLocale();
  const locale = isLocale(requested) ? requested : "en";
  const [t, gallery, labels, photoUrl] = await Promise.all([
    getTranslations("templates"),
    getTemplateGallery(locale),
    getCvLabels(),
    getPortraitUrl(),
  ]);
  const { preview } = gallery;
  // Pictures are rendered here, filled with the current career data; the
  // interactive list only gets the summaries.
  const thumbnails = Object.fromEntries(
    gallery.templates.map((template) => [
      template.id,
      <PageThumbnail key={template.id}>
        <CanvasCv
          design={template.design}
          definition={preview.definition}
          cv={preview.cv}
          labels={labels[locale]}
          photoUrl={photoUrl}
        />
      </PageThumbnail>,
    ]),
  );
  const templates = gallery.templates.map(({ design: _design, ...summary }) => summary);

  return (
    <PageContainer>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={<CreateTemplateButton />}
      />

      <section aria-labelledby="templates-yours" className="flex flex-col gap-4">
        <div className="space-y-1">
          <h2 id="templates-yours" className="text-lg font-semibold tracking-[-0.02em]">
            {t("library.title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("library.howToAdd")}</p>
        </div>
        {templates.length === 0 ? (
          <Panel>
            <Empty className="py-12">
              <EmptyMedia variant="icon">
                <LayersIcon />
              </EmptyMedia>
              <EmptyHeader>
                <EmptyTitle as="h3">{t("empty.title")}</EmptyTitle>
                <EmptyDescription>{t("empty.description")}</EmptyDescription>
              </EmptyHeader>
              <EmptyContent className="justify-center">
                <CreateTemplateButton variant="default" />
              </EmptyContent>
            </Empty>
          </Panel>
        ) : (
          <TemplateList templates={templates} thumbnails={thumbnails} />
        )}
      </section>

      <section aria-labelledby="templates-included" className="flex flex-col gap-4">
        <div className="space-y-1">
          <h2 id="templates-included" className="text-lg font-semibold tracking-[-0.02em]">
            {t("included.title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("included.description")}</p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <li className="group/template flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card">
            <TemplateCover>
              <PageThumbnail>
                <ClassicCv cv={gallery.classic} labels={labels[locale]} photoUrl={photoUrl} />
              </PageThumbnail>
            </TemplateCover>
            <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
              <div className="flex-1 space-y-2">
                <h3 className="flex flex-wrap items-center gap-2 text-base font-semibold tracking-[-0.015em]">
                  {t("visualStyle.name")}
                  <Badge variant="secondary">{t("visualStyle.included")}</Badge>
                </h3>
                <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">
                  {t("visualStyle.description")}
                </p>
              </div>
              <div>
                <Button asChild variant="outline" size="sm">
                  <Link href={NEW_CV_HREF}>
                    <FilePlus2Icon aria-hidden="true" />
                    {t("use")}
                  </Link>
                </Button>
              </div>
            </div>
          </li>
        </ul>
      </section>

      <Panel aria-labelledby="concepts-title">
        <PanelHeader titleId="concepts-title" title={t("concepts.title")} />
        <dl className="grid gap-px overflow-hidden rounded-b-lg bg-border sm:grid-cols-3">
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
    </PageContainer>
  );
}
