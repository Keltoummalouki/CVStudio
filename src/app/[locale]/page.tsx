import { getLocale } from "next-intl/server";
import { DASHBOARD_HOME } from "@/config/navigation";
import { redirect } from "@/lib/i18n/navigation";

export default async function LocaleIndexPage() {
  const locale = await getLocale();
  redirect({ href: DASHBOARD_HOME, locale });
}
