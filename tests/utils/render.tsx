import { render, renderHook, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@messages/en.json";
import fr from "@messages/fr.json";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Locale } from "@/lib/i18n/config";

const MESSAGES = { en, fr } as const;

type IntlRenderOptions = Omit<RenderOptions, "wrapper"> & { locale?: Locale };

function intlWrapper(locale: Locale) {
  // Message types are the English literals; French shares the same keys (enforced by the
  // dictionary parity test) but different text, so it is narrowed to the English shape here.
  const messages = MESSAGES[locale] as typeof en;

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
        <TooltipProvider>{children}</TooltipProvider>
      </NextIntlClientProvider>
    );
  };
}

export function renderWithIntl(
  ui: React.ReactElement,
  { locale = "en", ...options }: IntlRenderOptions = {},
) {
  return render(ui, { wrapper: intlWrapper(locale), ...options });
}

/** `renderHook` for hooks that translate (useTranslations, useLocale). */
export function renderHookWithIntl<Result, Props>(
  hook: (props: Props) => Result,
  { locale = "en", initialProps }: { locale?: Locale; initialProps?: Props } = {},
) {
  return renderHook(hook, { wrapper: intlWrapper(locale), initialProps });
}

export { MESSAGES };
