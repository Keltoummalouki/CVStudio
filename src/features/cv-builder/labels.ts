import type en from "@messages/en.json";
import type { Locale } from "@/lib/i18n/config";

/**
 * Words printed on the CV itself (default section headings, contact labels,
 * "Present"). They follow the CV's language, not the dashboard's, so the
 * builder receives both sets and switches with the document.
 */
export type CvLabels = (typeof en)["cv"];
export type CvLabelSet = Record<Locale, CvLabels>;
