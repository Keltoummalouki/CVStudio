"use client";

import { Suspense } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LOCALES, LOCALE_ENDONYMS } from "@/lib/i18n/config";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";

type SwitcherPresentation = {
  tone: "default" | "rail";
  labels: "codes" | "names";
};

type LocaleSwitcherProps = Partial<SwitcherPresentation> & {
  className?: string;
};

function SwitcherLinks({ tone, labels, pathname }: SwitcherPresentation & { pathname: string }) {
  const t = useTranslations("localeSwitcher");
  const activeLocale = useLocale();

  return (
    <ul
      className={cn(
        "grid grid-cols-2 overflow-hidden rounded-md border text-xs font-semibold tracking-[0.04em]",
        tone === "rail" ? "border-rail-border" : "border-input",
      )}
    >
      {LOCALES.map((locale, index) => {
        const isActive = locale === activeLocale;
        return (
          <li
            key={locale}
            className={cn(
              index > 0 && "border-l",
              tone === "rail" ? "border-rail-border" : "border-input",
            )}
          >
            <Link
              href={pathname}
              locale={locale}
              hrefLang={locale}
              lang={locale}
              aria-current={isActive ? "true" : undefined}
              title={isActive ? undefined : t("switchTo", { language: LOCALE_ENDONYMS[locale] })}
              className={cn(
                "flex h-8 min-w-11 items-center justify-center px-2.5 transition-colors duration-(--duration-fast) focus-visible:-outline-offset-2 pointer-coarse:h-11",
                labels === "names" && "h-10 font-medium tracking-normal",
                tone === "rail"
                  ? "text-rail-muted hover:bg-rail-hover hover:text-rail-foreground aria-[current=true]:bg-paper aria-[current=true]:text-ink-950"
                  : "bg-card text-muted-foreground hover:bg-ink-100 hover:text-foreground aria-[current=true]:bg-ink-950 aria-[current=true]:text-paper",
              )}
            >
              {labels === "names" ? (
                LOCALE_ENDONYMS[locale]
              ) : (
                <>
                  <span aria-hidden="true">{locale.toUpperCase()}</span>
                  <span className="sr-only">{LOCALE_ENDONYMS[locale]}</span>
                </>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Shown only in a prerendered shell before the current path is known: same
 * look, but inert, so an early click can never send the owner to another page.
 */
function PendingSwitcher({ tone, labels }: SwitcherPresentation) {
  const activeLocale = useLocale();
  return (
    <ul
      aria-hidden="true"
      className={cn(
        "grid grid-cols-2 overflow-hidden rounded-md border text-xs font-semibold tracking-[0.04em]",
        tone === "rail" ? "border-rail-border" : "border-input",
      )}
    >
      {LOCALES.map((locale, index) => (
        <li
          key={locale}
          className={cn(
            "flex h-8 min-w-11 items-center justify-center px-2.5 pointer-coarse:h-11",
            labels === "names" && "h-10 font-medium tracking-normal",
            index > 0 && "border-l",
            tone === "rail"
              ? "border-rail-border text-rail-muted"
              : "border-input bg-card text-muted-foreground",
            locale === activeLocale &&
              (tone === "rail" ? "bg-paper text-ink-950" : "bg-ink-950 text-paper"),
          )}
        >
          {labels === "names" ? LOCALE_ENDONYMS[locale] : locale.toUpperCase()}
        </li>
      ))}
    </ul>
  );
}

function CurrentPageSwitcherLinks({ tone, labels }: SwitcherPresentation) {
  return <SwitcherLinks tone={tone} labels={labels} pathname={usePathname()} />;
}

/**
 * The EN | FR split: two hairline-divided cells, the active language inked.
 * Plain links, so switching works without JavaScript and keeps the current page.
 * In a prerendered shell an inert placeholder shows until the current path is known.
 */
export function LocaleSwitcher({
  tone = "default",
  labels = "codes",
  className,
}: LocaleSwitcherProps) {
  const t = useTranslations("localeSwitcher");

  return (
    <nav aria-label={t("label")} className={className}>
      <Suspense fallback={<PendingSwitcher tone={tone} labels={labels} />}>
        <CurrentPageSwitcherLinks tone={tone} labels={labels} />
      </Suspense>
    </nav>
  );
}
