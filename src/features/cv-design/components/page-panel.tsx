"use client";

import {
  ArrowDownIcon,
  ArrowDownWideNarrowIcon,
  ArrowUpIcon,
  MinusIcon,
  PlusIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { MAX_PAGES, type Design, type DesignElement } from "../design";
import type { LayoutIssue } from "../layout";
import { moveInReadingOrder, readingOrder, setPageCount, sortReadingOrder } from "../operations";
import { ColorField, PropertyGroup } from "./property-fields";
import { ElementIconView } from "./element-icon-view";
import { elementIcon } from "./use-element-label";

type IssueListProps = {
  issues: readonly LayoutIssue[];
  nameOf: (id: string) => string;
  onSelect: (id: string) => void;
};

/** What blocks export: text cut off, past the page, or overlapping other text. */
export function IssueList({ issues, nameOf, onSelect }: IssueListProps) {
  const t = useTranslations("designer.issues");
  return (
    <section aria-labelledby="design-issues" className="space-y-2 px-4 py-4">
      <h2 id="design-issues" className="text-sm font-semibold">
        {t("title")}
      </h2>
      {issues.length === 0 ? (
        <p className="text-xs leading-relaxed text-muted-foreground">{t("none")}</p>
      ) : (
        <ul className="space-y-1.5">
          {issues.map((issue, index) => {
            const name = nameOf(issue.id);
            const text =
              issue.kind === "overlap"
                ? t("overlap", { name, other: nameOf(issue.other) })
                : t(issue.kind, { name });
            return (
              <li key={index}>
                <button
                  type="button"
                  aria-label={`${text} ${t("select", { name })}`}
                  onClick={() => onSelect(issue.id)}
                  className="w-full rounded-md border border-destructive/30 bg-destructive-soft px-3 py-2 text-left text-xs leading-relaxed text-destructive transition-colors outline-none hover:border-destructive/60 focus-visible:focus-ring"
                >
                  {text}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

type PagePanelProps = {
  design: Design;
  nameOf: (element: DesignElement) => string;
  onChange: (change: (design: Design) => Design) => void;
  onSelect: (id: string) => void;
};

/** With nothing selected: the page itself, and the order the CV's text is read in. */
export function PagePanel({ design, nameOf, onChange, onSelect }: PagePanelProps) {
  const t = useTranslations("designer.page");
  const order = readingOrder(design);
  const lastPageUsed = design.elements.some((element) => element.page === design.pages - 1);

  return (
    <div className="flex flex-col">
      <div className="px-4 py-3">
        <h2 className="text-sm font-semibold">{t("title")}</h2>
      </div>
      <PropertyGroup title={t("title")}>
        <ColorField
          label={t("background")}
          value={design.background}
          onChange={(background) => onChange((current) => ({ ...current, background }))}
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm">
            {t("pages")} <span className="tabular-nums">{design.pages}</span>
          </p>
          <div className="flex gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={t("removePage")}
              title={lastPageUsed ? t("removePageBlocked") : t("removePage")}
              disabled={design.pages <= 1 || lastPageUsed}
              onClick={() => onChange((current) => setPageCount(current, current.pages - 1))}
            >
              <MinusIcon aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={t("addPage")}
              title={t("addPage")}
              disabled={design.pages >= MAX_PAGES}
              onClick={() => onChange((current) => setPageCount(current, current.pages + 1))}
            >
              <PlusIcon aria-hidden="true" />
            </Button>
          </div>
        </div>
      </PropertyGroup>

      <PropertyGroup title={t("readingOrder")}>
        <p className="text-xs leading-relaxed text-muted-foreground">{t("readingOrderHint")}</p>
        {order.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("noText")}</p>
        ) : (
          <>
            <ol className="space-y-1">
              {order.map((element, index) => {
                const name = nameOf(element);
                return (
                  <li key={element.id} className="flex items-center gap-1">
                    <span className="w-5 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                      {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => onSelect(element.id)}
                      className="flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left text-sm transition-colors outline-none hover:bg-ink-100 focus-visible:focus-ring"
                    >
                      <ElementIconView
                        icon={elementIcon(element.content)}
                        className="size-3.5 shrink-0 text-muted-foreground"
                      />
                      <span className="truncate">{name}</span>
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("up", { name })}
                      disabled={index === 0}
                      onClick={() =>
                        onChange((current) => moveInReadingOrder(current, element.id, -1))
                      }
                    >
                      <ArrowUpIcon aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("down", { name })}
                      disabled={index === order.length - 1}
                      onClick={() =>
                        onChange((current) => moveInReadingOrder(current, element.id, 1))
                      }
                    >
                      <ArrowDownIcon aria-hidden="true" />
                    </Button>
                  </li>
                );
              })}
            </ol>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange((current) => sortReadingOrder(current))}
            >
              <ArrowDownWideNarrowIcon aria-hidden="true" />
              {t("sort")}
            </Button>
          </>
        )}
      </PropertyGroup>
    </div>
  );
}
