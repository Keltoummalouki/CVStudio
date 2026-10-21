import type { Locale } from "@/lib/i18n/config";

export type RecentCv = {
  id: string;
  name: string;
  /** Output language of the CV document (independent of the interface language). */
  locale: Locale;
  /** ISO 8601 timestamp of the last saved change. */
  updatedAt: string;
  /** Texts not yet written in the CV's language; null when its layout could not be read. */
  missingTranslations: number | null;
};

export type SetupProgress = {
  profile: boolean;
  careerRecords: boolean;
  cv: boolean;
  template: boolean;
};

export type DashboardOverview = {
  counts: {
    careerRecords: number;
    cvs: number;
    templates: number;
  };
  setup: SetupProgress;
  recentCvs: readonly RecentCv[];
};

export const SETUP_STEP_IDS = ["profile", "career", "cv", "template"] as const;
export type SetupStepId = (typeof SETUP_STEP_IDS)[number];

export type SetupStepState = "done" | "next" | "upcoming";

export type SetupStep = {
  id: SetupStepId;
  state: SetupStepState;
};

const STEP_COMPLETION: Record<SetupStepId, (setup: SetupProgress) => boolean> = {
  profile: (setup) => setup.profile,
  career: (setup) => setup.careerRecords,
  cv: (setup) => setup.cv,
  template: (setup) => setup.template,
};

/** Orders setup steps and marks the first incomplete one as the next action. */
export function getSetupSteps(setup: SetupProgress): SetupStep[] {
  let nextAssigned = false;

  return SETUP_STEP_IDS.map((id) => {
    if (STEP_COMPLETION[id](setup)) return { id, state: "done" };
    if (!nextAssigned) {
      nextAssigned = true;
      return { id, state: "next" };
    }
    return { id, state: "upcoming" };
  });
}

export function isSetupComplete(setup: SetupProgress): boolean {
  return SETUP_STEP_IDS.every((id) => STEP_COMPLETION[id](setup));
}
