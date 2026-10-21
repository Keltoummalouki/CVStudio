import type { CustomItemKind } from "@/features/career-data/schemas";
import { formatMonthYear, formatPeriod, type Period } from "@/lib/dates/period";
import type { Locale } from "@/lib/i18n/config";
import {
  displayLocalizedText,
  resolveLocalizedText,
  type LocalizedTextValue,
} from "@/lib/i18n/localized-text";
import type {
  CvDefinition,
  DetailRef,
  ItemRef,
  SectionDefinition,
  SectionKind,
} from "./definition";
import type { CvLabels } from "./labels";
import type { MasterData, MasterDetail } from "./master-data";

/**
 * Turns a CV definition plus the owner's master data into exactly what the
 * document shows, in the CV's language, and lists everything that stands in
 * the way of a faithful export. Pure: the builder runs it on every keystroke
 * for the live preview, the print route runs it once on the server.
 */

/** Text as printed. `missing` marks text borrowed from the other language for the preview. */
export type CvText = { text: string; missing: boolean };

export type IssueField =
  | "title"
  | "summary"
  | "location"
  | "linkLabel"
  | "sectionTitle"
  | "groupTitle"
  | "skill"
  | "role"
  | "detail"
  | "credential"
  | "institution"
  | "description"
  | "issuer"
  | "name"
  | "proficiency"
  | "subsectionTitle"
  | "label"
  | "text";

type IssueTarget = {
  /** `null` for the document header. */
  sectionNodeId: string | null;
  sectionKind: SectionKind | "header";
  refId: string | null;
  /** The record as the owner would recognise it, in any language. */
  hint: string | null;
};

export type CvIssue =
  | (IssueTarget & { kind: "missing_translation"; field: IssueField })
  | (IssueTarget & { kind: "archived_record" })
  | (IssueTarget & { kind: "missing_record" });

/** Missing translations block printing and export; the rest are warnings. */
export function isBlockingIssue(issue: CvIssue): boolean {
  return issue.kind === "missing_translation";
}

export type ResolvedContact = { key: string; label: string; value: CvText; href: string | null };

export type ResolvedHeader = {
  title: CvText | null;
  name: string | null;
  showPhoto: boolean;
  contacts: ResolvedContact[];
  links: ResolvedContact[];
};

export type ResolvedBlock = { kind: "bullet" | "paragraph"; text: CvText };

export type ResolvedLink = { label: string; text: string; href: string };

export type ResolvedEntry = {
  refId: string;
  title: CvText | null;
  /** Organization, institution or issuer. */
  subtitle: CvText | null;
  place: CvText | null;
  date: string | null;
  body: ResolvedBlock[];
  technologies: CvText[];
  links: ResolvedLink[];
};

export type ResolvedSkillGroup = { refId: string; title: CvText | null; skills: CvText[] };
export type ResolvedListItem = { refId: string; text: CvText; detail: CvText | null };
export type ResolvedCustomItem = {
  refId: string;
  kind: CustomItemKind;
  label: CvText | null;
  text: CvText;
};
export type ResolvedSubsection = {
  refId: string;
  title: CvText | null;
  items: ResolvedCustomItem[];
};

type SectionCommon = { nodeId: string; title: CvText };
export type EntrySectionKind = "experience" | "education" | "projects" | "certifications";

export type ResolvedSection =
  | (SectionCommon & { kind: "summary"; text: CvText })
  | (SectionCommon & {
      kind: "technical_skills";
      columns: 1 | 2;
      /** First group of the right column, when the owner chose one. */
      rightStartsWith: string | null;
      groups: ResolvedSkillGroup[];
    })
  | (SectionCommon & { kind: EntrySectionKind; entries: ResolvedEntry[] })
  | (SectionCommon & { kind: "soft_skills" | "languages"; items: ResolvedListItem[] })
  | (SectionCommon & { kind: "custom"; subsections: ResolvedSubsection[] });

