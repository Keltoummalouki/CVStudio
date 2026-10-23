"use server";

import { refresh } from "next/cache";
import { fail, issuesFromZod, mapDatabaseError, ok, type ActionResult } from "@/lib/actions/result";
import { getOwnerContext } from "@/lib/auth/session";
import { aiSettingsSchema, type AiSettingsValues } from "../schemas";

/** Turns AI on or off and sets the daily limit; Postgres enforces the 1–50 range too. */
export async function saveAiSettings(input: unknown): Promise<ActionResult<AiSettingsValues>> {
  const context = await getOwnerContext();
  if (!context) return fail("unauthorized");
  const parsed = aiSettingsSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_input", issuesFromZod(parsed.error));

  const { data, error } = await context.supabase
    .from("owner_settings")
    .upsert(
      {
        owner_id: context.owner.id,
        ai_enabled: parsed.data.enabled,
        ai_daily_limit: parsed.data.dailyLimit,
      },
      { onConflict: "owner_id" },
    )
    .select("ai_enabled, ai_daily_limit")
    .single();
  if (error) return fail(mapDatabaseError(error));

  refresh();
  return ok({ enabled: data.ai_enabled, dailyLimit: data.ai_daily_limit });
}
