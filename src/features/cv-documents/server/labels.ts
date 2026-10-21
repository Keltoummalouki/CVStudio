import "server-only";
import en from "@messages/en.json";
import fr from "@messages/fr.json";
import type { CvLabelSet, CvLabels } from "@/features/cv-builder/labels";

/** Both label sets: a CV's language is independent of the dashboard's. */
export async function getCvLabels(): Promise<CvLabelSet> {
  // French has the same keys (enforced by the dictionary parity test).
  return { en: en.cv, fr: fr.cv as CvLabels };
}
