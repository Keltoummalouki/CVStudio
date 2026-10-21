"use client";

import { useId, useState, useTransition } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  ChevronDownIcon,
  EllipsisIcon,
  LanguagesIcon,
  PencilIcon,
  SearchIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { LocaleCoverage } from "@/components/feedback/locale-coverage";
import { SaveStatus } from "@/components/feedback/save-status";
import { SortableList } from "@/components/forms/sortable-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatPeriod } from "@/lib/dates/period";
import type { Locale } from "@/lib/i18n/config";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { displayLocalizedText } from "@/lib/i18n/localized-text";
import { cn } from "@/lib/utils";
import type { RecordKind } from "../record-kinds";
import {
  deleteArchivedRecord,
  getRecordReferences,
  reorderRecords,
  setRecordArchived,
  type RecordReferences,
} from "../server/actions";
import type { RecordListItem } from "../server/queries";

type PendingDialog = { type: "archive" | "delete"; item: RecordListItem } | null;

function useRecordLabel() {
  const t = useTranslations("careerData.records");
  const locale = useLocale() as Locale;
  return (item: RecordListItem) => displayLocalizedText(item.title, locale)?.text ?? t("untitled");
}

function RecordSummary({ item, href }: { item: RecordListItem; href: string }) {
  const t = useTranslations("careerData");
  const locale = useLocale() as Locale;
  const title = displayLocalizedText(item.title, locale);
  const context = item.localizedContext
    ? displayLocalizedText(item.localizedContext, locale)?.text
    : null;
  const period = item.period ? formatPeriod(item.period, locale, t("period.present")) : "";
  const meta = [item.context, context, period].filter(Boolean).join(" · ");

  return (
    <Link
      href={href}
      className="group/record block min-w-0 flex-1 rounded-sm py-0.5 focus-visible:-outline-offset-2"
    >
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span className="line-clamp-2 text-sm font-semibold break-words group-hover/record:underline group-hover/record:decoration-ink-300 group-hover/record:underline-offset-4">
          {title?.text ?? t("records.untitled")}
        </span>
        {title?.locale ? (
          <Badge variant="outline" className="font-semibold tracking-[0.04em]">
            {title.locale.toUpperCase()}
          </Badge>
        ) : null}
        {item.archived ? <Badge variant="secondary">{t("records.archivedBadge")}</Badge> : null}
      </span>
      {meta ? (
        <span className="mt-1 line-clamp-2 block text-[0.8125rem]/relaxed text-muted-foreground">
          {meta}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * Records of one section: reorder (optimistic, rolled back on failure),
 * archive with an impact check, restore, and permanent deletion of archived
 * records only.
 */
export function RecordList({
  kind,
  items,
  hrefBase,
}: {
  kind: RecordKind;
  items: RecordListItem[];
  hrefBase: string;
}) {
  const t = useTranslations("careerData.records");
  const workspace = useTranslations("careerWorkspace.records");
  const router = useRouter();
  const labelOf = useRecordLabel();
  const active = items.filter((item) => !item.archived);
  const archived = items.filter((item) => item.archived);
  const [order, setOrder] = useState(() => active.map((item) => item.id));
  const [showArchived, setShowArchived] = useState(false);
  const [query, setQuery] = useState("");
  const [translationOnly, setTranslationOnly] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const archivedId = useId();
  const [dialog, setDialog] = useState<PendingDialog>(null);
  const [references, setReferences] = useState<RecordReferences | null>(null);
  const [, startTransition] = useTransition();

  const byId = new Map(items.map((item) => [item.id, item]));
  const ordered = order.map((id) => byId.get(id)).filter((item): item is RecordListItem => !!item);
  const searchText = query.trim().toLocaleLowerCase();
  const isFiltered = searchText.length > 0 || translationOnly;
  const filtered = ordered.filter((item) => {
    const text = [
      ...Object.values(item.title),
      item.context,
      ...Object.values(item.localizedContext ?? {}),
    ]
      .join(" ")
      .toLocaleLowerCase();
    return (
      (!searchText || text.includes(searchText)) &&
      (!translationOnly || !item.coverage.en || !item.coverage.fr)
    );
  });

  function clearFilters() {
    setQuery("");
    setTranslationOnly(false);
  }

  function move(from: number, to: number) {
    if (isFiltered || isReordering) return;
    const previous = order;
    const next = arrayMove(order, from, to);
    setOrder(next);
    setIsReordering(true);
    startTransition(async () => {
      const result = await reorderRecords(kind, next).catch(() => null);
      if (!result?.ok) {
        setOrder(previous);
        toast.error(t("orderFailed"));
      } else {
        toast.success(workspace("orderSaved"));
      }
      setIsReordering(false);
    });
  }

  function openDialog(type: "archive" | "delete", item: RecordListItem) {
    setReferences(null);
    setDialog({ type, item });
    startTransition(async () => {
      const result = await getRecordReferences(item.id).catch(() => null);
      if (result?.ok) setReferences(result.data);
    });
  }

  async function restore(item: RecordListItem) {
    const result = await setRecordArchived(kind, item.id, false).catch(() => null);
    if (result?.ok) toast.success(t("restoredToast"));
    else toast.error(t("actionFailed"));
  }

  const actionsMenu = (item: RecordListItem) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("moreActions", { name: labelOf(item) })}
        >
          <EllipsisIcon aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {item.archived ? (
          <>
            <DropdownMenuItem onSelect={() => void restore(item)}>
              <ArchiveRestoreIcon aria-hidden="true" />
              {t("restore")}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => openDialog("delete", item)}>
              <Trash2Icon aria-hidden="true" />
              {t("delete")}
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem onSelect={() => router.push(`${hrefBase}/${item.id}`)}>
              <PencilIcon aria-hidden="true" />
              {t("edit")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openDialog("archive", item)}>
              <ArchiveIcon aria-hidden="true" />
              {t("archive")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const row = (item: RecordListItem) => (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 py-1.5 sm:flex">
      <RecordSummary item={item} href={`${hrefBase}/${item.id}`} />
      <div className="col-span-2 row-start-2 flex items-center gap-2 sm:shrink-0">
        <LocaleCoverage coverage={item.coverage} />
      </div>
      <div className="col-start-2 row-start-1">{actionsMenu(item)}</div>
    </div>
  );

  const usage =
    references === null ? (
      <span className="text-muted-foreground">{t("archiveDialog.checking")}</span>
    ) : null;

  return (
    <div className="flex flex-col gap-4">
      {ordered.length > 0 ? (
        <>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <SearchIcon
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label={workspace("search")}
                placeholder={workspace("search")}
                className="pr-10 pl-9 [&::-webkit-search-cancel-button]:hidden"
              />
              {query ? (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => setQuery("")}
                  aria-label={workspace("clearSearch")}
                  className="absolute top-1/2 right-1 -translate-y-1/2"
                >
                  <XIcon aria-hidden="true" />
                </Button>
              ) : null}
            </div>
            <Button
              type="button"
              variant={translationOnly ? "secondary" : "outline"}
              aria-pressed={translationOnly}
              onClick={() => setTranslationOnly((value) => !value)}
              className={cn(
                "justify-start sm:justify-center",
                translationOnly && "border-ink-950 bg-ink-950 text-paper hover:bg-ink-800",
              )}
            >
              <LanguagesIcon aria-hidden="true" />
              {workspace("needsTranslation")}
            </Button>
          </div>
          <div className="overflow-hidden rounded-2xl border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b bg-ink-50/60 px-4 py-3 sm:px-5">
              <p role="status" className="text-sm font-medium tabular-nums">
                {workspace("resultCount", { count: filtered.length, total: ordered.length })}
              </p>
              <p className="text-xs/relaxed text-muted-foreground">
                {workspace(isFiltered ? "filteredHint" : "reorderHint")}
              </p>
              {isReordering ? <SaveStatus state="saving" className="min-w-0" /> : null}
            </div>
            {filtered.length > 0 ? (
              <SortableList
                items={filtered}
                getKey={(item) => item.id}
                getLabel={(item) => labelOf(item)}
                onMove={move}
                disabled={isFiltered || isReordering}
                className="flex flex-col divide-y"
                itemClassName="px-3 py-3 transition-colors hover:bg-ink-50 sm:px-4"
                renderItem={(item) => row(item)}
              />
            ) : (
              <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
                <SearchIcon aria-hidden="true" className="size-6 text-muted-foreground" />
                <h2 className="text-base font-semibold">{workspace("noResults")}</h2>
                <p className="max-w-sm text-sm/relaxed text-muted-foreground">
                  {workspace("noResultsDescription")}
                </p>
                <Button type="button" variant="outline" onClick={clearFilters}>
                  {workspace("clearFilters")}
                </Button>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed bg-card px-6 py-10 text-center">
          <h2 className="text-base font-semibold">{workspace("allArchived")}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm/relaxed text-muted-foreground">
            {workspace("allArchivedDescription")}
          </p>
        </div>
      )}

      {archived.length > 0 ? (
        <div className="flex flex-col gap-3 border-t pt-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start text-muted-foreground"
            aria-expanded={showArchived}
            aria-controls={archivedId}
            onClick={() => setShowArchived((visible) => !visible)}
          >
            <ArchiveIcon aria-hidden="true" />
            {showArchived ? t("hideArchived") : t("showArchived", { count: archived.length })}
            <ChevronDownIcon
              aria-hidden="true"
              className={cn("transition-transform", showArchived && "rotate-180")}
            />
          </Button>
          {showArchived ? (
            <ul
              id={archivedId}
              className="flex flex-col divide-y rounded-2xl border border-dashed bg-card"
            >
              {archived.map((item) => (
                <li key={item.id} className="px-4 py-3">
                  {row(item)}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={dialog?.type === "archive"}
        onOpenChange={(open) => !open && setDialog(null)}
        title={t("archiveDialog.title", { name: dialog ? labelOf(dialog.item) : "" })}
        description={
          <span className="flex flex-col gap-2">
            <span>{t("archiveDialog.description")}</span>
            {usage ?? (
              <span className="font-medium text-foreground">
                {t("archiveDialog.usage", {
                  documents: references?.documents ?? 0,
                  templates: references?.templates ?? 0,
                })}
              </span>
            )}
          </span>
        }
        confirmLabel={t("archiveDialog.confirm")}
        onConfirm={async () => {
          if (!dialog) return;
          const result = await setRecordArchived(kind, dialog.item.id, true);
          if (!result.ok) throw new Error(result.error);
          setOrder((current) => current.filter((id) => id !== dialog.item.id));
          toast.success(t("archivedToast"));
        }}
      />

      <ConfirmDialog
        open={dialog?.type === "delete"}
        onOpenChange={(open) => !open && setDialog(null)}
        title={t("deleteDialog.title", { name: dialog ? labelOf(dialog.item) : "" })}
        description={
          <span className="flex flex-col gap-2">
            <span>{t("deleteDialog.description")}</span>
            {usage ?? (
              <span className="font-medium text-foreground">
                {t("deleteDialog.usage", { documents: references?.documents ?? 0 })}
              </span>
            )}
          </span>
        }
        confirmLabel={t("deleteDialog.confirm")}
        tone="destructive"
        onConfirm={async () => {
          if (!dialog) return;
          const result = await deleteArchivedRecord(kind, dialog.item.id);
          if (!result.ok) throw new Error(result.error);
          toast.success(t("deletedToast"));
        }}
      />
    </div>
  );
}
