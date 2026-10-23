"use client";

import { useId } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ScanTextIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { SaveStatus } from "@/components/feedback/save-status";
import { useSaveForm } from "@/components/forms/use-save-form";
import { Panel, PanelHeader } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { AI_DAILY_LIMIT, AI_PROVIDER_KEY_VARS } from "@/config/ai";
import type { AiProviderStatus } from "@/lib/ai/provider";
import { aiSettingsSchema, type AiSettingsValues } from "../schemas";
import { saveAiSettings } from "../server/actions";
import type { AiOverview, AiRequestRow } from "../server/queries";

/** Error codes recorded by finish_ai_request and begin_ai_request ("abandoned"). */
const FAILURES = [
  "timeout",
  "rate_limited",
  "too_large",
  "overloaded",
  "unavailable",
  "rejected",
  "auth",
  "invalid_response",
  "abandoned",
] as const;
type FailureKey = (typeof FAILURES)[number] | "unknown";

const failureKey = (code: string | null): FailureKey =>
  (FAILURES as readonly string[]).includes(code ?? "") ? (code as FailureKey) : "unknown";

const BADGES = { ready: "success", fake: "info", unavailable: "warning" } as const;

function useUsd() {
  const format = useFormatter();
  return (value: number) =>
    format.number(value, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: value > 0 && value < 0.01 ? 4 : 2,
    });
}

/** The providers a job post may be sent to: those that can answer, or the configured ones. */
function recipients(providers: AiProviderStatus[]) {
  const ready = providers.filter((provider) => provider.state !== "unavailable");
  return ready.length > 0 ? ready : providers;
}

/** Who answers first, who takes over, what each needs, and which model answered last. */
function Providers({ overview }: { overview: AiOverview }) {
  const t = useTranslations("ai.settings");
  const tProviders = useTranslations("ai.providers");
  const format = useFormatter();
  const id = useId();
  const [primary, fallback] = overview.providers;
  const last = overview.lastSuccess;

  return (
    <section aria-labelledby={`${id}-providers`} className="space-y-3">
      <h3 id={`${id}-providers`} className="text-sm font-semibold">
        {t("providers")}
      </h3>
      {overview.reason === "invalid_primary" ? (
        <p className="rounded-md bg-warning-soft px-3 py-2.5 text-[0.8125rem] text-warning">
          {t("reasons.invalid_primary")}
        </p>
      ) : null}
      <dl className="grid gap-3 sm:grid-cols-2">
        {overview.providers.map((provider, index) => (
          <div key={provider.id} className="space-y-1.5 rounded-md border px-3 py-2.5">
            <dt className="text-xs text-muted-foreground">
              {t(index === 0 ? "roles.primary" : "roles.fallback")}
            </dt>
            <dd className="flex flex-wrap items-center gap-2 text-sm font-medium">
              {tProviders(provider.id)}
              <Badge variant={BADGES[provider.state]}>
                {t(`status.${provider.state}`, { model: provider.model ?? "" })}
              </Badge>
            </dd>
            {provider.reason ? (
              <dd className="text-[0.8125rem]/relaxed text-muted-foreground">
                {t(`reasons.${provider.reason}`, { key: AI_PROVIDER_KEY_VARS[provider.id] })}
              </dd>
            ) : null}
          </div>
        ))}
      </dl>
      {overview.mode === "fake" ? (
        <p className="text-[0.8125rem] text-muted-foreground">{t("fakeNote")}</p>
      ) : null}
      {primary && fallback ? (
        <p className="text-[0.8125rem]/relaxed text-muted-foreground">
          {t("fallbackHint", {
            primary: tProviders(primary.id),
            fallback: tProviders(fallback.id),
          })}
        </p>
      ) : null}
      <dl className="space-y-1">
        <dt className="text-xs text-muted-foreground">{t("lastAnalysis")}</dt>
        <dd className="text-sm font-medium wrap-anywhere">
          {last
            ? t(last.fallback ? "lastAnalysisFallback" : "lastAnalysisValue", {
                model: last.model,
                provider: last.provider ? tProviders(last.provider) : "—",
                date: format.dateTime(new Date(last.startedAt), {
                  dateStyle: "short",
                  timeStyle: "short",
                }),
              })
            : t("lastAnalysisNone")}
        </dd>
      </dl>
    </section>
  );
}

