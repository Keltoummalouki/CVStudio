import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CustomSectionForm } from "@/features/career-data/components/custom-section-form";
import { getCustomSectionEditor } from "@/features/career-data/server/queries";
import { requireUuid } from "@/lib/data/params";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("careerData.sections.custom");
  return { title: t("title") };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const values = await getCustomSectionEditor(requireUuid(id));
  return <CustomSectionForm initialValues={values} />;
}
