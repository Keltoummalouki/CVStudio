import { describe, expect, it } from "vitest";
import en from "@messages/en.json";
import fr from "@messages/fr.json";

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Map<string, string> {
  const entries = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      entries.set(path, value);
    } else {
      for (const [childPath, childValue] of flatten(value, path))
        entries.set(childPath, childValue);
    }
  }
  return entries;
}

/** Top-level ICU argument names, e.g. "{count, plural, ...}" -> "count". */
function argumentNames(message: string): string[] {
  const names = new Set<string>();
  let depth = 0;
  for (let index = 0; index < message.length; index += 1) {
    const char = message[index];
    if (char === "{") {
      if (depth === 0) {
        const match = /^\{\s*([A-Za-z_][\w]*)/.exec(message.slice(index));
        if (match?.[1]) names.add(match[1]);
      }
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
    }
  }
  return [...names].sort();
}

const english = flatten(en as Tree);
const french = flatten(fr as Tree);

describe("message dictionaries", () => {
  it("define exactly the same keys in English and French", () => {
    expect([...french.keys()].sort()).toEqual([...english.keys()].sort());
  });

  it("never contain empty strings", () => {
    for (const [locale, messages] of [
      ["en", english],
      ["fr", french],
    ] as const) {
      for (const [key, value] of messages) {
        expect(value.trim(), `${locale}:${key}`).not.toBe("");
      }
    }
  });

  it("use the same ICU arguments in both languages", () => {
    for (const [key, value] of english) {
      expect(argumentNames(french.get(key) ?? ""), key).toEqual(argumentNames(value));
    }
  });

  it("follow French typography: no breakable space before high punctuation", () => {
    for (const [key, value] of french) {
      expect(value, key).not.toMatch(/ [:;?!»]/);
      expect(value, key).not.toMatch(/« /);
    }
  });

  it("use typographic apostrophes", () => {
    for (const [key, value] of [...english, ...french]) {
      expect(value, key).not.toContain("'");
    }
  });
});
