import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EducationForm } from "@/features/career-data/components/education-form";
import { getEducationEditor } from "@/features/career-data/server/queries";
import { requireUuid } from "@/lib/data/params";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("careerData.sections.education");
  return { title: t("title") };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const values = await getEducationEditor(requireUuid(id));
  return <EducationForm initialValues={values} />;
}
