import type { Metadata } from "next";
import { LanguagesIcon, LockKeyholeIcon, SlidersHorizontalIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { PageContainer, PageHeader, Panel, PanelHeader } from "@/components/layout/page";
import { APP_VERSION } from "@/config/app";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { BrandMark } from "@/components/brand/brand-mark";
import { requireOwner } from "@/lib/auth/session";
import type { Locale } from "@/lib/i18n/config";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: t("title") };
}

export default async function SettingsPage() {
  const [t, tSwitcher, locale, { owner }] = await Promise.all([
    getTranslations("settings"),
    getTranslations("localeSwitcher"),
    getLocale() as Promise<Locale>,
    requireOwner(),
  ]);

  return (
    <PageContainer className="max-w-5xl lg:mx-0">
      <PageHeader title={t("title")} description={t("description")} />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="space-y-5">
          <Panel aria-labelledby="interface-language-title">
            <PanelHeader
              titleId="interface-language-title"
              title={t("language.title")}
              description={t("language.description")}
              aside={<LanguagesIcon aria-hidden="true" className="size-5 text-muted-foreground" />}
            />
            <div className="space-y-3 px-5 py-5 sm:px-6">
              <LocaleSwitcher className="w-fit" />
              <p className="text-[0.8125rem] text-muted-foreground">{tSwitcher("hint")}</p>
            </div>
          </Panel>

          <Panel aria-labelledby="account-title">
            <PanelHeader
              titleId="account-title"
              title={t("account.title")}
              description={t("account.description")}
              aside={
                <LockKeyholeIcon aria-hidden="true" className="size-5 text-muted-foreground" />
              }
            />
            <div className="flex flex-col gap-4 px-5 py-5 sm:px-6">
              <p className="min-w-0 text-sm wrap-anywhere">
                {t("account.signedInAs", { email: owner.email ?? "—" })}
              </p>
              <div>
                <SignOutButton locale={locale} label={t("account.signOut")} />
              </div>
            </div>
          </Panel>
        </div>
        <Panel aria-labelledby="about-title" className="bg-ink-100 p-5">
          <div className="mb-7 flex items-center justify-between gap-2">
            <BrandMark />
            <SlidersHorizontalIcon aria-hidden="true" className="size-4 text-muted-foreground" />
          </div>
          <h2 id="about-title" className="text-sm font-semibold">
            {t("about.title")}
          </h2>
          <p className="mt-2 text-sm/relaxed text-muted-foreground">{t("about.description")}</p>
          <p className="mt-6 border-t pt-4 text-xs text-muted-foreground" data-numeric>
            {t("about.version", { version: APP_VERSION })}
          </p>
        </Panel>
      </div>
    </PageContainer>
  );
}
