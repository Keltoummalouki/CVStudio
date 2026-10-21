/**
 * Page geometry measured on the reference PDF. The first page starts 1.2 mm
 * from the top edge (the portrait almost touches it); later pages of a long
 * CV get a regular top margin. Text runs from 12.4 mm to 197.9 mm, and rules
 * continue 5.2 mm further right. The preview's page-break markers (and later
 * the print margins) use the same values.
 */
export const PAGE_MARGINS_MM = {
  firstTop: 1.2,
  top: 10,
  bottom: 6,
  left: 12.4,
  right: 12.1,
  ruleBleed: 5.2,
} as const;

/**
 * Page rules for printing and PDF export. The first page starts at the top
 * edge and the sheet's own padding (PAGE_MARGINS_MM.firstTop) places the
 * content; later pages get a regular top margin. Left and right margins stay
 * in the sheet's padding so rules can bleed into the right margin.
 */
export function printPageCss(): string {
  const { top, bottom } = PAGE_MARGINS_MM;
  return [
    `@page { size: A4; margin: ${top}mm 0 ${bottom}mm 0; }`,
    "@page :first { margin-top: 0; }",
    "@media print { html, body { background: #fff !important; } }",
  ].join("\n");
}

/**
 * Splits skill groups into a left and a right column, read top to bottom like
 * the reference. The owner may choose the first group of the right column;
 * otherwise the groups are shared evenly, the left column taking the extra one.
 */
export function splitSkillColumns<T extends { refId: string }>(
  groups: readonly T[],
  rightStartsWith: string | null = null,
): [T[], T[]] {
  const chosen = rightStartsWith
    ? groups.findIndex((group) => group.refId === rightStartsWith)
    : -1;
  const split = chosen > 0 ? chosen : Math.ceil(groups.length / 2);
  return [groups.slice(0, split), groups.slice(split)];
}
