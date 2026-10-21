import { describe, expect, it } from "vitest";
import { classifyPath, sanitizeNextPath, splitLocalePath } from "@/lib/auth/routes";

describe("splitLocalePath", () => {
  it("separates a supported locale prefix from the path", () => {
    expect(splitLocalePath("/fr/dashboard/cvs")).toEqual({ locale: "fr", path: "/dashboard/cvs" });
    expect(splitLocalePath("/en")).toEqual({ locale: "en", path: "/" });
    expect(splitLocalePath("/en/dashboard/")).toEqual({ locale: "en", path: "/dashboard" });
  });

  it("leaves unprefixed or unsupported paths alone", () => {
    expect(splitLocalePath("/dashboard")).toEqual({ locale: null, path: "/dashboard" });
    expect(splitLocalePath("/de/dashboard")).toEqual({ locale: null, path: "/de/dashboard" });
  });
});

describe("classifyPath", () => {
  it("protects the dashboard subtree only", () => {
    expect(classifyPath("/dashboard")).toBe("protected");
    expect(classifyPath("/dashboard/cvs/123")).toBe("protected");
    expect(classifyPath("/dashboards")).toBe("public");
    expect(classifyPath("/login")).toBe("auth");
    expect(classifyPath("/")).toBe("public");
  });
});

describe("sanitizeNextPath", () => {
  it("keeps same-origin dashboard destinations, including their query", () => {
    expect(sanitizeNextPath("/dashboard/cvs")).toBe("/dashboard/cvs");
    expect(sanitizeNextPath("/dashboard/cvs?tab=preview")).toBe("/dashboard/cvs?tab=preview");
  });

  it.each([
    undefined,
    "",
    "https://evil.example/dashboard",
    "//evil.example/dashboard",
    "/\\evil.example",
    "/\t/evil.example",
    "javascript:alert(1)",
    "/login",
    "/../dashboard/../login",
    `/dashboard/${"x".repeat(600)}`,
  ])("falls back to the dashboard for %j", (value) => {
    expect(sanitizeNextPath(value)).toBe("/dashboard");
  });
});
