import { describe, expect, it } from "vitest";
import {
  compileRequirements,
  compileTerm,
  containsTerm,
  indexTexts,
  matchCv,
  termKey,
  type TextFragment,
} from "@/features/job-posts/matching";
import type {
  Requirement,
  RequirementImportance,
  RequirementsDocument,
} from "@/features/job-posts/schemas";

function term(name: string) {
  const compiled = compileTerm(name);
  if (!compiled) throw new Error(`"${name}" has no term`);
  return compiled;
}

const found = (name: string, text: string) => containsTerm(text, term(name));

let nextId = 0;
function requirement(
  label: string,
  importance: RequirementImportance = "required",
  aliases: string[] = [],
): Requirement {
  nextId += 1;
  return {
    id: `00000000-0000-4000-8000-${String(nextId).padStart(12, "0")}`,
    label,
    kind: "skill",
    importance,
    aliases,
    note: "",
  };
}

const document = (items: Requirement[], titleAliases: string[] = []): RequirementsDocument => ({
  schemaVersion: 1,
  titleAliases,
  items,
});

const cv = (
  text: string,
  field: Extract<TextFragment["where"], { scope: "cv" }>["field"] = "bullet",
  section: string | null = "Experience",
  item: string | null = "Developer",
): TextFragment => ({ text, where: { scope: "cv", field, section, item } });

const career = (text: string, item: string | null = null): TextFragment => ({
  text,
  where: { scope: "career", record: "skills", item },
});

describe("technical names keep their identity", () => {
  it.each([
    ["C++", "Systems work in C++ and Rust.", true],
    ["C", "Systems work in C++ and Rust.", false],
    ["C#", "APIs in C#, with .NET 8.", true],
    ["C", "APIs in C#.", false],
    ["C", "Firmware in C/C++.", true],
    [".NET", "APIs in C#, with .NET 8.", true],
    [".NET", "Web apps on ASP.NET Core", true],
    ["Node.js", "REST APIs with Node.js.", true],
    ["Node.js", "Backends in NodeJS and Express", true],
    ["Node.js", "Node JS microservices", true],
    ["Node.js", "Each node in the graph", false],
    ["Java", "Front end in JavaScript", false],
    ["Java", "Widgets in Java Script", false],
    ["JavaScript", "Widgets in Java Script", true],
    ["JavaScript", "Front end in JavaScript", true],
    ["Java", "Spring Boot services in Java 21", true],
    ["React", "Mobile apps in React Native", false],
    ["React", "Mobile apps in react-native", false],
    ["React Native", "Mobile apps in React Native", true],
    ["React Native", "Mobile apps in react-native", true],
    ["React", "Web apps in React.js and mobile apps in React Native", true],
    ["React", "Dashboards in ReactJS", true],
    ["SQL", "Document stores (NoSQL) and PostgreSQL", false],
    ["TypeScript", "typescript everywhere", true],
  ])("%s in %j → %s", (name, text, expected) => {
    expect(found(name, text)).toBe(expected);
  });
});

describe("words, spellings and both languages", () => {
  it.each([
    ["Go", "Services written in Go and Rust", true],
    ["Go", "Ready to go the extra mile", false],
    ["AI", "J’ai conçu des interfaces", false],
    ["AI", "Built AI features", true],
    ["IT", "I worked on it daily", false],
    ["API", "Designed REST APIs", true],
    ["APIs", "Designed a REST API", true],
    ["HTML", "Pages in HTML5 and CSS3", true],
    ["CSS", "Pages in HTML5 and CSS3", true],
    ["HTML5", "Pages in HTML", false],
    ["Python", "Automation with python3 scripts", true],
    ["Vue", "Components in Vue.js", true],
    ["Angular", "A legacy AngularJS app", false],
    ["front end", "Front-end developer", true],
    ["frontend", "Front end developer", true],
    ["front-end", "Frontend developer", true],
    ["gestion de projet", "Gestion des projets agiles", true],
    ["Développement web", "DEVELOPPEMENT WEB", true],
    ["R&D", "Two years in R&D", true],
    ["R", "Two years in R&D", false],
    ["project management", "Strong project skills", false],
  ])("%s in %j → %s", (name, text, expected) => {
    expect(found(name, text)).toBe(expected);
  });

  it("has nothing to match in punctuation alone", () => {
    expect(compileTerm("!!! — ???")).toBeNull();
  });

  it("identifies one term across its spellings, and different technologies apart", () => {
    expect(termKey("React.js")).toBe(termKey("reactjs"));
    expect(termKey("ReactJS")).toBe(termKey("React.js"));
    expect(termKey("API")).toBe(termKey("APIs"));
    expect(termKey("Gestion de projet")).toBe(termKey("gestion projets"));
    expect(termKey("Java")).not.toBe(termKey("JavaScript"));
    expect(termKey("React")).not.toBe(termKey("React Native"));
    expect(termKey("…")).toBe("");
  });
});

