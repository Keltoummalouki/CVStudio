import type { Requirement, RequirementImportance, RequirementsDocument } from "./schemas";

/**
 * Deterministic keyword matching between a job's requirements and CV text:
 * the "ATS match score", an estimate of keyword coverage (CLAUDE.md §16). No
 * AI runs here.
 *
 * Terms. Text is split into terms that keep technical names whole: "C++",
 * "C#", ".NET", "Node.js", "ASP.NET", "Objective-C", "R&D". Terms compare
 * without accents or case; hyphens are ignored ("front-end" = "frontend"),
 * "nodejs" reads as "node.js", and a few French and English function words
 * ("de", "the", …) are skipped inside phrases. A requirement is found when its
 * name, or one of its other names, appears as a whole term or phrase:
 * - "Java" is not found in "JavaScript", "C" not in "C++", "SQL" not in "NoSQL";
 * - "React" is not found in "React Native", which is another technology;
 * - "React" is found in "React.js", ".NET" in "ASP.NET", "API" in "APIs",
 *   "HTML" in "HTML5", "front end" in "front-end";
 * - one- or two-letter names ("Go", "R", "AI", "IT") must be written with a
 *   capital, so the verb "go" or the French "j'ai" never count.
 *
 * Score. Each requirement counts once, however often its terms appear:
 *   score = round(100 × Σ weight(found) / Σ weight(all requirements))
 * with weight 2 for a required item and 1 for a nice-to-have. Only text the CV
 * shows counts, as printed, per-CV wording included. A requirement absent from
 * the CV but present elsewhere in the career data is reported as hidden and
 * earns nothing. The job-title check is reported apart from the score.
 */

export const REQUIREMENT_WEIGHTS: Record<RequirementImportance, number> = {
  required: 2,
  preferred: 1,
};

/** Evidence lines kept per requirement. */
export const MAX_EVIDENCE = 3;

// ---------------------------------------------------------------------------
// Text fragments: what can be matched, and where it sits
// ---------------------------------------------------------------------------

export type CvTextField =
  | "headerTitle"
  | "summary"
  | "sectionTitle"
  | "skillGroup"
  | "skill"
  | "role"
  | "entryTitle"
  | "organization"
  | "place"
  | "bullet"
  | "paragraph"
  | "technology"
  | "listItem"
  | "listDetail"
  | "subsectionTitle"
  | "customLabel"
  | "customText";

export type CareerRecordKind =
  | "profile"
  | "skills"
  | "experience"
  | "education"
  | "projects"
  | "certifications"
  | "soft_skills"
  | "languages"
  | "custom";

export type FragmentLocation =
  | {
      scope: "cv";
      field: CvTextField;
      /** The section heading as printed; null for the header. */
      section: string | null;
      /** The entry, group or subsection the text belongs to. */
      item: string | null;
    }
  | { scope: "career"; record: CareerRecordKind; item: string | null };

export type TextFragment = { text: string; where: FragmentLocation };

// ---------------------------------------------------------------------------
// Terms
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "of",
  "in",
  "on",
  "for",
  "to",
  "with",
  "at",
  "by",
  "as",
  "from",
  "s",
  "t",
  "de",
  "des",
  "du",
  "d",
  "la",
  "le",
  "les",
  "l",
  "un",
  "une",
  "et",
  "ou",
  "en",
  "au",
  "aux",
  "pour",
  "avec",
  "sur",
  "par",
  "dans",
]);

/** AngularJS (1.x) and Angular (2+) are different frameworks. */
const JS_STEM_EXCEPTIONS = new Set(["angular"]);

/** Phrases naming another technology than their first word ("React" ≠ "React Native"). */
const DISTINCT_COMPOUNDS = ["react native", "java script"];