function RequestRow({ request }: { request: AiRequestRow }) {
  const t = useTranslations("ai.settings");
  const tProviders = useTranslations("ai.providers");
  const format = useFormatter();
  const usd = useUsd();
  const tokens =
    request.inputTokens === null
      ? null
      : request.inputTokens + (request.outputTokens ?? 0) + (request.thoughtTokens ?? 0);
  const reason =
    request.status === "failed" ? t(`failures.${failureKey(request.errorCode)}`) : null;
  // After a fallback, each provider with why it gave way; otherwise the one that answered.
  const path =
    request.attempts.length > 1
      ? request.attempts
          .map((attempt) =>
            attempt.status === "failed"
              ? t("attemptFailed", {
                  provider: tProviders(attempt.provider),
                  reason: t(`failures.${failureKey(attempt.errorCode)}`),
                })
              : tProviders(attempt.provider),
          )
          .join(" → ")
      : request.provider
        ? tProviders(request.provider)
        : null;

  return (
    <li className="grid gap-1 py-3 text-[0.8125rem] sm:grid-cols-[10rem_minmax(0,1fr)_6rem_5rem] sm:items-baseline sm:gap-4">
      <span className="text-muted-foreground" data-numeric>
        {format.dateTime(new Date(request.startedAt), { dateStyle: "short", timeStyle: "short" })}
      </span>
      <span className="min-w-0">
        {t(`features.${request.feature}`)}
        {" · "}
        <span
          className={
            request.status === "failed"
              ? "text-destructive"
              : request.status === "succeeded"
                ? "text-success"
                : "text-muted-foreground"
          }
        >
          {t(`statuses.${request.status}`)}
        </span>
        {reason ? <span className="text-muted-foreground"> · {reason}</span> : null}
        <span className="block text-xs wrap-anywhere text-muted-foreground">
          {path ? `${path} · ` : null}
          {request.model}
        </span>
      </span>
      <span className="text-muted-foreground sm:text-right" data-numeric>
        {tokens === null ? "—" : t("tokens", { count: tokens })}
      </span>
      <span className="text-muted-foreground sm:text-right" data-numeric>
        {request.estimatedCostUsd === null ? "—" : usd(request.estimatedCostUsd)}
      </span>
    </li>
  );
}

/**
 * AI on/off and the daily limit (explicit Save), plus what the owner needs to
 * trust it: which providers answer and in what order, today's usage, this
 * month's estimated cost and the latest requests. Never any key, prompt or
 * answer content.
 */