/** The resolved section for one kind (entry sections share a single shape). */
export type ResolvedSectionOf<K extends ResolvedSection["kind"]> = ResolvedSection extends infer S
  ? S extends { kind: infer SK }
    ? K extends SK
      ? S & { kind: K }
      : never
    : never
  : never;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type SectionContent = DistributiveOmit<ResolvedSection, "nodeId" | "title">;

export type ResolvedCv = { locale: Locale; header: ResolvedHeader; sections: ResolvedSection[] };

export type Resolution = { cv: ResolvedCv; issues: CvIssue[] };

// ---------------------------------------------------------------------------
// Merging
// ---------------------------------------------------------------------------

/**
 * Nested items are opt-out: the CV's own order first, then items added to the
 * record since (in master order), so new bullets or skills appear without
 * editing every CV. Archived nested items were removed from their record and
 * disappear; references to rows that no longer exist are ignored.
 */
export function mergeOptOut<
  M extends { id: string; archived: boolean },
  R extends { refId: string },
>(refs: readonly R[], master: readonly M[]): { item: M; ref: R | undefined }[] {
  const byId = new Map(master.map((item) => [item.id, item]));
  const seen = new Set<string>();
  const merged: { item: M; ref: R | undefined }[] = [];
  for (const ref of refs) {
    const item = byId.get(ref.refId);
    if (!item || item.archived || seen.has(ref.refId)) continue;
    seen.add(ref.refId);
    merged.push({ item, ref });
  }
  for (const item of master) {
    if (!item.archived && !seen.has(item.id)) merged.push({ item, ref: undefined });
  }
  return merged;
}

const isVisible = (ref: { visible: boolean } | undefined) => ref?.visible ?? true;

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

type L = LocalizedTextValue;

class Resolver {
  readonly issues: CvIssue[] = [];

  constructor(
    readonly master: MasterData,
    readonly locale: Locale,
    readonly labels: CvLabels,
  ) {}

  /** Any written version of a value, to name a record in an issue. */
  hint(...values: (L | string | null | undefined)[]): string | null {
    const parts = values.flatMap((value) => {
      if (!value) return [];
      if (typeof value === "string") return value.trim() ? [value.trim()] : [];
      const shown = displayLocalizedText(value, this.locale);
      return shown ? [shown.text] : [];
    });
    return parts.length > 0 ? parts.join(" · ") : null;
  }

  /**
   * The per-CV override when it exists in this language, else the master
   * text. Text that exists only in the other language is shown (marked) and
   * reported, never silently printed.
   */
  text(
    value: L | undefined,
    override: L | undefined,
    field: IssueField,
    target: IssueTarget,
  ): CvText | null {
    const candidates = [override, value].filter((candidate): candidate is L => !!candidate);
    for (const candidate of candidates) {
      const own = resolveLocalizedText(candidate, this.locale);
      if (own) return { text: own, missing: false };
    }
    for (const candidate of candidates) {
      const other = displayLocalizedText(candidate, this.locale);
      if (other) {
        this.issues.push({ kind: "missing_translation", field, ...target });
        return { text: other.text, missing: true };
      }
    }
    return null;
  }

  period(period: Period): string | null {
    return formatPeriod(period, this.locale, this.labels.present) || null;
  }

  plain(value: string | null | undefined): CvText | null {
    const text = value?.trim();
    return text ? { text, missing: false } : null;
  }

