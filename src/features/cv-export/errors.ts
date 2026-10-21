/** Outcomes of a PDF export that the interface explains to the owner. */
export const PDF_ERROR_CODES = [
  "unauthorized",
  "not_found",
  "missing_translations",
  "rate_limited",
  "unavailable",
] as const;

export type PdfErrorCode = (typeof PDF_ERROR_CODES)[number];

export function isPdfErrorCode(value: unknown): value is PdfErrorCode {
  return typeof value === "string" && (PDF_ERROR_CODES as readonly string[]).includes(value);
}
