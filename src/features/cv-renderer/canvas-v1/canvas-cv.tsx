import { Fragment, memo } from "react";
import type { CvDefinition } from "@/features/cv-builder/definition";
import type { CvLabels } from "@/features/cv-builder/labels";
import type {
  CvText,
  ResolvedContact,
  ResolvedCv,
  ResolvedEntry,
  ResolvedSection,
} from "@/features/cv-builder/resolve";
import {
  isDecoration,
  type Design,
  type DesignElement,
  type FieldKind,
  type FontFamily,
} from "@/features/cv-design/design";
import { displayLocalizedText } from "@/lib/i18n/localized-text";
import { cn } from "@/lib/utils";
import { splitSkillColumns } from "../classic-reference-v1/layout";
import { inter, lora, poppins } from "../fonts";
import styles from "./canvas-cv.module.css";

export const CANVAS_V1 = "canvas-v1";

const FONT_CLASSES: Record<FontFamily, string> = {
  poppins: poppins.className,
  inter: inter.className,
  lora: lora.className,
};

/**
 * Career content by what a design element binds to: "section:<kind>" for a
 * built-in section, "custom:<refId>" for a custom one. Hidden or empty
 * sections resolve to nothing, so they are absent.
 */
export function sectionsByKey(
  definition: CvDefinition,
  cv: ResolvedCv,
): Map<string, ResolvedSection> {
  const resolved = new Map(cv.sections.map((section) => [section.nodeId, section]));
  const byKey = new Map<string, ResolvedSection>();
  for (const section of definition.sections) {
    const found = resolved.get(section.nodeId);
    if (!found) continue;
    byKey.set(
      section.kind === "custom" ? `custom:${section.refId}` : `section:${section.kind}`,
      found,
    );
  }
  return byKey;
}

function Text({ value }: { value: CvText | null | undefined }) {
  if (!value) return null;
  return value.missing ? (
    <span className={styles.missing} data-missing="">
      {value.text}
    </span>
  ) : (
    value.text
  );
}

function Contacts({
  items,
  inline,
  colon,
}: {
  items: readonly ResolvedContact[];
  inline: boolean;
  colon: string;
}) {
  const line = (item: ResolvedContact) => (
    <>
      <span className={styles.strong}>
        {item.label}
        {colon}
      </span>{" "}
      {item.href ? (
        <a href={item.href}>
          <Text value={item.value} />
        </a>
      ) : (
        <Text value={item.value} />
      )}
    </>
  );
  if (inline) {
    return (
      <p>
        {items.map((item, index) => (
          <Fragment key={item.key}>
            {index > 0 ? (
              <span className={styles.separator} aria-hidden="true">
                |
              </span>
            ) : null}
            {line(item)}
          </Fragment>
        ))}
      </p>
    );
  }
  return (
    <div className={styles.contacts}>
      {items.map((item) => (
        <p key={item.key}>{line(item)}</p>
      ))}
    </div>
  );
}

/** "Title – Subtitle, Place", skipping whatever is absent. */
function EntryHeading({ entry }: { entry: ResolvedEntry }) {
  const parts: { key: string; separator: string; value: CvText }[] = [];
  if (entry.title) parts.push({ key: "title", separator: "", value: entry.title });
  if (entry.subtitle) {
    parts.push({ key: "subtitle", separator: parts.length ? " – " : "", value: entry.subtitle });
  }
  if (entry.place) {
    parts.push({ key: "place", separator: parts.length ? ", " : "", value: entry.place });
  }
  return parts.map((part) => (
    <Fragment key={part.key}>
      {part.separator}
      <Text value={part.value} />
    </Fragment>
  ));
}

type Block = { kind: "bullet" | "paragraph"; text: CvText; label?: CvText | null };

