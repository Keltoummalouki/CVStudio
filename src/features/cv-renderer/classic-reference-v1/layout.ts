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
