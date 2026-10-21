import type { Locale } from "@/lib/i18n/config";
import type { LocalizedTextValue } from "@/lib/i18n/localized-text";
import type {
  CvDefinition,
  HeaderDefinition,
  SectionDefinition,
  SectionKind,
  SectionOf,
} from "./definition";
import { mergeOptOut } from "./resolve";

/**
 * Immutable edits of a CV definition, shared by the builder UI and its tests.
 * Every function returns a new definition and leaves its input untouched.
 */

export function setHeader(
  definition: CvDefinition,
  patch: Partial<HeaderDefinition>,
): CvDefinition {
  return { ...definition, header: { ...definition.header, ...patch } };
}

export function updateSection<K extends SectionKind>(
  definition: CvDefinition,
  nodeId: string,
  kind: K,
  update: (section: SectionOf<K>) => SectionOf<K>,
): CvDefinition {
  return {
    ...definition,
    sections: definition.sections.map((section) =>
      section.nodeId === nodeId && section.kind === kind
        ? update(section as SectionOf<K>)
        : section,
    ),
  };
}

export function setSectionVisible(
  definition: CvDefinition,
  nodeId: string,
  visible: boolean,
): CvDefinition {
  return {
    ...definition,
    sections: definition.sections.map((section) =>
      section.nodeId === nodeId ? { ...section, visible } : section,
    ),
  };
}

export function setSectionTitle(
  definition: CvDefinition,
  nodeId: string,
  locale: Locale,
  text: string,
): CvDefinition {
  return {
    ...definition,
    sections: definition.sections.map((section) =>
      section.nodeId === nodeId
        ? withOptional(section, "title", setOverride(section.title, locale, text))
        : section,
    ),
  };
}

/** Applies a new order given as node ids; unknown ids are ignored and missing ones keep their place at the end. */
export function reorderSections(
  definition: CvDefinition,
  nodeIds: readonly string[],
): CvDefinition {
  return { ...definition, sections: reorderBy(definition.sections, nodeIds, (s) => s.nodeId) };
}

export function addSection(definition: CvDefinition, section: SectionDefinition): CvDefinition {
  return { ...definition, sections: [...definition.sections, section] };
}

export function removeSection(definition: CvDefinition, nodeId: string): CvDefinition {
  return { ...definition, sections: definition.sections.filter((s) => s.nodeId !== nodeId) };
}

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

export function reorderBy<T>(
  items: readonly T[],
  ids: readonly string[],
  idOf: (item: T) => string,
): T[] {
  const byId = new Map(items.map((item) => [idOf(item), item]));
  const ordered: T[] = [];
  for (const id of ids) {
    const item = byId.get(id);
    if (item) {
      ordered.push(item);
      byId.delete(id);
    }
  }
  return [...ordered, ...byId.values()];
}

/** Replaces the item whose `refId` matches. */
export function updateItem<T extends { refId: string }>(
  items: readonly T[],
  refId: string,
  update: (item: T) => T,
): T[] {
  return items.map((item) => (item.refId === refId ? update(item) : item));
}

/**
 * Writes out an opt-out list in full (the CV order followed by items added
 * to the record since), so a visibility change or a new order can be stored.
 * References to archived or deleted items are dropped on the way.
 */
export function materializeOptOut<R extends { refId: string }>(
  refs: readonly R[],
  master: readonly { id: string; archived: boolean }[],
  createRef: (refId: string) => R,
): R[] {
  return mergeOptOut(refs, master).map(({ item, ref }) => ref ?? createRef(item.id));
}

// ---------------------------------------------------------------------------
// Overrides
// ---------------------------------------------------------------------------

/**
 * Sets one language of a per-CV override. Clearing the last language removes
 * the override, so the master text shows again.
 */
export function setOverride(
  value: LocalizedTextValue | undefined,
  locale: Locale,
  text: string,
): LocalizedTextValue | undefined {
  const next: LocalizedTextValue = { en: value?.en, fr: value?.fr };
  if (text.trim()) next[locale] = text;
  else delete next[locale];
  const cleaned: LocalizedTextValue = {};
  if (next.en !== undefined) cleaned.en = next.en;
  if (next.fr !== undefined) cleaned.fr = next.fr;
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

/** Sets or removes an optional property without leaving `key: undefined` behind. */
export function withOptional<T extends object, K extends keyof T>(
  object: T,
  key: K,
  value: T[K] | undefined,
): T {
  const copy = { ...object };
  if (value === undefined) delete copy[key];
  else copy[key] = value;
  return copy;
}