/** Paragraphs and runs of consecutive bullets, in their original order. */
function Blocks({ blocks, colon }: { blocks: readonly Block[]; colon: string }) {
  const groups: { kind: Block["kind"]; items: Block[] }[] = [];
  for (const block of blocks) {
    const last = groups.at(-1);
    if (block.kind === "bullet" && last?.kind === "bullet") last.items.push(block);
    else groups.push({ kind: block.kind, items: [block] });
  }
  return groups.map((group, index) =>
    group.kind === "bullet" ? (
      <ul key={index} className={styles.bullets}>
        {group.items.map((item, itemIndex) => (
          <li key={itemIndex} className={styles.bullet}>
            <span>
              <Text value={item.text} />
            </span>
          </li>
        ))}
      </ul>
    ) : (
      <p key={index} className={styles.paragraph}>
        {group.items[0]?.label ? (
          <span className={styles.strong}>
            <Text value={group.items[0].label} />
            {colon}{" "}
          </span>
        ) : null}
        <Text value={group.items[0]?.text} />
      </p>
    ),
  );
}

/** Two columns read top to bottom: the first half on the left, then the rest. */
function Columns<T>({
  items,
  columns,
  render,
}: {
  items: readonly T[];
  columns: 1 | 2;
  render: (item: T) => React.ReactNode;
}) {
  if (columns === 1) return <div className={styles.list}>{items.map(render)}</div>;
  const split = Math.ceil(items.length / 2);
  return (
    <div className={styles.columns}>
      <div className={styles.column}>{items.slice(0, split).map(render)}</div>
      <div className={styles.column}>{items.slice(split).map(render)}</div>
    </div>
  );
}

function SectionBody({
  section,
  columns,
  labels,
}: {
  section: ResolvedSection;
  columns: 1 | 2;
  labels: CvLabels;
}) {
  switch (section.kind) {
    case "summary":
      return (
        <p className={styles.paragraph}>
          <Text value={section.text} />
        </p>
      );
    case "technical_skills": {
      const groups =
        columns === 2
          ? splitSkillColumns(section.groups, section.rightStartsWith)
          : [section.groups];
      const group = (item: (typeof section.groups)[number]) => (
        <p key={item.refId}>
          {item.title ? (
            <span className={styles.strong}>
              <Text value={item.title} />
              {labels.colon}{" "}
            </span>
          ) : null}
          {item.skills.map((skill, index) => (
            <Fragment key={index}>
              {index > 0 ? ", " : null}
              <Text value={skill} />
            </Fragment>
          ))}
        </p>
      );
      return groups.length === 1 ? (
        <div className={styles.list}>{groups[0]?.map(group)}</div>
      ) : (
        <div className={styles.columns}>
          {groups.map((column, index) => (
            <div key={index} className={styles.column}>
              {column.map(group)}
            </div>
          ))}
        </div>
      );
    }
    case "experience":
    case "education":
    case "projects":
    case "certifications":
      return section.entries.map((entry) => (
        <div key={entry.refId} className={styles.entry}>
          <div className={styles.entryHead}>
            <p
              className={
                section.kind === "certifications" ? styles.entryTitleRegular : styles.entryTitle
              }
            >
              <EntryHeading entry={entry} />
            </p>
            {entry.date ? <p className={styles.date}>{entry.date}</p> : null}
          </div>
          {entry.links.length > 0 ? (
            <p className={styles.links}>
              {entry.links.map((link, index) => (
                <Fragment key={link.href}>
                  {index > 0 ? " · " : null}
                  {link.label}
                  {labels.colon} <a href={link.href}>{link.text}</a>
                </Fragment>
              ))}
            </p>
          ) : null}
          <Blocks blocks={entry.body} colon={labels.colon} />
          {entry.technologies.length > 0 ? (
            <>
              <p className={styles.techLabel}>
                {labels.technologies}
                {labels.colon}
              </p>
              <p className={styles.techList}>
                {entry.technologies.map((technology, index) => (
                  <Fragment key={index}>
                    {index > 0 ? ", " : null}
                    <Text value={technology} />
                  </Fragment>
                ))}
              </p>
            </>
          ) : null}
        </div>
      ));
    case "soft_skills":
    case "languages":
      return (
        <Columns
          items={section.items}
          columns={columns}
          render={(item) => (
            <p key={item.refId}>
              <Text value={item.text} />
              {item.detail ? (
                <>
                  {" ("}
                  <Text value={item.detail} />)
                </>
              ) : null}
            </p>
          )}
        />
      );
    case "custom":
      return section.subsections.map((subsection) => (
        <div key={subsection.refId} className={styles.subsection}>
          {subsection.title ? (
            <p className={styles.subsectionTitle}>
              <Text value={subsection.title} />
            </p>
          ) : null}
          <Blocks
            colon={labels.colon}
            blocks={subsection.items.map((item) => ({
              kind: item.kind === "bullet" ? "bullet" : "paragraph",
              text: item.text,
              label: item.label,
            }))}
          />
        </div>
      ));
  }
}

