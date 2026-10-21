import { ArrowRightIcon, CheckIcon, LanguagesIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { DocumentGlyph } from "@/components/feedback/document-glyph";
import { NewCvAction } from "@/components/layout/new-cv-action";
import { Panel, PanelHeader } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Link } from "@/lib/i18n/navigation";
import type { RecentCv } from "../overview";

function RecentCvRow({ cv }: { cv: RecentCv }) {
  const t = useTranslations("overview.recentCvs");
  const format = useFormatter();

  return (
    <li>
      <Link
        href={`/dashboard/cvs/${cv.id}`}
        className="group flex items-center gap-4 px-5 py-5 transition-colors hover:bg-ink-50 focus-visible:-outline-offset-2 sm:px-6"
      >
        <span className="flex size-14 shrink-0 items-center justify-center rounded-md bg-ink-100">
          <DocumentGlyph />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{cv.name}</span>
          <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <Badge variant="outline" className="font-semibold tracking-[0.04em]">
              {cv.locale.toUpperCase()}
            </Badge>
            <time dateTime={cv.updatedAt} className="tabular-nums">
              {t("updated", {
                date: format.dateTime(new Date(cv.updatedAt), { dateStyle: "medium" }),
              })}
            </time>
          </span>
          {cv.missingTranslations === null ? null : (
            <span className="mt-2 block">
              {cv.missingTranslations > 0 ? (
                <Badge variant="warning">
                  <LanguagesIcon aria-hidden="true" />
                  {t("needsTranslation")}
                </Badge>
              ) : (
                <Badge variant="success">
                  <CheckIcon aria-hidden="true" />
                  {t("ready")}
                </Badge>
              )}
            </span>
          )}
        </span>
        <ArrowRightIcon
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground transition-transform duration-(--duration-base) ease-out-expo group-hover:translate-x-0.5 motion-reduce:transform-none"
        />
      </Link>
    </li>
  );
}

export function RecentCvs({ cvs, className }: { cvs: readonly RecentCv[]; className?: string }) {
  const t = useTranslations("overview.recentCvs");

  return (
    <Panel aria-labelledby="recent-cvs-title" className={className}>
      <PanelHeader
        titleId="recent-cvs-title"
        title={t("title")}
        description={t("description")}
        aside={
          cvs.length > 0 ? (
            <Link
              href="/dashboard/cvs"
              className="inline-flex min-h-8 items-center gap-1.5 rounded-sm text-[0.8125rem] font-medium underline decoration-ink-300 underline-offset-4 hover:decoration-foreground pointer-coarse:min-h-11"
            >
              {t("viewAll")}
              <ArrowRightIcon aria-hidden="true" className="size-3.5" />
            </Link>
          ) : null
        }
      />
      {cvs.length === 0 ? (
        <Empty className="min-h-72 flex-1 gap-5 px-6 py-8 sm:px-8">
          <div
            aria-hidden="true"
            className="flex size-16 items-center justify-center rounded-lg bg-ink-100"
          >
            <DocumentGlyph className="w-8" />
          </div>
          <EmptyHeader>
            <EmptyTitle>{t("empty.title")}</EmptyTitle>
            <EmptyDescription className="max-w-md">{t("empty.description")}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="justify-center">
            <NewCvAction variant="outline" />
          </EmptyContent>
        </Empty>
      ) : (
        <ul className="divide-y overflow-hidden rounded-b-lg">
          {cvs.map((cv) => (
            <RecentCvRow key={cv.id} cv={cv} />
          ))}
        </ul>
      )}
    </Panel>
  );
}
