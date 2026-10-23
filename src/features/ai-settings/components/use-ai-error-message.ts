"use client";

import { useTranslations } from "next-intl";
import { isProviderErrorCode, type AiFailureInfo } from "@/lib/ai/errors";

/** Plain-language explanation of why an AI request did not produce an answer. */
export function useAiErrorMessage() {
  const t = useTranslations("ai.errors");
  const tProviders = useTranslations("ai.providers");
  return ({ error, provider }: AiFailureInfo) => {
    if (!isProviderErrorCode(error)) return t(error);
    // A provider's failure names it; without the name, say what is known.
    if (!provider) return t("ai_failed");
    return t(error, { provider: tProviders(provider), providerId: provider });
  };
}