type CanvasCvProps = {
  design: Design;
  /** The composition the CV content was resolved from: binds sections to elements. */
  definition: CvDefinition;
  cv: ResolvedCv;
  labels: CvLabels;
  photoUrl: string | null;
  /**
   * In the designer: what an element without content will hold, shown in its
   * place. Elsewhere such elements are simply empty.
   */
  placeholder?: (element: DesignElement) => string;
  /** Precomputed by the designer, which redraws often; derived here otherwise. */
  sections?: Map<string, ResolvedSection>;
  className?: string;
};

/** The inline style of an element: its box in millimetres and its look. */
function boxStyle(element: DesignElement): React.CSSProperties {
  const { style } = element;
  const decoration = isDecoration(element.content);
  return {
    left: `${element.x}mm`,
    top: `${element.y}mm`,
    width: `${element.w}mm`,
    ...(element.autoHeight && !decoration
      ? { minHeight: `${element.h}mm` }
      : { height: `${element.h}mm` }),
    padding: element.content.type === "line" ? 0 : `${style.padding}mm`,
    color: style.color,
    fontSize: `${style.size}pt`,
    fontWeight: style.weight,
    lineHeight: style.lineHeight,
    textAlign: style.align,
    background: style.background ?? undefined,
    border:
      style.borderWidth > 0 && element.content.type !== "line"
        ? `${style.borderWidth}pt solid ${style.borderColor}`
        : undefined,
    borderRadius:
      element.content.type === "photo" && element.content.shape === "circle"
        ? "50%"
        : `${style.radius}mm`,
    ...({
      "--accent": style.accent,
      "--line-width": `${Math.max(style.borderWidth, 0.25)}pt`,
      "--heading-rule":
        (element.content.type === "section" || element.content.type === "custom") &&
        element.content.rule
          ? "0.75pt"
          : "0",
    } as React.CSSProperties),
  };
}

function FieldContent({
  field,
  inline,
  cv,
  labels,
  upper,
  empty,
}: {
  field: FieldKind;
  inline: boolean;
  cv: ResolvedCv;
  labels: CvLabels;
  upper: string | undefined;
  empty: React.ReactNode;
}) {
  const { header } = cv;
  switch (field) {
    case "name":
      return header.name ? <h1 className={upper}>{header.name}</h1> : empty;
    case "title":
      return header.title ? (
        <p className={upper}>
          <Text value={header.title} />
        </p>
      ) : (
        empty
      );
    case "contacts":
    case "links": {
      const items = field === "contacts" ? header.contacts : header.links;
      return items.length > 0 ? (
        <Contacts items={items} inline={inline} colon={labels.colon} />
      ) : (
        empty
      );
    }
  }
}

type ElementBoxProps = {
  element: DesignElement;
  sections: Map<string, ResolvedSection>;
  cv: ResolvedCv;
  labels: CvLabels;
  photoUrl: string | null;
  placeholder?: (element: DesignElement) => string;
};