  header(definition: CvDefinition["header"]): ResolvedHeader {
    const { profile } = this.master;
    const target: IssueTarget = {
      sectionNodeId: null,
      sectionKind: "header",
      refId: null,
      hint: null,
    };
    const contacts: ResolvedContact[] = [];
    const phone = this.plain(profile.phone);
    if (definition.showPhone && phone) {
      contacts.push({
        key: "phone",
        label: this.labels.contact.phone,
        value: phone,
        href: `tel:${phone.text.replace(/[^+\d]/g, "")}`,
      });
    }
    const email = this.plain(profile.email);
    if (definition.showEmail && email) {
      contacts.push({
        key: "email",
        label: this.labels.contact.email,
        value: email,
        href: `mailto:${email.text}`,
      });
    }
    if (definition.showLocation) {
      const location = this.text(profile.location, undefined, "location", target);
      if (location) {
        contacts.push({
          key: "location",
          label: this.labels.contact.location,
          value: location,
          href: null,
        });
      }
    }

    const links: ResolvedContact[] = [];
    if (definition.showLinks) {
      for (const { item: link, ref } of mergeOptOut(definition.links, this.master.links)) {
        if (!isVisible(ref)) continue;
        const ownLabel =
          link.kind === "website" || link.kind === "other"
            ? this.text(link.label, undefined, "linkLabel", {
                ...target,
                refId: link.id,
                hint: link.displayText.trim() || stripProtocol(link.url),
              })
            : null;
        links.push({
          key: link.id,
          label: ownLabel?.text ?? this.labels.contact[link.kind],
          value: { text: link.displayText.trim() || stripProtocol(link.url), missing: false },
          href: link.url,
        });
      }
    }

    return {
      title: definition.showTitle
        ? this.text(profile.title, definition.title, "title", target)
        : null,
      name: definition.showName ? profile.fullName.trim() || null : null,
      showPhoto: definition.showPhoto && profile.hasPhoto,
      contacts,
      links,
    };
  }

  body(details: MasterDetail[], refs: readonly DetailRef[], target: IssueTarget) {
    const body: ResolvedBlock[] = [];
    const technologies: CvText[] = [];
    for (const { item: detail, ref } of mergeOptOut(refs, details)) {
      if (!isVisible(ref)) continue;
      const text = this.text(detail.text, ref?.text, "detail", target);
      if (!text) continue;
      if (detail.kind === "technology") technologies.push(text);
      else body.push({ kind: detail.kind, text });
    }
    return { body, technologies };
  }

  /** Opt-in records: only those the CV lists, in its order; archived ones stay with a warning. */
  records<R extends { id: string; archived: boolean }, I extends ItemRef>(
    section: SectionDefinition,
    items: readonly I[],
    master: readonly R[],
    hint: (record: R) => string | null,
    build: (record: R, item: I, target: IssueTarget) => ResolvedEntry | null,
  ): ResolvedEntry[] {
    const byId = new Map(master.map((record) => [record.id, record]));
    const entries: ResolvedEntry[] = [];
    for (const item of items) {
      if (!item.visible) continue;
      const record = byId.get(item.refId);
      const target: IssueTarget = {
        sectionNodeId: section.nodeId,
        sectionKind: section.kind,
        refId: item.refId,
        hint: record ? hint(record) : null,
      };
      if (!record) {
        this.issues.push({ kind: "missing_record", ...target });
        continue;
      }
      if (record.archived) this.issues.push({ kind: "archived_record", ...target });
      const entry = build(record, item, target);
      if (entry) entries.push(entry);
    }
    return entries;
  }

