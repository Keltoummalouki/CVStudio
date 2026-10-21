import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CustomSectionForm } from "@/features/career-data/components/custom-section-form";
import { NEW_CUSTOM_SECTION } from "@/features/career-data/defaults";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("careerData");
  return { title: t("editor.newTitle", { item: t("sections.custom.singular") }) };
}

export default function Page() {
  return <CustomSectionForm initialValues={NEW_CUSTOM_SECTION} />;
}
