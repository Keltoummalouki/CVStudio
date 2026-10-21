import { NEW_CV_HREF } from "@/config/navigation";

export const TEMPLATES_HREF = "/dashboard/templates";

/** The query parameter the New CV page reads to start from a template. */
export const TEMPLATE_QUERY_PARAM = "template";

export const templateHref = (id: string) => `${TEMPLATES_HREF}/${id}`;

export const newCvFromTemplateHref = (id: string) =>
  `${NEW_CV_HREF}?${TEMPLATE_QUERY_PARAM}=${encodeURIComponent(id)}`;
