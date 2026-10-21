import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EducationForm } from "@/features/career-data/components/education-form";
import { NEW_EDUCATION } from "@/features/career-data/defaults";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("careerData");
  return { title: t("editor.newTitle", { item: t("sections.education.singular") }) };
}

export default function Page() {
  return <EducationForm initialValues={NEW_EDUCATION} />;
}
