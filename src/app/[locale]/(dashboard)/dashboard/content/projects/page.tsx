import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { RecordListPage } from "@/features/career-data/components/record-list-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("careerData.sections.projects");
  return { title: t("title") };
}

export default function Page() {
  return <RecordListPage kind="projects" />;
}