describe("match score", () => {
  it("weights required items double and counts each requirement once", () => {
    const compiled = compileRequirements(
      "Frontend developer",
      document([
        requirement("React"),
        requirement("TypeScript"),
        requirement("GraphQL", "preferred"),
        requirement("Docker", "preferred"),
      ]),
    );
    const visible = indexTexts([cv("React, React and more React"), cv("GraphQL APIs")]);

    const report = matchCv(compiled, visible, null);

    // Found: React (2) + GraphQL (1) = 3 of 2 + 2 + 1 + 1 = 6.
    expect(report.score).toBe(50);
    expect(report.required).toEqual({ matched: 1, total: 2 });
    expect(report.preferred).toEqual({ matched: 1, total: 2 });
    expect(report.requirements.map((result) => result.status)).toEqual([
      "matched",
      "missing",
      "matched",
      "missing",
    ]);
  });

  it("rounds to a whole percentage and scores every requirement found as 100", () => {
    const report = matchCv(
      compileRequirements("", document([requirement("React"), requirement("Git", "preferred")])),
      indexTexts([cv("React"), cv("Git")]),
      null,
    );
    expect(report.score).toBe(100);

    const third = matchCv(
      compileRequirements(
        "",
        document([
          requirement("React", "preferred"),
          requirement("Git", "preferred"),
          requirement("Vue", "preferred"),
        ]),
      ),
      indexTexts([cv("React only")]),
      null,
    );
    expect(third.score).toBe(33);
  });

  it("has no score without requirements", () => {
    const report = matchCv(compileRequirements("", document([])), indexTexts([cv("React")]), null);
    expect(report.score).toBeNull();
    expect(report.title.status).toBe("none");
  });

  it("counts other names, and one requirement once even when several of its names appear", () => {
    const report = matchCv(
      compileRequirements(
        "",
        document([requirement("Gestion de projet", "required", ["Project management"])]),
      ),
      indexTexts([cv("Project management for three teams"), cv("Gestion de projet agile")]),
      null,
    );
    expect(report.score).toBe(100);
    expect(report.required).toEqual({ matched: 1, total: 1 });
    expect(report.requirements[0]?.evidence).toHaveLength(2);
  });

  it("shows the matched words as written, with their context and location", () => {
    const report = matchCv(
      compileRequirements("", document([requirement("React", "required", ["React.js"])])),
      indexTexts([
        cv(
          "Built dashboards with React.js and TypeScript for a large retail client in three countries",
          "bullet",
          "Experience",
          "Frontend developer",
        ),
      ]),
      null,
    );

    expect(report.requirements[0]).toMatchObject({
      status: "matched",
      evidence: [
        {
          before: "Built dashboards with ",
          match: "React.js",
          after: " and TypeScript for a large retail client in…",
          where: {
            scope: "cv",
            field: "bullet",
            section: "Experience",
            item: "Frontend developer",
          },
        },
      ],
    });
  });

  it("keeps at most three evidence lines, one per text", () => {
    const report = matchCv(
      compileRequirements("", document([requirement("React")])),
      indexTexts(["React", "React and React", "React", "React", "React"].map((text) => cv(text))),
      null,
    );
    expect(report.requirements[0]?.evidence).toHaveLength(3);
    expect(report.requirements[0]?.evidence[1]).toMatchObject({ before: "", match: "React" });
  });

  it("clips long context on both sides at a word boundary", () => {
    const words = "word ".repeat(30);
    const report = matchCv(
      compileRequirements("", document([requirement("Kafka")])),
      indexTexts([cv(`${words}Kafka ${words}`)]),
      null,
    );
    const evidence = report.requirements[0]?.evidence[0];
    expect(evidence?.before.startsWith("…")).toBe(true);
    expect(evidence?.after.endsWith("…")).toBe(true);
    expect(evidence?.match).toBe("Kafka");
  });

  it("reports what only the career data holds as hidden, without counting it", () => {
    const report = matchCv(
      compileRequirements("", document([requirement("React"), requirement("Docker")])),
      indexTexts([cv("React")]),
      indexTexts([career("React"), career("Docker", "Tools")]),
    );

    expect(report.score).toBe(50);
    expect(report.hidden).toBe(1);
    expect(report.requirements[1]).toMatchObject({
      status: "hidden",
      evidence: [{ match: "Docker", where: { scope: "career", record: "skills", item: "Tools" } }],
    });
  });

  it("reports requirements found nowhere as missing", () => {
    const report = matchCv(
      compileRequirements("", document([requirement("Kubernetes")])),
      indexTexts([cv("React")]),
      indexTexts([career("Docker")]),
    );
    expect(report.requirements[0]).toMatchObject({ status: "missing", evidence: [] });
    expect(report.hidden).toBe(0);
  });

  it("looks for the job title, or its other names, in the CV title and roles only", () => {
    const requirements = document([requirement("React")], ["Développeur front-end"]);
    const byTitle = matchCv(
      compileRequirements("Frontend developer", requirements),
      indexTexts([cv("Frontend developer", "headerTitle", null, null)]),
      null,
    );
    expect(byTitle.title).toMatchObject({
      status: "matched",
      evidence: [{ match: "Frontend developer", where: { field: "headerTitle" } }],
    });

    const byAlias = matchCv(
      compileRequirements("Frontend developer", requirements),
      indexTexts([cv("Développeur front-end", "role")]),
      null,
    );
    expect(byAlias.title.status).toBe("matched");

    const inBulletOnly = matchCv(
      compileRequirements("Frontend developer", requirements),
      indexTexts([cv("Worked as a frontend developer", "bullet")]),
      null,
    );
    expect(inBulletOnly.title).toEqual({ status: "missing", evidence: [] });
  });

  it("leaves the title check out of the score", () => {
    const report = matchCv(
      compileRequirements("Data engineer", document([requirement("React")])),
      indexTexts([cv("React")]),
      null,
    );
    expect(report.score).toBe(100);
    expect(report.title.status).toBe("missing");
  });
});
