import {
  EMPTY_PERIOD,
  type CertificationValues,
  type CustomSectionValues,
  type EducationValues,
  type ExperienceValues,
  type ProjectValues,
} from "./schemas";

/** Starting values for "new record" pages. */
export const NEW_EXPERIENCE: ExperienceValues = {
  id: null,
  expectedUpdatedAt: null,
  organization: "",
  role: {},
  location: {},
  period: EMPTY_PERIOD,
  details: [],
};

export const NEW_PROJECT: ProjectValues = {
  id: null,
  expectedUpdatedAt: null,
  title: {},
  description: {},
  projectUrl: "",
  sourceUrl: "",
  period: EMPTY_PERIOD,
  details: [],
};

export const NEW_EDUCATION: EducationValues = {
  id: null,
  expectedUpdatedAt: null,
  credential: {},
  institution: {},
  location: {},
  description: {},
  period: EMPTY_PERIOD,
};

export const NEW_CERTIFICATION: CertificationValues = {
  id: null,
  expectedUpdatedAt: null,
  title: {},
  issuer: {},
  issuedYear: null,
  issuedMonth: null,
  credentialUrl: "",
};

export const NEW_CUSTOM_SECTION: CustomSectionValues = {
  id: null,
  expectedUpdatedAt: null,
  title: {},
  subsections: [{ id: null, title: {}, items: [] }],
};
