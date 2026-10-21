/** Sections whose records are edited one by one, on their own page. */
export const RECORD_KINDS = [
  "experience",
  "education",
  "projects",
  "certifications",
  "custom",
] as const;
export type RecordKind = (typeof RECORD_KINDS)[number];

export const RECORD_TABLES = {
  experience: "experiences",
  education: "educations",
  projects: "projects",
  certifications: "certifications",
  custom: "custom_sections",
} as const satisfies Record<RecordKind, string>;

export function isRecordKind(value: unknown): value is RecordKind {
  return typeof value === "string" && (RECORD_KINDS as readonly string[]).includes(value);
}
