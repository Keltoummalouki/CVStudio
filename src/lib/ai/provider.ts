import "server-only";
import type { AiProviderId } from "@/config/ai";
import {
  getAiProviderConfig,
  type AiProviderConfig,
  type AiUnavailableReason,
  type ProviderSetup,
} from "@/lib/env/ai";
import { createFakeProvider } from "./fake";
import { createGeminiClient, createGeminiProvider } from "./gemini";
import { createGroqClient, createGroqProvider } from "./groq";
import type { AiProvider } from "./types";

/** One configured provider as Settings shows it: never its key. */
export type AiProviderStatus = {
  id: AiProviderId;
  model: string | null;
  state: "ready" | "fake" | "unavailable";
  reason: AiUnavailableReason | null;
};

export type AiAvailability =
  | {
      status: "ready";
      mode: "live" | "fake";
      /** The providers that can answer, in the order they are tried. */
      chain: [AiProvider, ...AiProvider[]];
      providers: AiProviderStatus[];
    }
  | {
      status: "unavailable";
      reason: "no_provider" | "invalid_primary";
      providers: AiProviderStatus[];
    };

const FACTORIES: Record<AiProviderId, (apiKey: string, model: string) => AiProvider> = {
  groq: (apiKey, model) => createGroqProvider(createGroqClient(apiKey), model),
  gemini: (apiKey, model) => createGeminiProvider(createGeminiClient(apiKey), model),
};

const clients = new Map<AiProviderId, { apiKey: string; model: string; provider: AiProvider }>();

/** Each client is created once per server instance, key and model. */
function liveProvider(setup: Extract<ProviderSetup, { status: "ready" }>): AiProvider {
  const cached = clients.get(setup.id);
  if (cached?.apiKey === setup.apiKey && cached.model === setup.model) return cached.provider;
  const provider = FACTORIES[setup.id](setup.apiKey, setup.model);
  clients.set(setup.id, { apiKey: setup.apiKey, model: setup.model, provider });
  return provider;
}

function toStatus(setup: ProviderSetup): AiProviderStatus {
  return setup.status === "ready"
    ? { id: setup.id, model: setup.model, state: "ready", reason: null }
    : { id: setup.id, model: setup.model, state: "unavailable", reason: setup.reason };
}

/** The configured providers: those that can answer, primary first, and why the others cannot. */
export function getAiAvailability(
  config: AiProviderConfig = getAiProviderConfig(),
): AiAvailability {
  switch (config.kind) {
    case "invalid_primary":
      return { status: "unavailable", reason: "invalid_primary", providers: [] };
    case "fake": {
      const fakes = config.order.map(createFakeProvider);
      const [first, ...rest] = fakes;
      const providers = fakes.map(({ id, model }): AiProviderStatus => ({
        id,
        model,
        state: "fake",
        reason: null,
      }));
      return first
        ? { status: "ready", mode: "fake", chain: [first, ...rest], providers }
        : { status: "unavailable", reason: "no_provider", providers };
    }
    case "live": {
      const [first, ...rest] = config.providers.flatMap((setup) =>
        setup.status === "ready" ? [liveProvider(setup)] : [],
      );
      const providers = config.providers.map(toStatus);
      return first
        ? { status: "ready", mode: "live", chain: [first, ...rest], providers }
        : { status: "unavailable", reason: "no_provider", providers };
    }
  }
}
