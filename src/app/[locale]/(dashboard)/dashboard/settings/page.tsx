import type { Metadata } from "next";
import { LanguagesIcon, LockKeyholeIcon, SlidersHorizontalIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { PageContainer, PageHeader, Panel, PanelHeader } from "@/components/layout/page";
import { APP_VERSION } from "@/config/app";
import { AiSettingsPanel } from "@/features/ai-settings/components/ai-settings-panel";
import { getAiOverview } from "@/features/ai-settings/server/queries";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { StudioPaper } from "@/components/layout/studio-paper";
import { BrandMark } from "@/components/brand/brand-mark";
import { requireOwner } from "@/lib/auth/session";
import type { Locale } from "@/lib/i18n/config";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: t("title") };
}

export default async function SettingsPage() {
  const [t, tSwitcher, locale, { owner }, ai, tAi] = await Promise.all([
    getTranslations("settings"),
    getTranslations("localeSwitcher"),
    getLocale() as Promise<Locale>,
    requireOwner(),
    getAiOverview(),
    getTranslations("ai.settings"),
  ]);

  return (
    <PageContainer className="studio-settings">
      <PageHeader title={t("title")} description={t("description")} />

      <nav className="studio-settings-jumps" aria-label={t("title")}>
        <a href="#interface-language">{t("language.title")}</a>
        <a href="#account">{t("account.title")}</a>
        <a href="#ai-settings">{tAi("title")}</a>
      </nav>
      <div className="studio-settings-grid">
        <div className="studio-settings-main">
          <div className="studio-settings-basics">
            <Panel id="interface-language" aria-labelledby="interface-language-title">
              <PanelHeader
                titleId="interface-language-title"
                title={t("language.title")}
                description={t("language.description")}
                aside={
                  <LanguagesIcon aria-hidden="true" className="size-5 text-muted-foreground" />
                }
              />
              <div className="space-y-3 px-5 py-5 sm:px-6">
                <LocaleSwitcher className="w-fit" />
                <p className="text-[0.8125rem] text-muted-foreground">{tSwitcher("hint")}</p>
              </div>
            </Panel>

            <Panel id="account" aria-labelledby="account-title">
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
          <div id="ai-settings">
            <AiSettingsPanel overview={ai} />
          </div>
        </div>
        <aside aria-labelledby="about-title" className="studio-about">
          <div className="studio-about-art">
            <StudioPaper />
          </div>
          <div className="studio-about-copy">
            <div className="mb-5 flex items-center justify-between gap-2">
              <BrandMark />
              <SlidersHorizontalIcon aria-hidden="true" className="size-4 text-muted-foreground" />
            </div>
            <h2 id="about-title" className="text-sm font-semibold">
              {t("about.title")}
            </h2>
            <p className="mt-2 text-sm/relaxed text-muted-foreground">{t("about.description")}</p>
            <p className="studio-about-footer text-xs text-muted-foreground" data-numeric>
              {t("about.version", { version: APP_VERSION })}
            </p>
          </div>
        </aside>
      </div>
    </PageContainer>
  );
}
