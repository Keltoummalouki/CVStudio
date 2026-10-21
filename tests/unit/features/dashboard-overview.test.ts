import { describe, expect, it } from "vitest";
import { getSetupSteps, isSetupComplete, type SetupProgress } from "@/features/dashboard/overview";

const NOTHING_DONE: SetupProgress = {
  profile: false,
  careerRecords: false,
  cv: false,
  template: false,
};

describe("getSetupSteps", () => {
  it("starts a new workspace on the profile step", () => {
    expect(getSetupSteps(NOTHING_DONE)).toEqual([
      { id: "profile", state: "next" },
      { id: "career", state: "upcoming" },
      { id: "cv", state: "upcoming" },
      { id: "template", state: "upcoming" },
    ]);
  });

  it("points at the first incomplete step even when later steps are done", () => {
    const steps = getSetupSteps({ ...NOTHING_DONE, profile: true, cv: true });
    expect(steps.map((step) => step.state)).toEqual(["done", "next", "done", "upcoming"]);
  });

  it("has no next step once everything is done", () => {
    const all: SetupProgress = { profile: true, careerRecords: true, cv: true, template: true };
    expect(getSetupSteps(all).every((step) => step.state === "done")).toBe(true);
    expect(isSetupComplete(all)).toBe(true);
    expect(isSetupComplete(NOTHING_DONE)).toBe(false);
  });
});
