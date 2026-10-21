import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ProfileForm } from "@/features/career-data/components/profile-form";
import { getProfileEditor } from "@/features/career-data/server/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("careerData.sections.profile");
  return { title: t("title") };
}

export default async function Page() {
  const { values, photo } = await getProfileEditor();
  return <ProfileForm initialValues={values} photoUrl={photo?.url ?? null} />;
}
