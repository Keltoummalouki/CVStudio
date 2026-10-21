import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ExperienceForm } from "@/features/career-data/components/experience-form";
import { getExperienceEditor } from "@/features/career-data/server/queries";
import { requireUuid } from "@/lib/data/params";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("careerData.sections.experience");
  return { title: t("title") };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const values = await getExperienceEditor(requireUuid(id));
  return <ExperienceForm initialValues={values} />;
}
