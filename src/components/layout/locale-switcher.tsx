"use client";

import { Suspense } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LOCALES, LOCALE_ENDONYMS } from "@/lib/i18n/config";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";

type LocaleSwitcherProps = {
  tone?: "default" | "rail";
  className?: string;
};

function SwitcherLinks({ tone, pathname }: { tone: "default" | "rail"; pathname: string }) {
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
                tone === "rail"
                  ? "text-rail-muted hover:bg-rail-hover hover:text-rail-foreground aria-[current=true]:bg-paper aria-[current=true]:text-ink-950"
                  : "bg-card text-muted-foreground hover:bg-ink-100 hover:text-foreground aria-[current=true]:bg-ink-950 aria-[current=true]:text-paper",
              )}
            >
              <span aria-hidden="true">{locale.toUpperCase()}</span>
              <span className="sr-only">{LOCALE_ENDONYMS[locale]}</span>
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
function PendingSwitcher({ tone }: { tone: "default" | "rail" }) {
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
            index > 0 && "border-l",
            tone === "rail"
              ? "border-rail-border text-rail-muted"
              : "border-input bg-card text-muted-foreground",
            locale === activeLocale &&
              (tone === "rail" ? "bg-paper text-ink-950" : "bg-ink-950 text-paper"),
          )}
        >
          {locale.toUpperCase()}
        </li>
      ))}
    </ul>
  );
}

function CurrentPageSwitcherLinks({ tone }: { tone: "default" | "rail" }) {
  return <SwitcherLinks tone={tone} pathname={usePathname()} />;
}

/**
 * The EN | FR split: two hairline-divided cells, the active language inked.
 * Plain links, so switching works without JavaScript and keeps the current page.
 * In a prerendered shell an inert placeholder shows until the current path is known.
 */
export function LocaleSwitcher({ tone = "default", className }: LocaleSwitcherProps) {
  const t = useTranslations("localeSwitcher");

  return (
    <nav aria-label={t("label")} className={className}>
      <Suspense fallback={<PendingSwitcher tone={tone} />}>
        <CurrentPageSwitcherLinks tone={tone} />
      </Suspense>
    </nav>
  );
}
