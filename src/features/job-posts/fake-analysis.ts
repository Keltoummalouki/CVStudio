import type { AnalysisAnswer } from "./analysis";
import { compileTerm, containsTerm } from "./matching";
import type { RequirementKind } from "./schemas";

/**
 * What the fake provider (AI_FAKE_PROVIDER=1, never on Vercel) answers for a
 * job post: a fixed vocabulary found line by line, so local runs and e2e
 * tests get realistic, repeatable requirements without calling Google.
 */

const VOCABULARY: { label: string; kind: RequirementKind; aliases: string[] }[] = [
  { label: "React", kind: "skill", aliases: ["React.js", "ReactJS"] },
  { label: "React Native", kind: "skill", aliases: [] },
  { label: "TypeScript", kind: "skill", aliases: ["TS"] },
  { label: "JavaScript", kind: "skill", aliases: ["JS"] },
  { label: "Node.js", kind: "skill", aliases: ["NodeJS"] },
  { label: "Next.js", kind: "skill", aliases: ["NextJS"] },
  { label: "Java", kind: "skill", aliases: [] },
  { label: "C#", kind: "skill", aliases: [] },
  { label: ".NET", kind: "skill", aliases: ["dotnet"] },
  { label: "Python", kind: "skill", aliases: [] },
  { label: "PostgreSQL", kind: "tool", aliases: ["Postgres"] },
  { label: "Docker", kind: "tool", aliases: [] },
  { label: "Kubernetes", kind: "tool", aliases: ["K8s"] },
  { label: "English", kind: "language", aliases: ["Anglais"] },
  { label: "French", kind: "language", aliases: ["Français"] },
  { label: "Teamwork", kind: "soft_skill", aliases: ["Travail en équipe"] },
];

const PREFERRED =
  /\b(nice to have|a plus|bonus|ideally|preferred|optional)\b|un plus|souhaité|apprécié/i;
const COMPANY = /^(?:company|entreprise|société)\s*:\s*(.+)$/i;
const FRENCH_WORDS = /\b(et|les|des|vous|nous|avec|pour|une)\b/gi;
const ENGLISH_WORDS = /\b(and|the|you|we|with|for|our)\b/gi;

const COMPILED = VOCABULARY.map((entry) => ({
  entry,
  terms: [entry.label, ...entry.aliases].flatMap((name) => compileTerm(name) ?? []),
}));

export function fakeJobPostAnalysis(input: string): AnalysisAnswer {
  const text = input.replace(/<\/?job_post>/g, "").trim();
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const requirements: AnalysisAnswer["requirements"] = [];
  for (const { entry, terms } of COMPILED) {
    const line = lines.find((candidate) => terms.some((term) => containsTerm(candidate, term)));
    if (!line) continue;
    requirements.push({
      label: entry.label,
      kind: entry.kind,
      importance: PREFERRED.test(line) ? "preferred" : "required",
      aliases: entry.aliases,
      note: "",
    });
  }

  const french = text.match(FRENCH_WORDS)?.length ?? 0;
  const english = text.match(ENGLISH_WORDS)?.length ?? 0;
  return {
    title: lines[0] ?? "",
    company: lines.map((line) => COMPANY.exec(line)?.[1]?.trim()).find(Boolean) ?? "",
    language: french > english ? "fr" : "en",
    titleAliases: [],
    requirements,
  };
}
