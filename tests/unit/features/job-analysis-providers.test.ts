import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalysisAnswer } from "@/features/job-posts/analysis";
import type { JobPostDraft } from "@/features/job-posts/schemas";
import { createGeminiProvider, type InteractionsClient } from "@/lib/ai/gemini";
import { createGroqProvider, type ChatClient } from "@/lib/ai/groq";
import type { AiAvailability } from "@/lib/ai/provider";
import { AiProviderError, type AiProvider } from "@/lib/ai/types";
import { createFakeSupabase, ownerContext } from "../../utils/fake-supabase";

/**
 * Job-post analysis end to end on the server, with the real Groq and Gemini
 * providers on stand-in HTTP clients: what each receives, and that both
 * answers become the same reviewed draft. Nothing here calls a network.
 */

const mocks = vi.hoisted(() => ({ getOwnerContext: vi.fn(), getAiAvailability: vi.fn() }));

vi.mock("@/lib/auth/session", () => ({ getOwnerContext: mocks.getOwnerContext }));
vi.mock("@/lib/ai/provider", () => ({ getAiAvailability: mocks.getAiAvailability }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

const { analyzeJobPost } = await import("@/features/job-posts/server/actions");

const FRENCH_POST = [
  "Développeur Full Stack (H/F)",
  "Société : Atelier Numérique",
  "Vous développerez nos applications web avec React et TypeScript.",
  "Nos API tournent sur Node.js et PostgreSQL.",
  "Anglais courant exigé. Une expérience React Native est un plus.",
].join("\n");

/** What a model returns for the French post, a requirement listed twice included. */
const FRENCH_ANSWER: AnalysisAnswer = {
  title: "Développeur Full Stack (H/F)",
  company: "Atelier Numérique",
  language: "fr",
  titleAliases: ["Full Stack Developer", "Développeuse Full Stack", "DEVELOPPEUR FULL STACK (H/F)"],
  requirements: [
    {
      label: "React",
      kind: "skill",
      importance: "required",
      aliases: ["React.js", "ReactJS"],
      note: "",
    },
    { label: "TypeScript", kind: "skill", importance: "required", aliases: ["TS"], note: "" },
    { label: "Node.js", kind: "skill", importance: "required", aliases: ["NodeJS"], note: "" },
    { label: "PostgreSQL", kind: "tool", importance: "required", aliases: ["Postgres"], note: "" },
    {
      label: "Anglais",
      kind: "language",
      importance: "required",
      aliases: ["English"],
      note: "courant",
    },
    { label: "React Native", kind: "skill", importance: "preferred", aliases: [], note: "" },
    { label: "react", kind: "skill", importance: "preferred", aliases: ["React.js"], note: "" },
  ],
};

const ENGLISH_POST = [
  "Senior Backend Engineer",
  "Company: Example Robotics",
  "You will design APIs in Java and Spring Boot, deployed with Docker on AWS.",
  "Strong project management skills. French is a plus.",
].join("\n");

const ENGLISH_ANSWER: AnalysisAnswer = {
  title: "Senior Backend Engineer",
  company: "Example Robotics",
  language: "en",
  titleAliases: ["Ingénieur Backend Senior"],
  requirements: [
    { label: "Java", kind: "skill", importance: "required", aliases: [], note: "" },
    { label: "Spring Boot", kind: "skill", importance: "required", aliases: ["Spring"], note: "" },
    { label: "Docker", kind: "tool", importance: "required", aliases: [], note: "" },
    {
      label: "AWS",
      kind: "tool",
      importance: "required",
      aliases: ["Amazon Web Services"],
      note: "",
    },
    {
      label: "Project management",
      kind: "soft_skill",
      importance: "required",
      aliases: ["Gestion de projet"],
      note: "strong",
    },
    { label: "French", kind: "language", importance: "preferred", aliases: ["Français"], note: "" },
  ],
};

function groqClient(answer: unknown) {
  const create = vi.fn(async () => ({
    choices: [{ finish_reason: "stop", message: { content: JSON.stringify(answer) } }],
    usage: {
      prompt_tokens: 1_200,
      completion_tokens: 600,
      completion_tokens_details: { reasoning_tokens: 150 },
    },
  }));
  return { client: { chat: { completions: { create } } } satisfies ChatClient, create };
}

function geminiClient(answer: unknown) {
  const create = vi.fn(async () => ({
    status: "completed",
    output_text: JSON.stringify(answer),
    usage: { total_input_tokens: 1_300, total_output_tokens: 500, total_thought_tokens: 90 },
  }));
  return { client: { interactions: { create } } satisfies InteractionsClient, create };
}

const offline = (code: "timeout" | "overloaded"): AiProvider => ({
  id: "groq",
  model: "openai/gpt-oss-20b",
  generateJson: async () => {
    throw new AiProviderError(code, { retryable: false });
  },
});

function useChain(...chain: [AiProvider, ...AiProvider[]]) {
  const availability: AiAvailability = { status: "ready", mode: "live", chain, providers: [] };
  mocks.getAiAvailability.mockReturnValue(availability);
}

function signIn() {
  const fake = createFakeSupabase({
    rpc: { begin_ai_request: { data: "7b1f0c2e-3d4a-4b5c-8d6e-9f0a1b2c3d4e" } },
  });
  mocks.getOwnerContext.mockResolvedValue(ownerContext(fake));
  return fake;
}

/** A draft without its generated requirement ids, to compare two analyses. */
const withoutIds = (draft: JobPostDraft) => ({
  ...draft,
  requirements: {
    ...draft.requirements,
    items: draft.requirements.items.map(({ id: _id, ...item }) => item),
  },
});

async function analyze(description: string) {
  const result = await analyzeJobPost({ description });
  if (!result.ok) throw new Error(`analysis failed: ${result.error}`);
  return result.data;
}

beforeEach(() => {
  mocks.getOwnerContext.mockReset();
  mocks.getAiAvailability.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("job-post analysis through Groq", () => {
  it("reads a French post into a French draft, keeping French names and their English equivalents", async () => {
    signIn();
    const groq = groqClient(FRENCH_ANSWER);
    useChain(createGroqProvider(groq.client, "openai/gpt-oss-20b"));

    const draft = await analyze(FRENCH_POST);

    expect(draft).toMatchObject({
      title: "Développeur Full Stack (H/F)",
      company: "Atelier Numérique",
      language: "fr",
      description: FRENCH_POST,
      analyzed: true,
      // The title itself, written differently, is not another name for it.
      requirements: { titleAliases: ["Full Stack Developer", "Développeuse Full Stack"] },
    });
    expect(
      draft.requirements.items.map(({ label, importance, aliases, note }) => [
        label,
        importance,
        aliases,
        note,
      ]),
    ).toEqual([
      // Listed twice by the model: one requirement, and required wins. Spellings
      // the matcher treats as one ("ReactJS" = "React.js") are not kept twice.
      ["React", "required", ["React.js"], ""],
      ["TypeScript", "required", ["TS"], ""],
      ["Node.js", "required", [], ""],
      ["PostgreSQL", "required", ["Postgres"], ""],
      ["Anglais", "required", ["English"], "courant"],
      // React Native stays apart from React.
      ["React Native", "preferred", [], ""],
    ]);

    // Groq received the instructions and the tagged post, nothing else.
    const [body] = groq.create.mock.calls[0] as unknown as [{ messages: unknown[] }];
    expect(body.messages).toEqual([
      { role: "system", content: expect.stringContaining("untrusted data") },
      { role: "user", content: `<job_post>\n${FRENCH_POST}\n</job_post>` },
    ]);
  });

  it("reads an English post into an English draft with French equivalents", async () => {
    signIn();
    useChain(createGroqProvider(groqClient(ENGLISH_ANSWER).client, "openai/gpt-oss-20b"));

    const draft = await analyze(ENGLISH_POST);

    expect(draft).toMatchObject({
      title: "Senior Backend Engineer",
      company: "Example Robotics",
      language: "en",
      requirements: { titleAliases: ["Ingénieur Backend Senior"] },
    });
    expect(
      draft.requirements.items.map(({ label, kind, importance, aliases }) => [
        label,
        kind,
        importance,
        aliases,
      ]),
    ).toEqual([
      ["Java", "skill", "required", []],
      ["Spring Boot", "skill", "required", ["Spring"]],
      ["Docker", "tool", "required", []],
      ["AWS", "tool", "required", ["Amazon Web Services"]],
      ["Project management", "soft_skill", "required", ["Gestion de projet"]],
      ["French", "language", "preferred", ["Français"]],
    ]);
  });

  it("refuses an answer outside the schema instead of guessing", async () => {
    signIn();
    const gemini = geminiClient(FRENCH_ANSWER);
    useChain(
      createGroqProvider(
        groqClient({ ...FRENCH_ANSWER, language: "de" }).client,
        "openai/gpt-oss-20b",
      ),
      createGeminiProvider(gemini.client, "gemini-3.8-flash"),
    );

    expect(await analyzeJobPost({ description: FRENCH_POST })).toEqual({
      ok: false,
      error: "ai_invalid_response",
      provider: "groq",
    });
    expect(gemini.create).not.toHaveBeenCalled();
  });
});

describe("Gemini as the fallback", () => {
  it("makes the same draft from the same answer as Groq does", async () => {
    signIn();
    useChain(createGroqProvider(groqClient(FRENCH_ANSWER).client, "openai/gpt-oss-20b"));
    const fromGroq = await analyze(FRENCH_POST);

    const fake = signIn();
    const gemini = geminiClient(FRENCH_ANSWER);
    useChain(offline("overloaded"), createGeminiProvider(gemini.client, "gemini-3.8-flash"));
    const fromGemini = await analyze(FRENCH_POST);

    expect(withoutIds(fromGemini)).toEqual(withoutIds(fromGroq));
    // Gemini keeps its own request settings: never stored, the same tagged post.
    expect(gemini.create).toHaveBeenCalledWith(
      expect.objectContaining({
        store: false,
        input: `<job_post>\n${FRENCH_POST}\n</job_post>`,
      }),
      expect.anything(),
    );
    // Still one request against the daily quota.
    const begins = fake.client.rpc.mock.calls.filter(([name]) => name === "begin_ai_request");
    expect(begins).toHaveLength(1);
  });
});
