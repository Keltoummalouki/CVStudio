import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiSettingsPanel } from "@/features/ai-settings/components/ai-settings-panel";
import { saveAiSettings } from "@/features/ai-settings/server/actions";
import type { AiOverview, AiRequestRow } from "@/features/ai-settings/server/queries";
import { renderWithIntl } from "../../utils/render";

const mocks = vi.hoisted(() => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/features/ai-settings/server/actions", () => ({ saveAiSettings: vi.fn() }));
vi.mock("sonner", () => ({ toast: mocks.toast }));

const request = (overrides: Partial<AiRequestRow>): AiRequestRow => ({
  id: "r1",
  feature: "job_post_analysis",
  status: "succeeded",
  errorCode: null,
  startedAt: "2026-10-23T09:15:00Z",
  durationMs: 2100,
  inputTokens: 900,
  outputTokens: 300,
  thoughtTokens: 50,
  estimatedCostUsd: 0.0021,
  provider: "groq",
  model: "openai/gpt-oss-20b",
  attempts: [{ provider: "groq", status: "succeeded", errorCode: null }],
  ...overrides,
});

const OVERVIEW: AiOverview = {
  mode: "live",
  reason: null,
  providers: [
    { id: "groq", model: "openai/gpt-oss-20b", state: "ready", reason: null },
    { id: "gemini", model: "gemini-3.8-flash", state: "ready", reason: null },
  ],
  settings: { enabled: false, dailyLimit: 10 },
  usedToday: 3,
  resetsAt: "2026-10-24T00:00:00.000Z",
  month: { requests: 12, estimatedCostUsd: 0.0034 },
  lastSuccess: {
    provider: "gemini",
    model: "gemini-3.8-flash",
    startedAt: "2026-10-23T10:00:00Z",
    fallback: true,
  },
  recent: [
    request({}),
    request({
      id: "r2",
      provider: "gemini",
      model: "gemini-3.8-flash",
      startedAt: "2026-10-23T10:00:00Z",
      attempts: [
        { provider: "groq", status: "failed", errorCode: "timeout" },
        { provider: "gemini", status: "succeeded", errorCode: null },
      ],
    }),
    request({
      id: "r3",
      status: "failed",
      errorCode: "something_new",
      startedAt: "2026-10-23T07:00:00Z",
      durationMs: null,
      inputTokens: null,
      outputTokens: null,
      thoughtTokens: null,
      estimatedCostUsd: null,
      provider: null,
      attempts: [],
    }),
  ],
};

beforeEach(() => {
  vi.mocked(saveAiSettings)
    .mockReset()
    .mockResolvedValue({ ok: true, data: { enabled: true, dailyLimit: 25 } });
  mocks.toast.success.mockReset();
});

describe("AiSettingsPanel", () => {
  it("is off until the owner turns it on, and saves the daily limit", async () => {
    const user = userEvent.setup();
    renderWithIntl(<AiSettingsPanel overview={OVERVIEW} />);

    const toggle = screen.getByRole("switch", { name: "Use AI to analyze job posts" });
    expect(toggle).not.toBeChecked();
    expect(toggle).toHaveAccessibleDescription(
      "When you press Analyze, the text of the job post is sent to Groq, or to Gemini when Groq is unavailable. Your CVs and career data are not sent.",
    );

    await user.click(toggle);
    const limit = screen.getByRole("spinbutton", { name: "Daily limit" });
    await user.clear(limit);
    await user.type(limit, "25");
    await user.click(screen.getByRole("button", { name: "Save AI settings" }));

    expect(saveAiSettings).toHaveBeenCalledWith({ enabled: true, dailyLimit: 25 });
    expect(mocks.toast.success).toHaveBeenCalledWith("AI settings saved");
  });

  it.each(["60", "0", "2.5"])("refuses a daily limit of %s", async (value) => {
    const user = userEvent.setup();
    renderWithIntl(<AiSettingsPanel overview={OVERVIEW} />);

    const limit = screen.getByRole("spinbutton", { name: "Daily limit" });
    await user.clear(limit);
    await user.type(limit, value);
    await user.click(screen.getByRole("button", { name: "Save AI settings" }));

    expect(await screen.findByText("Choose a whole number from 1 to 50.")).toBeInTheDocument();
    expect(saveAiSettings).not.toHaveBeenCalled();
  });

  it("reports a failed save without losing the choice", async () => {
    const user = userEvent.setup();
    vi.mocked(saveAiSettings).mockResolvedValue({ ok: false, error: "unavailable" });
    renderWithIntl(<AiSettingsPanel overview={OVERVIEW} />);

    await user.click(screen.getByRole("switch"));
    await user.click(screen.getByRole("button", { name: "Save AI settings" }));

    expect(await screen.findByText(/Couldn’t save the AI settings/)).toBeInTheDocument();
    expect(screen.getByRole("switch")).toBeChecked();
  });

  it("shows the primary and fallback providers and the model of the last analysis", () => {
    renderWithIntl(<AiSettingsPanel overview={OVERVIEW} />);

    const providers = screen.getByRole("region", { name: "Providers" });
    expect(providers).toHaveTextContent("Primary providerGroqReady · openai/gpt-oss-20b");
    expect(providers).toHaveTextContent("Fallback providerGeminiReady · gemini-3.8-flash");
    expect(providers).toHaveTextContent(
      "Gemini answers only when Groq is busy, rate-limited or too slow. An analysis counts once toward the daily limit, even when both are tried.",
    );
    expect(providers).toHaveTextContent(
      "Last analysisgemini-3.8-flash (Gemini, as the fallback) · 10/23/26, 10:00 AM",
    );
    expect(screen.getByText(/Zero Data Retention/)).toBeInTheDocument();
    expect(screen.getByText(/billing turned on/)).toBeInTheDocument();
    // Never a key.
    expect(document.body).not.toHaveTextContent(/gsk_|AIza/);
  });

  it("shows usage, the month's estimated cost and recent requests with the providers they tried", () => {
    renderWithIntl(<AiSettingsPanel overview={OVERVIEW} />);

    expect(screen.getByText("3 of 10 requests")).toBeInTheDocument();
    expect(screen.getByText("$0.0034 · 12 requests")).toBeInTheDocument();
    expect(screen.getByText(/a free-tier key isn’t billed/)).toBeInTheDocument();

    const rows = screen.getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Job post analysis · Succeeded");
    expect(rows[0]).toHaveTextContent("Groq · openai/gpt-oss-20b");
    expect(rows[0]).toHaveTextContent("1,250 tokens");
    expect(rows[0]).toHaveTextContent("$0.0021");
    expect(rows[1]).toHaveTextContent("Groq (took too long) → Gemini · gemini-3.8-flash");
    expect(rows[2]).toHaveTextContent("Failed · unknown error");
    expect(rows[2]).toHaveTextContent("openai/gpt-oss-20b");
  });

  it("explains why a provider is not set up, and sends to the one that is", () => {
    renderWithIntl(
      <AiSettingsPanel
        overview={{
          ...OVERVIEW,
          providers: [
            OVERVIEW.providers[0]!,
            {
              id: "gemini",
              model: "gemini-3.8-flash",
              state: "unavailable",
              reason: "missing_key",
            },
          ],
          lastSuccess: null,
          recent: [],
        }}
      />,
    );

    expect(screen.getByText("Not set up")).toBeInTheDocument();
    expect(
      screen.getByText("Add GEMINI_API_KEY to the server’s environment variables to use it."),
    ).toBeInTheDocument();
    expect(screen.getByRole("switch")).toHaveAccessibleDescription(
      "When you press Analyze, the text of the job post is sent to Groq. Your CVs and career data are not sent.",
    );
    expect(screen.getByText("No analysis yet.")).toBeInTheDocument();
    expect(screen.getByText("No AI requests yet.")).toBeInTheDocument();
  });

  it.each([
    [{ id: "gemini" as const, reason: "debug_logging" as const }, /GOOGLE_GENAI_DEBUG is set/],
    [{ id: "groq" as const, reason: "invalid_key" as const }, /^GROQ_API_KEY doesn’t look like/],
    [{ id: "groq" as const, reason: "invalid_model" as const }, /^GROQ_MODEL isn’t a valid/],
  ])("names the setting to fix: %o", ({ id, reason }, message) => {
    renderWithIntl(
      <AiSettingsPanel
        overview={{
          ...OVERVIEW,
          mode: "unavailable",
          reason: "no_provider",
          providers: [{ id, model: null, state: "unavailable", reason }],
        }}
      />,
    );
    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it("explains a primary provider it does not know", () => {
    renderWithIntl(
      <AiSettingsPanel
        overview={{ ...OVERVIEW, mode: "unavailable", reason: "invalid_primary", providers: [] }}
      />,
    );
    expect(screen.getByText(/AI_PRIMARY_PROVIDER must be groq or gemini/)).toBeInTheDocument();
    expect(screen.getByRole("switch")).toHaveAccessibleDescription(
      /only the text of the job post is sent to an AI provider/,
    );
  });

  it("flags the test providers, in French too", () => {
    renderWithIntl(
      <AiSettingsPanel
        overview={{
          ...OVERVIEW,
          mode: "fake",
          providers: [
            { id: "groq", model: "fake-groq", state: "fake", reason: null },
            { id: "gemini", model: "fake-gemini", state: "fake", reason: null },
          ],
        }}
      />,
      { locale: "fr" },
    );
    expect(screen.getAllByText("Fournisseur de test")).toHaveLength(2);
    expect(screen.getByText(/aucune requête ne quitte le serveur/)).toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: "Utiliser l’IA pour analyser les offres" }),
    ).toBeInTheDocument();
  });
});
