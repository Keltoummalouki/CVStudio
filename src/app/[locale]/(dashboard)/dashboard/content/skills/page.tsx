import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SkillGroupsForm } from "@/features/career-data/components/collection-forms";
import { getSkillGroupsEditor } from "@/features/career-data/server/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("careerData.sections.technicalSkills");
  return { title: t("title") };
}

export default async function Page() {
  const values = await getSkillGroupsEditor();
  return <SkillGroupsForm initialValues={values} />;
}
