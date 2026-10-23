import "server-only";
import { AI_FEATURES, AI_PROVIDERS, type AiFeature, type AiProviderId } from "@/config/ai";
import { getAiAvailability, type AiProviderStatus } from "@/lib/ai/provider";
import { requireOwner, type OwnerContext } from "@/lib/auth/session";
import { DataAccessError } from "@/lib/data/errors";
import { DEFAULT_AI_SETTINGS, type AiSettingsValues } from "../schemas";

export type AiStatus = {
  /** "fake": test providers answer; "unavailable": none can, `reason` and `providers` say why. */
  mode: "live" | "fake" | "unavailable";
  reason: "no_provider" | "invalid_primary" | null;
  /** Every configured provider, primary first. */
  providers: AiProviderStatus[];
  settings: AiSettingsValues;
  /** Requests started today (UTC), failed ones included: the quota counts them. */
  usedToday: number;
  /** The next midnight UTC, when the daily count starts again. */
  resetsAt: string;
};

export type AiAttemptRow = {
  provider: AiProviderId;
  status: "succeeded" | "failed";
  errorCode: string | null;
};

export type AiRequestRow = {
  id: string;
  feature: AiFeature;
  status: "pending" | "succeeded" | "failed";
  errorCode: string | null;
  startedAt: string;
  durationMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  thoughtTokens: number | null;
  estimatedCostUsd: number | null;
  /** The provider and model that answered, or the last ones tried. */
  provider: AiProviderId | null;
  model: string;
  /** The providers tried, in order: two after a fallback. */
  attempts: AiAttemptRow[];
};

export type AiOverview = AiStatus & {
  month: { requests: number; estimatedCostUsd: number };
  /** Which model answered the latest successful request. */
  lastSuccess: {
    provider: AiProviderId | null;
    model: string;
    startedAt: string;
    /** Another provider was tried first. */
    fallback: boolean;
  } | null;
  recent: AiRequestRow[];
};

const DAY_MS = 86_400_000;
const RECENT_LIMIT = 10;
/** 50 requests a day at most: a month never holds more than ~1,550 rows. */
const MONTH_LIMIT = 2_000;
const STATUSES = new Set(["pending", "succeeded", "failed"]);

const utcDayStart = (now: Date) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

const toProvider = (value: string | null): AiProviderId | null =>
  (AI_PROVIDERS as readonly string[]).includes(value ?? "") ? (value as AiProviderId) : null;

type AttemptSource = {
  position: number;
  provider: string;
  status: string;
  error_code: string | null;
};

function readAttempts(rows: AttemptSource[]): AiAttemptRow[] {
  return [...rows]
    .sort((a, b) => a.position - b.position)
    .flatMap((row): AiAttemptRow[] => {
      const provider = toProvider(row.provider);
      return provider && (row.status === "succeeded" || row.status === "failed")
        ? [{ provider, status: row.status, errorCode: row.error_code }]
        : [];
    });
}

async function readSettings({ supabase, owner }: OwnerContext): Promise<AiSettingsValues> {
  const { data, error } = await supabase
    .from("owner_settings")
    .select("ai_enabled, ai_daily_limit")
    .eq("owner_id", owner.id)
    .maybeSingle();
  if (error) throw new DataAccessError("read owner settings", { cause: error });
  return data ? { enabled: data.ai_enabled, dailyLimit: data.ai_daily_limit } : DEFAULT_AI_SETTINGS;
}

async function countSince({ supabase, owner }: OwnerContext, since: Date): Promise<number> {
  const { count, error } = await supabase
    .from("ai_requests")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", owner.id)
    .gte("started_at", since.toISOString());
  if (error) throw new DataAccessError("count AI requests", { cause: error });
  return count ?? 0;
}

/** Whether AI can run now, with which providers, and how much of today's quota is left. */
export async function getAiStatus(at?: Date): Promise<AiStatus> {
  const context = await requireOwner();
  // Read the clock only after the owner check, which makes the render dynamic.
  const now = at ?? new Date();
  const availability = getAiAvailability();
  const dayStart = utcDayStart(now);
  const [settings, usedToday] = await Promise.all([
    readSettings(context),
    countSince(context, dayStart),
  ]);
  return {
    mode: availability.status === "ready" ? availability.mode : "unavailable",
    reason: availability.status === "ready" ? null : availability.reason,
    providers: availability.providers,
    settings,
    usedToday,
    resetsAt: new Date(dayStart.getTime() + DAY_MS).toISOString(),
  };
}

/**
 * Settings page: status, the month's estimated cost, the model of the last
 * successful request and the latest requests with the providers they tried
 * (metadata only).
 */
export async function getAiOverview(at?: Date): Promise<AiOverview> {
  const { supabase, owner } = await requireOwner();
  const now = at ?? new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [status, recent, month, lastSuccess] = await Promise.all([
    getAiStatus(now),
    supabase
      .from("ai_requests")
      .select(
        "id, feature, status, error_code, started_at, duration_ms, input_tokens, output_tokens, thought_tokens, estimated_cost_usd, provider, model, ai_request_attempts(position, provider, status, error_code)",
      )
      .eq("owner_id", owner.id)
      .order("started_at", { ascending: false })
      .limit(RECENT_LIMIT),
    supabase
      .from("ai_requests")
      .select("estimated_cost_usd")
      .eq("owner_id", owner.id)
      .gte("started_at", monthStart.toISOString())
      .limit(MONTH_LIMIT),
    supabase
      .from("ai_requests")
      .select("provider, model, started_at, ai_request_attempts(position)")
      .eq("owner_id", owner.id)
      .eq("status", "succeeded")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (recent.error) throw new DataAccessError("list AI requests", { cause: recent.error });
  if (month.error) throw new DataAccessError("sum AI costs", { cause: month.error });
  if (lastSuccess.error) {
    throw new DataAccessError("read the last AI request", { cause: lastSuccess.error });
  }

  const monthCost = month.data.reduce((sum, row) => sum + (row.estimated_cost_usd ?? 0), 0);
  return {
    ...status,
    month: {
      requests: month.data.length,
      estimatedCostUsd: Math.round(monthCost * 1_000_000) / 1_000_000,
    },
    lastSuccess: lastSuccess.data
      ? {
          provider: toProvider(lastSuccess.data.provider),
          model: lastSuccess.data.model,
          startedAt: lastSuccess.data.started_at,
          fallback: lastSuccess.data.ai_request_attempts.length > 1,
        }
      : null,
    recent: recent.data.flatMap((row): AiRequestRow[] =>
      (AI_FEATURES as readonly string[]).includes(row.feature) && STATUSES.has(row.status)
        ? [
            {
              id: row.id,
              feature: row.feature as AiFeature,
              status: row.status as AiRequestRow["status"],
              errorCode: row.error_code,
              startedAt: row.started_at,
              durationMs: row.duration_ms,
              inputTokens: row.input_tokens,
              outputTokens: row.output_tokens,
              thoughtTokens: row.thought_tokens,
              estimatedCostUsd: row.estimated_cost_usd,
              provider: toProvider(row.provider),
              model: row.model,
              attempts: readAttempts(row.ai_request_attempts),
            },
          ]
        : [],
    ),
  };
}
