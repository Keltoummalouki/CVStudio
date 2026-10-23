import { z } from "zod";
import { AI_DAILY_LIMIT } from "@/config/ai";

export const aiSettingsSchema = z
  .object({
    enabled: z.boolean(),
    dailyLimit: z
      .number({ error: "outOfRange" })
      .int({ error: "outOfRange" })
      .min(AI_DAILY_LIMIT.min, { error: "outOfRange" })
      .max(AI_DAILY_LIMIT.max, { error: "outOfRange" }),
  })
  .strict();
export type AiSettingsValues = z.infer<typeof aiSettingsSchema>;

/** What an owner who never opened the AI settings gets: AI off. */
export const DEFAULT_AI_SETTINGS: AiSettingsValues = {
  enabled: false,
  dailyLimit: AI_DAILY_LIMIT.default,
};
