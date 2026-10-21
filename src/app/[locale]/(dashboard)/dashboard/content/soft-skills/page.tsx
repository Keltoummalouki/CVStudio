import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SoftSkillsForm } from "@/features/career-data/components/collection-forms";
import { getSoftSkillsEditor } from "@/features/career-data/server/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("careerData.sections.softSkills");
  return { title: t("title") };
}

export default async function Page() {
  const values = await getSoftSkillsEditor();
  return <SoftSkillsForm initialValues={values} />;
}
