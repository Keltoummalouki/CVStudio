import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SpokenLanguagesForm } from "@/features/career-data/components/collection-forms";
import { getSpokenLanguagesEditor } from "@/features/career-data/server/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("careerData.sections.languages");
  return { title: t("title") };
}

export default async function Page() {
  const values = await getSpokenLanguagesEditor();
  return <SpokenLanguagesForm initialValues={values} />;
}
