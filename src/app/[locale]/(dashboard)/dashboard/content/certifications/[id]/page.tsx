import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CertificationForm } from "@/features/career-data/components/certification-form";
import { getCertificationEditor } from "@/features/career-data/server/queries";
import { requireUuid } from "@/lib/data/params";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("careerData.sections.certifications");
  return { title: t("title") };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const values = await getCertificationEditor(requireUuid(id));
  return <CertificationForm initialValues={values} />;
}