  sectionContent(section: SectionDefinition): SectionContent | null {
    const target = (refId: string | null, hint: string | null): IssueTarget => ({
      sectionNodeId: section.nodeId,
      sectionKind: section.kind,
      refId,
      hint,
    });

    switch (section.kind) {
      case "summary": {
        const text = this.text(
          this.master.profile.summary,
          section.text,
          "summary",
          target(null, null),
        );
        return text ? { kind: "summary", text } : null;
      }

      case "technical_skills": {
        const groups: ResolvedSkillGroup[] = [];
        for (const { item: group, ref } of mergeOptOut(section.groups, this.master.skillGroups)) {
          if (!isVisible(ref)) continue;
          const groupTarget = target(group.id, this.hint(group.title));
          const skills = mergeOptOut(ref?.skills ?? [], group.skills).flatMap(
            ({ item: skill, ref: skillRef }) => {
              if (!isVisible(skillRef)) return [];
              const text = this.text(skill.label, undefined, "skill", groupTarget);
              return text ? [text] : [];
            },
          );
          if (skills.length === 0) continue;
          groups.push({
            refId: group.id,
            title: this.text(group.title, undefined, "groupTitle", groupTarget),
            skills,
          });
        }
        return groups.length > 0
          ? {
              kind: "technical_skills",
              columns: section.columns,
              rightStartsWith: section.rightStartsWith ?? null,
              groups,
            }
          : null;
      }

      case "experience": {
        const entries = this.records(
          section,
          section.items,
          this.master.experiences,
          (record) => this.hint(record.role, record.organization),
          (record, item, entryTarget) => {
            const { body, technologies } = this.body(record.details, item.details, entryTarget);
            return {
              refId: record.id,
              title: this.text(record.role, item.role, "role", entryTarget),
              subtitle: this.plain(record.organization),
              place: item.showLocation
                ? this.text(record.location, undefined, "location", entryTarget)
                : null,
              date: item.showDates ? this.period(record.period) : null,
              body,
              technologies: item.showTechnologies ? technologies : [],
              links: [],
            };
          },
        );
        return entries.length > 0 ? { kind: "experience", entries } : null;
      }

      case "education": {
        const entries = this.records(
          section,
          section.items,
          this.master.educations,
          (record) => this.hint(record.credential, record.institution),
          (record, item, entryTarget) => {
            const description = item.showDescription
              ? this.text(record.description, item.description, "description", entryTarget)
              : null;
            return {
              refId: record.id,
              title: this.text(record.credential, item.credential, "credential", entryTarget),
              subtitle: this.text(record.institution, undefined, "institution", entryTarget),
              place: item.showLocation
                ? this.text(record.location, undefined, "location", entryTarget)
                : null,
              date: item.showDates ? this.period(record.period) : null,
              body: description ? [{ kind: "paragraph", text: description }] : [],
              technologies: [],
              links: [],
            };
          },
        );
        return entries.length > 0 ? { kind: "education", entries } : null;
      }

      case "projects": {
        const entries = this.records(
          section,
          section.items,
          this.master.projects,
          (record) => this.hint(record.title),
          (record, item, entryTarget) => {
            const description = item.showDescription
              ? this.text(record.description, item.description, "description", entryTarget)
              : null;
            const { body, technologies } = this.body(record.details, item.details, entryTarget);
            const links: ResolvedLink[] = [];
            if (item.showLinks) {
              if (record.projectUrl) {
                links.push({
                  label: this.labels.projectLink,
                  text: stripProtocol(record.projectUrl),
                  href: record.projectUrl,
                });
              }
              if (record.sourceUrl) {
                links.push({
                  label: this.labels.sourceLink,
                  text: stripProtocol(record.sourceUrl),
                  href: record.sourceUrl,
                });
              }
            }
            return {
              refId: record.id,
              title: this.text(record.title, item.title, "title", entryTarget),
              subtitle: null,
              place: null,
              date: item.showDates ? this.period(record.period) : null,
              body: description ? [{ kind: "paragraph", text: description }, ...body] : body,
              technologies: item.showTechnologies ? technologies : [],
              links,
            };
          },
        );
        return entries.length > 0 ? { kind: "projects", entries } : null;
      }

      case "certifications": {
        const entries = this.records(
          section,
          section.items,
          this.master.certifications,
          (record) => this.hint(record.title, record.issuer),
          (record, item, entryTarget) => ({
            refId: record.id,
            title: this.text(record.title, item.title, "title", entryTarget),
            subtitle: item.showIssuer
              ? this.text(record.issuer, undefined, "issuer", entryTarget)
              : null,
            place: null,
            date:
              item.showDate && record.issuedYear !== null
                ? formatMonthYear(record.issuedYear, record.issuedMonth, this.locale)
                : null,
            body: [],
            technologies: [],
            links:
              item.showLink && record.credentialUrl
                ? [
                    {
                      label: this.labels.credentialLink,
                      text: stripProtocol(record.credentialUrl),
                      href: record.credentialUrl,
                    },
                  ]
                : [],
          }),
        );
        return entries.length > 0 ? { kind: "certifications", entries } : null;
      }

      case "soft_skills": {
        const items = mergeOptOut(section.items, this.master.softSkills).flatMap(
          ({ item, ref }) => {
            if (!isVisible(ref)) return [];
            const text = this.text(
              item.label,
              undefined,
              "label",
              target(item.id, this.hint(item.label)),
            );
            return text ? [{ refId: item.id, text, detail: null }] : [];
          },
        );
        return items.length > 0 ? { kind: "soft_skills", items } : null;
      }

      case "languages": {
        const items = mergeOptOut(section.items, this.master.languages).flatMap(({ item, ref }) => {
          if (!isVisible(ref)) return [];
          const itemTarget = target(item.id, this.hint(item.name));
          const text = this.text(item.name, undefined, "name", itemTarget);
          if (!text) return [];
          return [
            {
              refId: item.id,
              text,
              detail: this.text(item.proficiency, undefined, "proficiency", itemTarget),
            },
          ];
        });
        return items.length > 0 ? { kind: "languages", items } : null;
      }

      case "custom": {
        const record = this.master.customSections.find(
          (candidate) => candidate.id === section.refId,
        );
        const sectionTarget = target(section.refId, record ? this.hint(record.title) : null);
        if (!record) {
          this.issues.push({ kind: "missing_record", ...sectionTarget });
          return null;
        }
        if (record.archived) this.issues.push({ kind: "archived_record", ...sectionTarget });

        const subsections: ResolvedSubsection[] = [];
        for (const { item: subsection, ref } of mergeOptOut(
          section.subsections,
          record.subsections,
        )) {
          if (!isVisible(ref)) continue;
          const subTarget = target(
            subsection.id,
            this.hint(subsection.title) ?? sectionTarget.hint,
          );
          const items = mergeOptOut(ref?.items ?? [], subsection.items).flatMap(
            ({ item, ref: itemRef }) => {
              if (!isVisible(itemRef)) return [];
              const text = this.text(item.text, undefined, "text", subTarget);
              if (!text) return [];
              return [
                {
                  refId: item.id,
                  kind: item.kind,
                  label:
                    item.kind === "key_value"
                      ? this.text(item.label, undefined, "label", subTarget)
                      : null,
                  text,
                },
              ];
            },
          );
          if (items.length === 0) continue;
          subsections.push({
            refId: subsection.id,
            title: this.text(subsection.title, undefined, "subsectionTitle", subTarget),
            items,
          });
        }
        return subsections.length > 0 ? { kind: "custom", subsections } : null;
      }
    }
  }