const DASHES = /[‐-―−]/g;
/** Letters and digits, joined by ".", "-" or "&", with a leading "." (".NET") or trailing "+"/"#". */
const TERM = /(?<![\p{L}\p{N}])\.?[\p{L}\p{N}]+(?:[.\-&][\p{L}\p{N}]+)*[+#]*/gu;

type Token = {
  /** Accents removed, lowercase, without hyphens; "nodejs" becomes "node.js". */
  canon: string;
  /** Every form this token satisfies: itself, its singular, "react" for "react.js"… */
  keys: readonly string[];
  /** Written with at least one capital. */
  upper: boolean;
  stop: boolean;
  start: number;
  end: number;
};

function canonical(raw: string): string {
  const folded = raw.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/-/g, "");
  const js = /^([\p{L}\p{N}]{2,})\.?js$/u.exec(folded)?.[1];
  return js && !folded.startsWith(".") ? `${js}.js` : folded;
}

/** "apis" → "api", "projets" → "projet"; never "css", "sas" or "business". */
function singular(canon: string): string | null {
  const base = /^(\p{L}{3,})s$/u.exec(canon)?.[1];
  return base && !base.endsWith("s") ? base : null;
}

/** Forms a CV term satisfies: a specific name also counts for its general one. */
function textKeys(canon: string): string[] {
  const keys = new Set([canon]);
  const js = /^(.+)\.js$/.exec(canon)?.[1];
  if (js && !JS_STEM_EXCEPTIONS.has(js)) keys.add(js);
  if (/^\p{L}+\.net$/u.test(canon)) keys.add(".net");
  const unversioned = /^(\p{L}{3,})\d{1,2}$/u.exec(canon)?.[1];
  if (unversioned) keys.add(unversioned);
  const one = singular(canon);
  if (one) keys.add(one);
  return [...keys];
}

/** Forms a requirement term accepts: itself and its singular, nothing broader. */
function termKeys(canon: string): string[] {
  const one = singular(canon);
  return one ? [canon, one] : [canon];
}

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  // Same-length replacement: offsets stay valid for evidence snippets.
  for (const match of text.replace(DASHES, "-").matchAll(TERM)) {
    const raw = match[0];
    const start = match.index;
    const canon = canonical(raw);
    if (!canon) continue;
    const lower = raw === raw.toLowerCase();
    tokens.push({
      canon,
      keys: textKeys(canon),
      upper: !lower,
      stop: lower && STOPWORDS.has(canon),
      start,
      end: start + raw.length,
    });
  }
  return tokens;
}

export type CompiledTerm = {
  /** Accepted forms per token, in order. */
  tokens: readonly (readonly string[])[];
  /** The phrase written as one word ("front end" → "frontend"). */
  joined: string | null;
  /** One- or two-letter names only match when written with a capital. */
  capitalized: boolean;
};

export function compileTerm(text: string): CompiledTerm | null {
  const all = tokenize(text);
  const content = all.filter((token) => !token.stop);
  const tokens = content.length > 0 ? content : all;
  const first = tokens[0];
  if (!first) return null;
  return {
    tokens: tokens.map((token) => termKeys(token.canon)),
    joined: tokens.length > 1 ? canonical(tokens.map((token) => token.canon).join("")) : null,
    capitalized: tokens.length === 1 && /^\p{L}{1,2}$/u.test(first.canon),
  };
}

/** Identity of a term, to spot duplicates: "React.js", "reactjs" and "ReactJS" are one term. */
export function termKey(text: string): string {
  const compiled = compileTerm(text);
  return compiled ? compiled.tokens.map((keys) => keys[keys.length - 1]).join(" ") : "";
}

// ---------------------------------------------------------------------------
// Index
// ---------------------------------------------------------------------------

type Occurrence = { fragment: number; start: number; span: number };

type IndexedFragment = {
  fragment: TextFragment;
  tokens: Token[];
  /** Token ranges [from, to) covered by a distinct compound such as "React Native". */
  compounds: (readonly [number, number])[];
};

export type TextIndex = {
  fragments: IndexedFragment[];
  byKey: Map<string, Occurrence[]>;
};

const COMPOUNDS = DISTINCT_COMPOUNDS.map((phrase) => tokenize(phrase).map((token) => token.canon));

function findCompounds(tokens: readonly Token[]): (readonly [number, number])[] {
  const ranges: (readonly [number, number])[] = [];
  for (const compound of COMPOUNDS) {
    for (let start = 0; start + compound.length <= tokens.length; start += 1) {
      if (compound.every((canon, offset) => tokens[start + offset]?.canon === canon)) {
        ranges.push([start, start + compound.length]);
      }
    }
  }
  return ranges;
}

