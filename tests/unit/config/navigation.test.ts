import { describe, expect, it } from "vitest";
import {
  CAREER_SECTIONS,
  CAREER_SECTION_KINDS,
  BUILT_IN_SECTION_COUNT,
} from "@/config/career-sections";
import { PRIMARY_NAVIGATION, isNavigationItemActive } from "@/config/navigation";

function item(id: string) {
  const found = PRIMARY_NAVIGATION.find((entry) => entry.id === id);
  if (!found) throw new Error(`Missing navigation item ${id}`);
  return found;
}

describe("isNavigationItemActive", () => {
  it("activates the overview only on its exact path", () => {
    expect(isNavigationItemActive(item("overview"), "/dashboard")).toBe(true);
    expect(isNavigationItemActive(item("overview"), "/dashboard/")).toBe(true);
    expect(isNavigationItemActive(item("overview"), "/dashboard/cvs")).toBe(false);
  });

  it("keeps a section active across its whole subtree", () => {
    expect(isNavigationItemActive(item("cvs"), "/dashboard/cvs")).toBe(true);
    expect(isNavigationItemActive(item("cvs"), "/dashboard/cvs/123/edit")).toBe(true);
    expect(isNavigationItemActive(item("templates"), "/dashboard/cvs")).toBe(false);
  });

  it("does not match sibling paths that merely share a prefix", () => {
    expect(isNavigationItemActive(item("cvs"), "/dashboard/cvs-archive")).toBe(false);
  });

  it("treats the profile editor as part of career data", () => {
    expect(isNavigationItemActive(item("careerData"), "/dashboard/content/profile")).toBe(true);
    expect(isNavigationItemActive(item("careerData"), "/dashboard/content/experiences")).toBe(true);
  });

  it("marks exactly one destination active for any dashboard path", () => {
    for (const path of ["/dashboard", "/dashboard/content/skills", "/dashboard/settings"]) {
      const active = PRIMARY_NAVIGATION.filter((entry) => isNavigationItemActive(entry, path));
      expect(active, path).toHaveLength(1);
    }
  });
});

describe("career section registry", () => {
  it("covers every section kind exactly once", () => {
    expect(CAREER_SECTIONS.map((section) => section.kind)).toEqual([...CAREER_SECTION_KINDS]);
  });

  it("uses unique routes", () => {
    const hrefs = CAREER_SECTIONS.map((section) => section.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("counts the eight built-in sections (custom sections are owner-defined)", () => {
    expect(BUILT_IN_SECTION_COUNT).toBe(8);
  });
});
