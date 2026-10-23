"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowUpRightIcon,
  CopyIcon,
  DownloadIcon,
  EllipsisIcon,
  FileSearchIcon,
  InfoIcon,
  PencilLineIcon,
  PrinterIcon,
  SearchIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { DocumentGlyph } from "@/components/feedback/document-glyph";
import { Pagination } from "@/components/layout/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCvExport } from "@/features/cv-export/components/use-cv-export";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { pageCountOf, parsePage } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import { deleteCv, duplicateCv, restoreCv } from "../server/actions";
import type { CvListItem } from "../server/queries";

export const CV_PAGE_SIZE = 10;

const FILTERS = ["all", "ready", "attention"] as const;
type Filter = (typeof FILTERS)[number];

/** What the list shows: kept in the address bar as ?q=…&status=…&page=…. */
type View = { search: string; filter: Filter; page: number };

function readView(params: URLSearchParams | null): View {
  const status = params?.get("status");
  return {
    search: params?.get("q") ?? "",
    filter: FILTERS.find((filter) => filter === status) ?? "all",
    page: parsePage(params?.get("page")),
  };
}

function viewQuery(view: View): string {
  const params = new URLSearchParams();
  if (view.search) params.set("q", view.search);
  if (view.filter !== "all") params.set("status", view.filter);
  if (view.page > 1) params.set("page", String(view.page));
  return params.toString();
}

/**
 * The view follows the URL: going back from a CV returns to the same page and
 * search. The list writes the URL itself (no navigation, nothing refetched);
 * a navigation to another view of this page, such as the CVs link while on
 * page 3, is adopted from the URL.
 */
function useListView() {
  const params = useSearchParams();
  const urlQuery = params?.toString() ?? "";
  const [view, setView] = useState(() => readView(params));
  const [seenQuery, setSeenQuery] = useState(urlQuery);

  if (urlQuery !== seenQuery) {
    setSeenQuery(urlQuery);
    // The list's own updates come back here with the values it already shows.
    const fromUrl = readView(params);
    if (viewQuery(fromUrl) !== viewQuery(view)) setView(fromUrl);
  }

  const show = (next: View) => {
    setView(next);
    const query = viewQuery(next);
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  };
  return [view, show] as const;
}

function StatusBadge({ cv }: { cv: CvListItem }) {
  const t = useTranslations("cvs.status");
  if (cv.missingTranslations === null)
    return <Badge variant="destructive">{t("unreadable")}</Badge>;
  if (cv.missingTranslations > 0) {
    return <Badge variant="signal">{t("toTranslate", { count: cv.missingTranslations })}</Badge>;
  }
  if (cv.warnings > 0)
    return <Badge variant="warning">{t("warnings", { count: cv.warnings })}</Badge>;
  return <Badge variant="success">{t("ready")}</Badge>;
}

type CvListProps = {
  cvs: readonly CvListItem[];
  /** All of the owner's CVs; more than `cvs` when the oldest were left out of the list. */
  total?: number;
};

