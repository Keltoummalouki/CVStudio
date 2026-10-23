import type { Metadata } from "next";
import { InfoIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { A4SheetIllustration } from "@/components/feedback/a4-sheet-illustration";
import { NewCvAction } from "@/components/layout/new-cv-action";
import { PageContainer, PageHeader, Panel } from "@/components/layout/page";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { CvList } from "@/features/cv-documents/components/cv-list";
import { listCvDocuments } from "@/features/cv-documents/server/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("cvs");
  return { title: t("title") };
}

export default async function CvsPage() {
  const [t, library] = await Promise.all([getTranslations("cvs"), listCvDocuments()]);
  const cvs = library.items;

  return (
    <PageContainer>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={cvs.length > 0 ? <NewCvAction variant="default" /> : null}
      />
      <Panel>
        {cvs.length === 0 ? (
          <Empty className="py-14">
            <EmptyMedia>
              <A4SheetIllustration className="w-28" />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle as="h2">{t("empty.title")}</EmptyTitle>
              <EmptyDescription>{t("empty.description")}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="flex-col">
              <NewCvAction variant="default" />
              <p className="max-w-sm text-center text-[0.8125rem] text-muted-foreground">
                <InfoIcon aria-hidden="true" className="mr-1.5 inline size-3.5 align-[-0.15em]" />
                {t("empty.hint")}
              </p>
            </EmptyContent>
          </Empty>
        ) : (
          <CvList cvs={cvs} total={library.total} />
        )}
      </Panel>
    </PageContainer>
  );
}
