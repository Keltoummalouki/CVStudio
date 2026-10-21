import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ProjectForm } from "@/features/career-data/components/project-form";
import { NEW_PROJECT } from "@/features/career-data/defaults";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("careerData");
  return { title: t("editor.newTitle", { item: t("sections.projects.singular") }) };
}

export default function Page() {
  return <ProjectForm initialValues={NEW_PROJECT} />;
}
