import type { AiProviderId } from "@/config/ai";
import type { AiStatus } from "./server/queries";

/** What an AI button needs to know, without exposing configuration details. */
export type AiAccess = {
  state: "ready" | "off" | "unavailable" | "limit";
  /** Test providers answer instead of the real ones. */
  fake: boolean;
  /** Who may receive the text, in the order they are tried. */
  providers: AiProviderId[];
  remaining: number;
  /** When today's count resets (ISO). */
  resetsAt: string;
};

export function toAiAccess(status: AiStatus): AiAccess {
  const remaining = Math.max(0, status.settings.dailyLimit - status.usedToday);
  const state =
    status.mode === "unavailable"
      ? "unavailable"
      : !status.settings.enabled
        ? "off"
        : remaining === 0
          ? "limit"
          : "ready";
  return {
    state,
    fake: status.mode === "fake",
    providers: status.providers
      .filter((provider) => provider.state !== "unavailable")
      .map((provider) => provider.id),
    remaining,
    resetsAt: status.resetsAt,
  };
}
