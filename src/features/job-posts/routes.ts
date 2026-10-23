import { NEW_CV_HREF } from "@/config/navigation";

export const JOBS_HREF = "/dashboard/jobs";
export const NEW_JOB_HREF = `${JOBS_HREF}/new`;
export const jobHref = (id: string) => `${JOBS_HREF}/${id}`;

/** The query parameter the New CV page reads to make a CV for a job post. */
export const JOB_QUERY_PARAM = "job";

export const newCvForJobHref = (id: string) =>
  `${NEW_CV_HREF}?${JOB_QUERY_PARAM}=${encodeURIComponent(id)}`;
