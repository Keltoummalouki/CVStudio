import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CertificationForm } from "@/features/career-data/components/certification-form";
import { NEW_CERTIFICATION } from "@/features/career-data/defaults";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("careerData");
  return { title: t("editor.newTitle", { item: t("sections.certifications.singular") }) };
}

export default function Page() {
  return <CertificationForm initialValues={NEW_CERTIFICATION} />;
}