  sectionTitle(section: SectionDefinition): CvText {
    const target: IssueTarget = {
      sectionNodeId: section.nodeId,
      sectionKind: section.kind,
      refId: section.kind === "custom" ? section.refId : null,
      hint: null,
    };
    if (section.kind === "custom") {
      const record = this.master.customSections.find((candidate) => candidate.id === section.refId);
      return (
        this.text(record?.title, section.title, "sectionTitle", target) ?? {
          text: "",
          missing: false,
        }
      );
    }
    // Built-in headings always exist in both languages, so an override written
    // only for the other language simply falls back to the default heading.
    const own = section.title ? resolveLocalizedText(section.title, this.locale) : null;
    return { text: own ?? this.labels.sections[section.kind], missing: false };
  }
}

function stripProtocol(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export function resolveCv(
  definition: CvDefinition,
  master: MasterData,
  locale: Locale,
  labels: CvLabels,
): Resolution {
  const resolver = new Resolver(master, locale, labels);
  const header = resolver.header(definition.header);
  const sections: ResolvedSection[] = [];

  for (const section of definition.sections) {
    if (!section.visible) continue;
    const content = resolver.sectionContent(section);
    if (!content) continue;
    sections.push({ ...content, nodeId: section.nodeId, title: resolver.sectionTitle(section) });
  }

  return { cv: { locale, header, sections }, issues: resolver.issues };
}
