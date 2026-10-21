import { Fragment } from "react";
import type { CvLabels } from "@/features/cv-builder/labels";
import type {
  CvText,
  ResolvedContact,
  ResolvedCv,
  ResolvedEntry,
  ResolvedSection,
  ResolvedSectionOf,
} from "@/features/cv-builder/resolve";
import { cn } from "@/lib/utils";
import { poppins } from "../fonts";
import { splitSkillColumns } from "./layout";
import styles from "./classic-cv.module.css";

export const CLASSIC_REFERENCE_V1 = "classic-reference-v1";

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

const marginStyle = {
  "--cv-margin-top": `${PAGE_MARGINS_MM.firstTop}mm`,
  "--cv-margin-right": `${PAGE_MARGINS_MM.right}mm`,
  "--cv-margin-bottom": `${PAGE_MARGINS_MM.bottom}mm`,
  "--cv-margin-left": `${PAGE_MARGINS_MM.left}mm`,
  "--cv-rule-bleed": `${PAGE_MARGINS_MM.ruleBleed}mm`,
} as React.CSSProperties;

type ClassicCvProps = {
  cv: ResolvedCv;
  labels: CvLabels;
  photoUrl: string | null;
  className?: string;
};

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

/** "Title – Subtitle, Place", skipping whatever is absent. */
function EntryHeading({ entry }: { entry: ResolvedEntry }) {
  const parts: { key: string; separator: string; value: CvText }[] = [];
  if (entry.title) parts.push({ key: "title", separator: "", value: entry.title });
  if (entry.subtitle) {
    parts.push({ key: "subtitle", separator: parts.length ? " – " : "", value: entry.subtitle });
  }
  if (entry.place)
    parts.push({ key: "place", separator: parts.length ? ", " : "", value: entry.place });
  return parts.map((part) => (
    <Fragment key={part.key}>
      {part.separator}
      <Text value={part.value} />
    </Fragment>
  ));
}

function ContactRow({ items, colon }: { items: ResolvedContact[]; colon: string }) {
  if (items.length === 0) return null;
  return (
    <p>
      {items.map((item, index) => (
        <Fragment key={item.key}>
          {index > 0 ? (
            <span className={styles.contactSeparator} aria-hidden="true">
              |
            </span>
          ) : null}
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
        </Fragment>
      ))}
    </p>
  );
}

function Entries({
  section,
  labels,
}: {
  section: ResolvedSectionOf<"experience" | "education" | "projects" | "certifications">;
  labels: CvLabels;
}) {
  const compact = section.kind === "certifications";
  return section.entries.map((entry) => (
    <div key={entry.refId} className={styles.entry}>
      <div className={styles.entryHead}>
        <p className={compact ? styles.entryTitleRegular : styles.entryTitle}>
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
            <Text value={item.text} />
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

function SectionBody({ section, labels }: { section: ResolvedSection; labels: CvLabels }) {
  switch (section.kind) {
    case "summary":
      return (
        <p className={styles.paragraph}>
          <Text value={section.text} />
        </p>
      );
    case "technical_skills": {
      const columns =
        section.columns === 2
          ? splitSkillColumns(section.groups, section.rightStartsWith)
          : [section.groups];
      return (
        <div
          className={cn(styles.skills, styles.bleed, section.columns === 1 && styles.skillsSingle)}
        >
          {columns.map((groups, columnIndex) => (
            <div key={columnIndex} className={styles.skillColumn}>
              {groups.map((group) => (
                <p key={group.refId} className={styles.skillGroup}>
                  {group.title ? (
                    <span className={styles.strong}>
                      <Text value={group.title} />
                      {labels.colon}{" "}
                    </span>
                  ) : null}
                  {group.skills.map((skill, index) => (
                    <Fragment key={index}>
                      {index > 0 ? ", " : null}
                      <Text value={skill} />
                    </Fragment>
                  ))}
                </p>
              ))}
            </div>
          ))}
        </div>
      );
    }
    case "experience":
    case "education":
    case "projects":
    case "certifications":
      return <Entries section={section} labels={labels} />;
    case "soft_skills":
    case "languages":
      return (
        <div className={styles.spread}>
          {section.items.map((item) => (
            <p key={item.refId}>
              <Text value={item.text} />
              {item.detail ? (
                <>
                  {" ("}
                  <Text value={item.detail} />)
                </>
              ) : null}
            </p>
          ))}
        </div>
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

/**
 * The classic reference layout. Purely presentational (no state, no data
 * access), so the builder preview, the print page and the PDF export share
 * this exact markup.
 */
export function ClassicCv({ cv, labels, photoUrl, className }: ClassicCvProps) {
  const { header } = cv;
  const showPhoto = header.showPhoto && photoUrl !== null;
  const hasIdentity = header.title || header.name;

  return (
    <article
      lang={cv.locale}
      data-visual-template={CLASSIC_REFERENCE_V1}
      className={cn(styles.page, poppins.className, className)}
      style={marginStyle}
    >
      {hasIdentity || showPhoto ? (
        <header className={cn(styles.header, styles.bleed)}>
          <div className={styles.identity}>
            {header.title ? (
              <h1 className={styles.title}>
                <Text value={header.title} />
              </h1>
            ) : null}
            {header.name ? (
              header.title ? (
                <p className={styles.name}>{header.name}</p>
              ) : (
                <h1 className={styles.name}>{header.name}</h1>
              )
            ) : null}
          </div>
          {showPhoto ? (
            // A short-lived signed URL of a private file: next/image cannot cache it usefully.
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.photo} src={photoUrl} alt={labels.photoAlt} />
          ) : null}
        </header>
      ) : null}

      {header.contacts.length > 0 || header.links.length > 0 ? (
        <div className={cn(styles.contacts, styles.bleed)}>
          <ContactRow items={header.contacts} colon={labels.colon} />
          <ContactRow items={header.links} colon={labels.colon} />
        </div>
      ) : null}

      <div className={styles.sections}>
        {cv.sections.map((section) => (
          <section
            key={section.nodeId}
            className={cn(styles.section, section.kind === "projects" && styles.compact)}
            data-node-id={section.nodeId}
            data-section-kind={section.kind}
          >
            <h2 className={cn(styles.sectionTitle, styles.bleed)}>
              <Text value={section.title} />
            </h2>
            <SectionBody section={section} labels={labels} />
          </section>
        ))}
      </div>
    </article>
  );
}