export function AiSettingsPanel({ overview }: { overview: AiOverview }) {
  const t = useTranslations("ai.settings");
  const tProviders = useTranslations("ai.providers");
  const format = useFormatter();
  const usd = useUsd();
  const id = useId();
  const form = useForm<AiSettingsValues>({
    resolver: zodResolver(aiSettingsSchema),
    defaultValues: overview.settings,
    mode: "onTouched",
  });
  const saver = useSaveForm({
    form,
    action: saveAiSettings,
    onSaved: (saved) => {
      form.reset(saved);
      toast.success(t("saved"));
    },
  });
  const limitError = form.formState.errors.dailyLimit;
  const resetTime = format.dateTime(new Date(overview.resetsAt), { timeStyle: "short" });
  const [first, second] = recipients(overview.providers);
  const enableHint = !first
    ? t("enableHintNone")
    : second
      ? t("enableHintFallback", {
          primary: tProviders(first.id),
          fallback: tProviders(second.id),
        })
      : t("enableHint", { provider: tProviders(first.id) });

  return (
    <Panel aria-labelledby={`${id}-title`}>
      <PanelHeader
        titleId={`${id}-title`}
        title={t("title")}
        description={t("description")}
        aside={<ScanTextIcon aria-hidden="true" className="size-5 text-muted-foreground" />}
      />
      <div className="flex flex-col gap-6 px-5 py-5 sm:px-6">
        <Providers overview={overview} />

        <form noValidate onSubmit={saver.save} className="flex flex-col gap-5 border-t pt-5">
          <Controller
            control={form.control}
            name="enabled"
            render={({ field }) => (
              <div className="flex items-start gap-3">
                <Switch
                  id={`${id}-enabled`}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  onBlur={field.onBlur}
                  aria-describedby={`${id}-enabled-hint`}
                  className="mt-0.5"
                />
                <div className="min-w-0 space-y-1">
                  <label htmlFor={`${id}-enabled`} className="text-sm font-medium">
                    {t("enable")}
                  </label>
                  <p
                    id={`${id}-enabled-hint`}
                    className="text-[0.8125rem]/relaxed text-muted-foreground"
                  >
                    {enableHint}
                  </p>
                </div>
              </div>
            )}
          />

          <div className="space-y-1.5" data-invalid={limitError ? true : undefined}>
            <label htmlFor={`${id}-limit`} className="block text-sm font-medium">
              {t("dailyLimit")}
            </label>
            <Input
              id={`${id}-limit`}
              type="number"
              inputMode="numeric"
              min={AI_DAILY_LIMIT.min}
              max={AI_DAILY_LIMIT.max}
              step={1}
              className="w-28"
              aria-invalid={limitError ? true : undefined}
              aria-describedby={`${id}-limit-hint${limitError ? ` ${id}-limit-error` : ""}`}
              {...form.register("dailyLimit", { valueAsNumber: true })}
            />
            <p id={`${id}-limit-hint`} className="text-[0.8125rem] text-muted-foreground">
              {t("dailyLimitHint", {
                min: AI_DAILY_LIMIT.min,
                max: AI_DAILY_LIMIT.max,
                time: resetTime,
              })}
            </p>
            {limitError ? (
              <p
                id={`${id}-limit-error`}
                role="alert"
                className="text-[0.8125rem] text-destructive"
              >
                {t("limitError", { min: AI_DAILY_LIMIT.min, max: AI_DAILY_LIMIT.max })}
              </p>
            ) : null}
          </div>

          {saver.error && saver.error !== "invalid_input" ? (
            <p
              role="alert"
              className="rounded-md bg-destructive-soft px-3 py-2.5 text-sm text-destructive"
            >
              {t("saveFailed")}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="default" disabled={saver.isSaving}>
              {saver.isSaving ? <Spinner /> : null}
              {saver.isSaving ? t("saving") : t("save")}
            </Button>
            <SaveStatus state={saver.state} onRetry={() => void saver.save()} />
          </div>
        </form>

        <div className="space-y-2 rounded-md border border-border-strong bg-ink-50 px-3 py-2.5 text-[0.8125rem]/relaxed">
          <p>{t("groqData")}</p>
          <p>{t("paidKey")}</p>
        </div>

        <dl className="grid gap-4 border-t pt-5 sm:grid-cols-2">
          <div className="space-y-1">
            <dt className="text-xs text-muted-foreground">{t("usage")}</dt>
            <dd className="text-sm font-medium" data-numeric>
              {t("usageCount", { used: overview.usedToday, limit: overview.settings.dailyLimit })}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs text-muted-foreground">{t("monthCost")}</dt>
            <dd className="text-sm font-medium" data-numeric>
              {t("monthCostValue", {
                cost: usd(overview.month.estimatedCostUsd),
                count: overview.month.requests,
              })}
            </dd>
          </div>
        </dl>
        <p className="-mt-3 text-xs text-muted-foreground">{t("costNote")}</p>

        <section aria-labelledby={`${id}-recent`} className="space-y-1">
          <h3 id={`${id}-recent`} className="text-sm font-semibold">
            {t("recent")}
          </h3>
          {overview.recent.length === 0 ? (
            <p className="py-2 text-[0.8125rem] text-muted-foreground">{t("recentEmpty")}</p>
          ) : (
            <ul className="divide-y">
              {overview.recent.map((request) => (
                <RequestRow key={request.id} request={request} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </Panel>
  );
}
