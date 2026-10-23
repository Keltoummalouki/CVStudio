"use client";

import { useTranslations } from "next-intl";
import type { MasterData } from "@/features/cv-builder/master-data";
import { cn } from "@/lib/utils";
import { DESIGN_SECTION_KINDS, FIELD_KINDS, uniqueKey, type ElementContent } from "../design";
import { ElementIconView } from "./element-icon-view";
import { elementIcon } from "./use-element-label";

/** What each palette item adds, with the options a new element starts with. */
export function paletteContents(master: MasterData, defaultText: string) {
  const profile: ElementContent[] = [
    ...FIELD_KINDS.map((field): ElementContent => ({ type: "field", field, inline: false })),
    { type: "photo", shape: "circle" },
  ];
  const sections: ElementContent[] = [
    ...DESIGN_SECTION_KINDS.map((section): ElementContent => ({
      type: "section",
      section,
      showTitle: true,
      rule: true,
      columns: section === "technical_skills" ? 2 : 1,
    })),
    ...master.customSections
      .filter((section) => !section.archived)
      .map((section): ElementContent => ({
        type: "custom",
        refId: section.id,
        showTitle: true,
        rule: true,
      })),
  ];
  const basics: ElementContent[] = [
    { type: "text", text: { shared: defaultText } },
    { type: "line" },
    { type: "shape" },
  ];
  return { profile, sections, basics };
}

type ElementPaletteProps = {
  master: MasterData;
  /** Unique contents already on the page. */
  placed: ReadonlySet<string>;
  label: (content: ElementContent) => string;
  onAdd: (content: ElementContent) => void;
};

/** Everything that can go on the page; a click adds it below what is already there. */
export function ElementPalette({ master, placed, label, onAdd }: ElementPaletteProps) {
  const t = useTranslations("designer.palette");
  const tDesigner = useTranslations("designer");
  const groups = paletteContents(master, tDesigner("defaultText"));

  return (
    <nav aria-label={t("title")} className="flex flex-col gap-5 p-4">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">{t("title")}</h2>
        <p className="text-xs leading-relaxed text-muted-foreground">{t("hint")}</p>
      </div>
      {(["profile", "sections", "basics"] as const).map((group) => (
        <section key={group} aria-labelledby={`palette-${group}`} className="space-y-1.5">
          <h3
            id={`palette-${group}`}
            className="text-[0.6875rem] font-semibold tracking-[0.08em] text-muted-foreground uppercase"
          >
            {t(group)}
          </h3>
          <ul className="grid grid-cols-2 gap-1.5 lg:grid-cols-1">
            {groups[group].map((content) => {
              const key = uniqueKey(content);
              const onPage = key !== null && placed.has(key);
              const name = label(content);
              return (
                <li key={key ?? content.type}>
                  <button
                    type="button"
                    disabled={onPage}
                    // Once placed, the visible "On the page" says why it is unavailable.
                    aria-label={onPage ? undefined : t("add", { name })}
                    onClick={() => onAdd(content)}
                    className={cn(
                      "flex min-h-10 w-full items-center gap-2.5 rounded-md border px-2.5 py-2 text-left text-sm transition-colors outline-none focus-visible:focus-ring pointer-coarse:min-h-11",
                      onPage
                        ? "cursor-default border-transparent bg-ink-50 text-muted-foreground"
                        : "border-border bg-card hover:border-ink-400 hover:bg-ink-50",
                    )}
                  >
                    <ElementIconView icon={elementIcon(content)} className="size-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{name}</span>
                    {/* The space keeps "Name" and "On the page" apart when read aloud. */}
                    {onPage ? (
                      <>
                        {" "}
                        <span className="shrink-0 text-[0.6875rem]">{t("placed")}</span>
                      </>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );
}
