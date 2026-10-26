import { TAILORED_PROJECTS, type TailoringAnswer } from "./tailoring";

/**
 * What the fake provider (AI_FAKE_PROVIDER=1, never on Vercel) answers to a
 * tailoring request, read back from the request itself so local runs and e2e
 * tests get a realistic, repeatable choice without calling a provider: the
 * first projects listed (the best keyword matches) with what they match as
 * the reason, the skills the job names, and the job title as written.
 */
export function fakeTailoringAnswer(input: string): TailoringAnswer {
  const projects: TailoringAnswer["projects"] = [];
  let current: { id: string; reason: string } | null = null;
  for (const line of input.split("\n")) {
    const start = /^(P\d+): /.exec(line);
    if (start?.[1]) {
      current = { id: start[1], reason: "Closest to the job's kind of work." };
      projects.push(current);
      continue;
    }
    const matches = /^ {2}matches: (.+)$/.exec(line);
    if (matches?.[1] && current) current.reason = `Uses ${matches[1]}, which the job asks for.`;
  }

  const skills = [...input.matchAll(/(S\d+) [^;(\n]+\((?:matches: |in the job title)/g)].flatMap(
    (match) => (match[1] ? [match[1]] : []),
  );
  const title = /^title: (.+)$/m.exec(input)?.[1] ?? "";
  return { projects: projects.slice(0, TAILORED_PROJECTS), skills, title };
}
