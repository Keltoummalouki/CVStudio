import { render, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@messages/en.json";
import fr from "@messages/fr.json";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Locale } from "@/lib/i18n/config";

const MESSAGES = { en, fr } as const;

type IntlRenderOptions = Omit<RenderOptions, "wrapper"> & { locale?: Locale };

export function renderWithIntl(
  ui: React.ReactElement,
  { locale = "en", ...options }: IntlRenderOptions = {},
) {
  // Message types are the English literals; French shares the same keys (enforced by the
  // dictionary parity test) but different text, so it is narrowed to the English shape here.
  const messages = MESSAGES[locale] as typeof en;

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
        <TooltipProvider>{children}</TooltipProvider>
      </NextIntlClientProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...options });
}

export { MESSAGES };
