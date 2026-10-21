import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ExperienceForm } from "@/features/career-data/components/experience-form";
import { NEW_EXPERIENCE } from "@/features/career-data/defaults";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("careerData");
  return { title: t("editor.newTitle", { item: t("sections.experience.singular") }) };
}

export default function Page() {
  return <ExperienceForm initialValues={NEW_EXPERIENCE} />;
}
