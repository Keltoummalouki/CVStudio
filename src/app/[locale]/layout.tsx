import type { Metadata, Viewport } from "next";
import { Host_Grotesk } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LOCALES } from "@/lib/i18n/config";
import "../globals.css";

const hostGrotesk = Host_Grotesk({
  subsets: ["latin", "latin-ext"],
  variable: "--font-host-grotesk",
  display: "swap",
});

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");

  return {
    title: { template: t("titleTemplate"), default: t("defaultTitle") },
    description: t("description"),
    // A private workspace: never indexed, never followed.
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  viewportFit: "cover",
  colorScheme: "light",
  themeColor: "#fafafa",
};

export default async function LocaleLayout({ children }: LayoutProps<"/[locale]">) {
  const locale = await getLocale();

  return (
    <html lang={locale} className={hostGrotesk.variable}>
      <body>
        <NextIntlClientProvider>
          <TooltipProvider delayDuration={250}>
            {children}
            <Toaster />
          </TooltipProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
