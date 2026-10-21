import * as rootParams from "next/root-params";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { getAppTimeZone } from "@/lib/env/time-zone";
import { routing } from "./routing";

export default getRequestConfig(async ({ locale: localeOverride }) => {
  // Root params are unavailable in Server Actions and Route Handlers, which
  // must pass an explicit locale instead.
  const candidate = localeOverride ?? (await rootParams.locale());

  if (!hasLocale(routing.locales, candidate)) {
    notFound();
  }

  return {
    locale: candidate,
    messages: (await import(`../../../messages/${candidate}.json`)).default,
    timeZone: getAppTimeZone(),
  };
});
