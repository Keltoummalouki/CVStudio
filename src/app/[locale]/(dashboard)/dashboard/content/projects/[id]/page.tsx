import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ProjectForm } from "@/features/career-data/components/project-form";
import { getProjectEditor } from "@/features/career-data/server/queries";
import { requireUuid } from "@/lib/data/params";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("careerData.sections.projects");
  return { title: t("title") };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const values = await getProjectEditor(requireUuid(id));
  return <ProjectForm initialValues={values} />;
}