export function CvList({ cvs, total = cvs.length }: CvListProps) {
  const t = useTranslations("cvs");
  const format = useFormatter();
  const router = useRouter();
  const searchId = useId();
  const [view, show] = useListView();
  const { search, filter } = view;
  const [deleting, setDeleting] = useState<CvListItem | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const movedPage = useRef(false);
  const tExport = useTranslations("cvExport");
  const exporter = useCvExport();
  /** Exports need every shown text in the CV language; the editor lists what is missing. */
  const exportable = (cv: CvListItem) => {
    if (cv.missingTranslations === 0) return true;
    toast.error(
      cv.missingTranslations === null
        ? t("actionFailed")
        : tExport("errors.missing_translations", { count: cv.missingTranslations }),
    );
    return false;
  };
  const needsAttention = (cv: CvListItem) => cv.missingTranslations !== 0 || cv.warnings > 0;
  const counts = {
    all: cvs.length,
    ready: cvs.filter((cv) => !needsAttention(cv)).length,
    attention: cvs.filter(needsAttention).length,
  };
  const query = search.trim().toLocaleLowerCase();
  const filtered = cvs.filter((cv) => {
    const matchesSearch = `${cv.name} ${cv.createdFromTemplateName ?? ""}`
      .toLocaleLowerCase()
      .includes(query);
    return (
      matchesSearch &&
      (filter === "all" || (filter === "attention" ? needsAttention(cv) : !needsAttention(cv)))
    );
  });
  const pageCount = pageCountOf(filtered.length, CV_PAGE_SIZE);
  // A page beyond the end (e.g. after deleting the last CV of the last page) shows the last one.
  const page = Math.min(view.page, pageCount);
  const first = (page - 1) * CV_PAGE_SIZE;
  const shown = filtered.slice(first, first + CV_PAGE_SIZE);

  const setSearch = (value: string) => show({ ...view, search: value, page: 1 });
  const setFilter = (value: Filter) => show({ ...view, filter: value, page: 1 });
  const goToPage = (value: number) => {
    if (value === page) return;
    movedPage.current = true;
    show({ ...view, page: value });
  };

  // After a page change, the new page starts where the reader is: its first CV is the next Tab stop.
  useEffect(() => {
    if (!movedPage.current) return;
    movedPage.current = false;
    listRef.current?.focus({ preventScroll: true });
    listRef.current?.scrollIntoView({ block: "start" });
  }, [page]);

  const duplicate = async (cv: CvListItem) => {
    const result = await duplicateCv(cv.id, t("copyName", { name: cv.name }));
    if (result.ok) toast.success(t("duplicated"));
    else toast.error(t("actionFailed"));
  };

  const remove = async () => {
    if (!deleting) return;
    const cv = deleting;
    const result = await deleteCv(cv.id);
    if (!result.ok) throw new Error(result.error);
    toast.success(t("deleted", { name: cv.name }), {
      action: {
        label: t("undo"),
        onClick: () => {
          void restoreCv(cv.id).then((restored) => {
            if (!restored.ok) toast.error(t("actionFailed"));
          });
        },
      },
    });
  };

  return (
    <>
      <div className="flex flex-col gap-4 border-b px-4 py-5 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold tracking-[-0.02em]">{t("library.title")}</h2>
          <div className="relative sm:w-64">
            <label htmlFor={searchId} className="sr-only">
              {t("library.search")}
            </label>
            <SearchIcon
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id={searchId}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("library.search")}
              className="bg-ink-50 pr-10 pl-9 [&::-webkit-search-cancel-button]:hidden"
            />
            {search ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t("library.clearSearch")}
                onClick={() => setSearch("")}
                className="absolute top-1/2 right-1 -translate-y-1/2"
              >
                <XIcon aria-hidden="true" />
              </Button>
            ) : null}
          </div>
        </div>
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label={t("library.filter")}
        >
          {FILTERS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={filter === option}
              onClick={() => setFilter(option)}
              className={cn(
                "flex min-h-9 items-center gap-2 rounded-full px-3 text-xs font-medium transition-colors outline-none focus-visible:focus-ring pointer-coarse:min-h-11",
                filter === option
                  ? "bg-ink-950 text-paper"
                  : "bg-ink-100 text-muted-foreground hover:bg-ink-150 hover:text-foreground",
              )}
            >
              {t(`library.${option}`)}{" "}
              <span
                className={cn(
                  "tabular-nums",
                  filter === option ? "text-paper/70" : "text-muted-foreground",
                )}
              >
                {counts[option]}
              </span>
            </button>
          ))}
          <span className="sr-only" role="status">
            {t("library.results", { count: filtered.length })}
          </span>
        </div>
        {total > cvs.length ? (
          <p className="flex gap-2 text-[0.8125rem] text-muted-foreground">
            <InfoIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {t("library.truncated", { shown: cvs.length, total })}
          </p>
        ) : null}
      </div>
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <FileSearchIcon aria-hidden="true" className="mb-1 size-8 text-muted-foreground" />
          <h3 className="text-lg font-semibold">{t("library.noResults")}</h3>
          <p className="max-w-sm text-sm text-muted-foreground">{t("library.noResultsHint")}</p>
          <Button
            type="button"
            variant="outline"
            className="mt-2"
            onClick={() => show({ search: "", filter: "all", page: 1 })}
          >
            {t("library.reset")}
          </Button>
        </div>
      ) : (
        <ul
          ref={listRef}
          tabIndex={-1}
          aria-label={
            pageCount > 1 ? t("library.pageLabel", { page, count: pageCount }) : undefined
          }
          className="scroll-mt-24 divide-y outline-none"
        >
          {shown.map((cv) => (
            <li
              key={cv.id}
              className="group/document flex items-center gap-2 pr-3 transition-colors hover:bg-ink-50 sm:pr-5"
            >
              <Link
                href={`/dashboard/cvs/${cv.id}`}
                className="flex min-w-0 flex-1 items-center gap-4 px-4 py-5 focus-visible:-outline-offset-2 sm:gap-5 sm:px-6 sm:py-6"
              >
                <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-ink-100 transition-colors group-hover/document:bg-ink-150 sm:size-16">
                  <DocumentGlyph className="w-7" />
                </span>
                <span className="min-w-0 flex-1 space-y-2">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-base font-semibold tracking-[-0.015em]">
                      {cv.name}
                    </span>
                    <ArrowUpRightIcon
                      aria-hidden="true"
                      className="size-4 shrink-0 text-muted-foreground transition-colors group-hover/document:text-signal"
                    />
                  </span>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <Badge variant="outline" className="font-semibold tracking-[0.04em]">
                      {cv.locale.toUpperCase()}
                    </Badge>
                    <StatusBadge cv={cv} />
                  </span>
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <time dateTime={cv.updatedAt}>
                      {t("updated", {
                        date: format.dateTime(new Date(cv.updatedAt), { dateStyle: "medium" }),
                      })}
                    </time>
                    {cv.createdFromTemplateName ? (
                      <span className="truncate">
                        {t("fromTemplate", { name: cv.createdFromTemplateName })}
                      </span>
                    ) : null}
                  </span>
                </span>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("moreActions", { name: cv.name })}
                  >
                    <EllipsisIcon aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => router.push(`/dashboard/cvs/${cv.id}`)}>
                    <PencilLineIcon aria-hidden="true" />
                    {t("open")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      if (exportable(cv)) exporter.openPrint(cv.id);
                    }}
                  >
                    <PrinterIcon aria-hidden="true" />
                    {tExport("print")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={exporter.downloading}
                    onSelect={() => {
                      if (exportable(cv)) void exporter.downloadPdf(cv.id, cv.name);
                    }}
                  >
                    <DownloadIcon aria-hidden="true" />
                    {tExport("download")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => void duplicate(cv)}>
                    <CopyIcon aria-hidden="true" />
                    {t("duplicate")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(cv)}>
                    <Trash2Icon aria-hidden="true" />
                    {t("delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      )}
      {pageCount > 1 ? (
        <div className="flex flex-col gap-3 border-t px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs text-muted-foreground tabular-nums">
            {t("library.range", {
              from: first + 1,
              to: first + shown.length,
              total: filtered.length,
            })}
          </p>
          <Pagination
            page={page}
            pageCount={pageCount}
            onPageChange={goToPage}
            label={t("library.pages")}
          />
        </div>
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={t("deleteTitle", { name: deleting?.name ?? "" })}
        description={t("deleteDescription")}
        confirmLabel={t("delete")}
        tone="destructive"
        onConfirm={remove}
      />
    </>
  );
}