export function indexTexts(fragments: readonly TextFragment[]): TextIndex {
  const byKey = new Map<string, Occurrence[]>();
  const add = (key: string, occurrence: Occurrence) => {
    const list = byKey.get(key);
    if (list) list.push(occurrence);
    else byKey.set(key, [occurrence]);
  };

  const indexed = fragments.map((fragment, index): IndexedFragment => {
    const tokens = tokenize(fragment.text).filter((token) => !token.stop);
    tokens.forEach((token, position) => {
      for (const key of token.keys) add(key, { fragment: index, start: position, span: 1 });
      // Two words written apart still name one thing: "front end", "Node JS".
      const next = tokens[position + 1];
      if (next) {
        for (const key of textKeys(canonical(token.canon + next.canon))) {
          add(key, { fragment: index, start: position, span: 2 });
        }
      }
    });
    return { fragment, tokens, compounds: findCompounds(tokens) };
  });
  return { fragments: indexed, byKey };
}

function insideCompound(fragment: IndexedFragment, { start, span }: Occurrence): boolean {
  return fragment.compounds.some(
    ([from, to]) => start >= from && start + span <= to && span < to - from,
  );
}

function occurrencesOf(term: CompiledTerm, index: TextIndex): Occurrence[] {
  const found = new Map<string, Occurrence>();
  const keep = (occurrence: Occurrence) => {
    const fragment = index.fragments[occurrence.fragment];
    if (!fragment || insideCompound(fragment, occurrence)) return;
    const id = `${occurrence.fragment}:${occurrence.start}`;
    if (!found.has(id)) found.set(id, occurrence);
  };

  const [first, ...rest] = term.tokens;
  for (const key of first ?? []) {
    for (const candidate of index.byKey.get(key) ?? []) {
      const tokens = index.fragments[candidate.fragment]?.tokens ?? [];
      const head = tokens[candidate.start];
      if (!head) continue;
      if (rest.length === 0) {
        // One word may match two written apart ("Node JS"), short names only as written.
        if (!term.capitalized || (candidate.span === 1 && head.upper)) keep(candidate);
        continue;
      }
      if (candidate.span !== 1) continue;
      const follows = rest.every((keys, offset) => {
        const token = tokens[candidate.start + offset + 1];
        return token !== undefined && keys.some((accepted) => token.keys.includes(accepted));
      });
      if (follows) keep({ ...candidate, span: term.tokens.length });
    }
  }
  if (term.joined) {
    for (const candidate of index.byKey.get(term.joined) ?? []) keep(candidate);
  }
  return [...found.values()].sort((a, b) => a.fragment - b.fragment || a.start - b.start);
}

/** True when the term appears in the text, by the same rules as the score. */
export function containsTerm(text: string, term: CompiledTerm): boolean {
  const index = indexTexts([{ text, where: { scope: "career", record: "profile", item: null } }]);
  return occurrencesOf(term, index).length > 0;
}

// ---------------------------------------------------------------------------
// Evidence and score
// ---------------------------------------------------------------------------

export type Evidence = {
  where: FragmentLocation;
  /** The matched words as written, with some context on each side. */
  before: string;
  match: string;
  after: string;
};

const CONTEXT_CHARS = 48;

function leading(text: string): string {
  if (text.length <= CONTEXT_CHARS) return text;
  const cut = text.slice(-CONTEXT_CHARS);
  const space = cut.indexOf(" ");
  return `…${space >= 0 ? cut.slice(space + 1) : cut}`;
}

function trailing(text: string): string {
  if (text.length <= CONTEXT_CHARS) return text;
  const cut = text.slice(0, CONTEXT_CHARS);
  const space = cut.lastIndexOf(" ");
  return `${space > 0 ? cut.slice(0, space) : cut}…`;
}

function evidenceOf(index: TextIndex, occurrence: Occurrence): Evidence | null {
  const fragment = index.fragments[occurrence.fragment];
  const first = fragment?.tokens[occurrence.start];
  const last = fragment?.tokens[occurrence.start + occurrence.span - 1];
  if (!fragment || !first || !last) return null;
  const { text, where } = fragment.fragment;
  return {
    where,
    before: leading(text.slice(0, first.start)),
    match: text.slice(first.start, last.end),
    after: trailing(text.slice(last.end)),
  };
}

