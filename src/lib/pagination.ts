/** A page number, or a gap standing for the page numbers left out. */
export type PageSlot = number | "gap";

/** At most this many slots, so the control fits a phone-width list without wrapping. */
const MAX_SLOTS = 7;

export function pageCountOf(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** A page number read from the URL: a positive integer, otherwise the first page. */
export function parsePage(value: string | null | undefined): number {
  if (!value || !/^\d{1,6}$/.test(value)) return 1;
  return Math.max(1, Number(value));
}

/**
 * The page numbers to offer: always the first and the last, the current page
 * and its neighbours, and a gap wherever pages are skipped. A gap always
 * replaces at least two pages, so it never hides a single number that would
 * fit in its place.
 */
export function pageSlots(page: number, pageCount: number): PageSlot[] {
  if (pageCount <= MAX_SLOTS) return Array.from({ length: pageCount }, (_, index) => index + 1);

  const current = Math.min(Math.max(page, 1), pageCount);
  const range = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, index) => from + index);

  if (current <= 4) return [...range(1, 5), "gap", pageCount];
  if (current >= pageCount - 3) return [1, "gap", ...range(pageCount - 4, pageCount)];
  return [1, "gap", current - 1, current, current + 1, "gap", pageCount];
}
