import { describe, expect, it } from "vitest";
import { splitSkillColumns } from "@/features/cv-renderer/classic-reference-v1/layout";

const groups = (...ids: string[]) => ids.map((refId) => ({ refId }));
const ids = (list: { refId: string }[]) => list.map((group) => group.refId);

describe("skill columns", () => {
  it("shares groups evenly, the left column taking the extra one", () => {
    const [left, right] = splitSkillColumns(
      groups("a", "b", "c", "d", "e", "f", "g", "h", "i", "j"),
    );
    expect(ids(left)).toEqual(["a", "b", "c", "d", "e"]);
    expect(ids(right)).toEqual(["f", "g", "h", "i", "j"]);

    const [oddLeft, oddRight] = splitSkillColumns(groups("a", "b", "c"));
    expect(ids(oddLeft)).toEqual(["a", "b"]);
    expect(ids(oddRight)).toEqual(["c"]);
  });

  it("starts the right column at the group the owner chose", () => {
    const [left, right] = splitSkillColumns(groups("a", "b", "c", "d"), "b");
    expect(ids(left)).toEqual(["a"]);
    expect(ids(right)).toEqual(["b", "c", "d"]);
  });

  it("falls back to an even split when the chosen group is first, hidden or gone", () => {
    expect(ids(splitSkillColumns(groups("a", "b", "c", "d"), "a")[0])).toEqual(["a", "b"]);
    expect(ids(splitSkillColumns(groups("a", "b", "c", "d"), "zz")[0])).toEqual(["a", "b"]);
  });

  it("keeps a single group in the left column", () => {
    expect(splitSkillColumns(groups("a"))).toEqual([[{ refId: "a" }], []]);
    expect(splitSkillColumns([])).toEqual([[], []]);
  });
});