/** Up to MAX_EVIDENCE places, one per text, in document order. */
function collectEvidence(
  terms: readonly CompiledTerm[],
  index: TextIndex,
  accept: (fragment: TextFragment) => boolean = () => true,
): Evidence[] {
  const firstPerFragment = new Map<number, Occurrence>();
  for (const term of terms) {
    for (const occurrence of occurrencesOf(term, index)) {
      const fragment = index.fragments[occurrence.fragment];
      if (!fragment || !accept(fragment.fragment)) continue;
      const kept = firstPerFragment.get(occurrence.fragment);
      if (!kept || occurrence.start < kept.start) {
        firstPerFragment.set(occurrence.fragment, occurrence);
      }
    }
  }
  return [...firstPerFragment.values()]
    .sort((a, b) => a.fragment - b.fragment)
    .slice(0, MAX_EVIDENCE)
    .flatMap((occurrence) => evidenceOf(index, occurrence) ?? []);
}

export type CompiledRequirements = {
  title: CompiledTerm[];
  items: { requirement: Requirement; terms: CompiledTerm[] }[];
};

const compileAll = (texts: readonly string[]) => texts.flatMap((text) => compileTerm(text) ?? []);

export function compileRequirements(
  title: string,
  requirements: RequirementsDocument,
): CompiledRequirements {
  return {
    title: title.trim() ? compileAll([title, ...requirements.titleAliases]) : [],
    items: requirements.items.map((requirement) => ({
      requirement,
      terms: compileAll([requirement.label, ...requirement.aliases]),
    })),
  };
}

export type RequirementStatus = "matched" | "hidden" | "missing";

export type RequirementResult = {
  requirement: Requirement;
  status: RequirementStatus;
  /** Where the CV shows it (matched) or where the career data has it (hidden). */
  evidence: Evidence[];
};

type Tally = { matched: number; total: number };

export type MatchReport = {
  /** Null when the job has no requirements. */
  score: number | null;
  required: Tally;
  preferred: Tally;
  hidden: number;
  title: { status: "matched" | "missing" | "none"; evidence: Evidence[] };
  requirements: RequirementResult[];
};

/** The job title is looked for where a CV states one: its title and its roles. */
const TITLE_FIELDS: ReadonlySet<CvTextField> = new Set(["headerTitle", "role"]);

export function matchCv(
  compiled: CompiledRequirements,
  visible: TextIndex,
  career: TextIndex | null,
): MatchReport {
  const tallies: Record<RequirementImportance, Tally> = {
    required: { matched: 0, total: 0 },
    preferred: { matched: 0, total: 0 },
  };
  let earned = 0;
  let possible = 0;
  let hidden = 0;

  const requirements = compiled.items.map(({ requirement, terms }): RequirementResult => {
    const weight = REQUIREMENT_WEIGHTS[requirement.importance];
    const tally = tallies[requirement.importance];
    possible += weight;
    tally.total += 1;

    const evidence = collectEvidence(terms, visible);
    if (evidence.length > 0) {
      earned += weight;
      tally.matched += 1;
      return { requirement, status: "matched", evidence };
    }
    const elsewhere = career ? collectEvidence(terms, career) : [];
    if (elsewhere.length > 0) {
      hidden += 1;
      return { requirement, status: "hidden", evidence: elsewhere };
    }
    return { requirement, status: "missing", evidence: [] };
  });

  const titleEvidence = collectEvidence(
    compiled.title,
    visible,
    (fragment) => fragment.where.scope === "cv" && TITLE_FIELDS.has(fragment.where.field),
  );

  return {
    score: possible === 0 ? null : Math.round((100 * earned) / possible),
    required: tallies.required,
    preferred: tallies.preferred,
    hidden,
    title: {
      status:
        compiled.title.length === 0 ? "none" : titleEvidence.length > 0 ? "matched" : "missing",
      evidence: titleEvidence,
    },
    requirements,
  };
}