/** One element. Memoized: moving one box in the designer redraws only that box. */
const ElementBox = memo(function ElementBox({
  element,
  sections,
  cv,
  labels,
  photoUrl,
  placeholder,
}: ElementBoxProps) {
  const empty = placeholder ? (
    <span className={styles.placeholder}>{placeholder(element)}</span>
  ) : null;
  const upper = element.style.uppercase ? styles.upper : undefined;
  const { content: binding } = element;
  const decoration = isDecoration(binding);

  let content: React.ReactNode = null;
  switch (binding.type) {
    case "field":
      content = (
        <FieldContent
          field={binding.field}
          inline={binding.inline}
          cv={cv}
          labels={labels}
          upper={upper}
          empty={empty}
        />
      );
      break;
    case "section":
    case "custom": {
      const key =
        binding.type === "section" ? `section:${binding.section}` : `custom:${binding.refId}`;
      const section = sections.get(key);
      content = section ? (
        <section data-section-kind={section.kind}>
          {binding.showTitle ? (
            <h2 className={cn(styles.heading, element.style.uppercase && styles.headingUpper)}>
              <Text value={section.title} />
            </h2>
          ) : null}
          <SectionBody
            section={section}
            columns={binding.type === "section" ? binding.columns : 1}
            labels={labels}
          />
        </section>
      ) : (
        empty
      );
      break;
    }
    case "text": {
      const text = displayLocalizedText(binding.text, cv.locale);
      content = text ? (
        <p className={upper}>
          <Text value={{ text: text.text, missing: text.locale !== null }} />
        </p>
      ) : (
        empty
      );
      break;
    }
    case "photo":
      content = photoUrl ? (
        // A short-lived signed URL of a private file: next/image cannot cache it usefully.
        // eslint-disable-next-line @next/next/no-img-element
        <img className={styles.photo} src={photoUrl} alt={labels.photoAlt} />
      ) : placeholder ? (
        <span className={styles.photoPlaceholder} />
      ) : null;
      break;
    case "line":
    case "shape":
      break;
  }

  return (
    <div
      data-element-id={element.id}
      // Lines and shapes are pure decoration; the portrait keeps its alternative text.
      aria-hidden={binding.type === "line" || binding.type === "shape" ? true : undefined}
      className={cn(
        styles.element,
        FONT_CLASSES[element.style.font],
        (!element.autoHeight || decoration) && styles.fixed,
        binding.type === "line" &&
          (element.h > element.w ? cn(styles.line, styles.lineVertical) : styles.line),
      )}
      style={boxStyle(element)}
    >
      {content}
    </div>
  );
});

/**
 * Free-form designs. Purely presentational (no state, no data access), so the
 * designer, the gallery thumbnails, the builder preview, the print page and
 * the PDF share this markup. Decorations come first and lie under the text;
 * the text elements follow in reading order.
 */
export function CanvasCv({
  design,
  definition,
  cv,
  labels,
  photoUrl,
  placeholder,
  sections,
  className,
}: CanvasCvProps) {
  const bound = sections ?? sectionsByKey(definition, cv);
  const pages = Array.from({ length: design.pages }, (_, page) => page);
  return (
    <article
      lang={cv.locale}
      data-visual-template={CANVAS_V1}
      className={cn(styles.document, className)}
    >
      {pages.map((page) => {
        const onPage = design.elements.filter((element) => element.page === page);
        // Decorations first: drawn under the text, outside the reading order.
        const ordered = [
          ...onPage.filter((element) => isDecoration(element.content)),
          ...onPage.filter((element) => !isDecoration(element.content)),
        ];
        return (
          <div
            key={page}
            className={styles.page}
            style={{ background: design.background }}
            data-page={page}
          >
            {ordered.map((element) => (
              <ElementBox
                key={element.id}
                element={element}
                sections={bound}
                cv={cv}
                labels={labels}
                photoUrl={photoUrl}
                placeholder={placeholder}
              />
            ))}
          </div>
        );
      })}
    </article>
  );
}
