"use client";

import { useId, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDownIcon, ChevronUpIcon, GripVerticalIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

type SortableListProps<T> = {
  items: readonly T[];
  getKey: (item: T) => string;
  /** Spoken name of an item, used by buttons and announcements. */
  getLabel: (item: T, index: number) => string;
  onMove: (from: number, to: number) => void;
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Optional full-width content below an item (e.g. its expanded options), not indented by the controls. */
  renderExpanded?: (item: T, index: number) => React.ReactNode;
  className?: string;
  itemClassName?: string;
  disabled?: boolean;
  /**
   * Dense lists (the CV outline): on fine pointers the move buttons only appear
   * while one of the row's reorder controls has focus, so rows never shift when
   * clicked. The handle stays draggable and keyboard-sortable (Tab from it reaches
   * the buttons); touch screens always show them.
   */
  compact?: boolean;
  /** Vertical position of the controls next to single-line rows. */
  align?: "start" | "center";
};

function SortableRow({
  id,
  label,
  index,
  total,
  onMove,
  disabled,
  compact,
  align,
  className,
  children,
  expanded,
}: {
  id: string;
  label: string;
  index: number;
  total: number;
  onMove: (from: number, to: number) => void;
  disabled: boolean;
  compact: boolean;
  align: "start" | "center";
  className?: string;
  children: React.ReactNode;
  expanded?: React.ReactNode;
}) {
  const t = useTranslations("careerData");
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const buttonClassName =
    "flex size-7 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-ink-100 hover:text-foreground disabled:pointer-events-none disabled:opacity-30 pointer-coarse:size-10";
  // Pointer devices: one compact row [handle ▲ ▼]. Touch: large ▲ ▼ stacked, no handle.
  const moveClassName = compact
    ? // Collapsed, not display:none: the buttons stay focusable, so Tab from the handle reaches them.
      "pointer-fine:w-0 pointer-fine:overflow-hidden pointer-fine:opacity-0 pointer-fine:group-has-[[data-sortable-control]:focus]/sortable:w-7 pointer-fine:group-has-[[data-sortable-control]:focus]/sortable:opacity-100"
    : undefined;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "group/sortable relative flex flex-wrap gap-2 bg-card",
        isDragging && "z-10 shadow-overlay ring-1 ring-ink-950/10",
        className,
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-start gap-0.5 pt-1 pointer-coarse:flex-col pointer-coarse:items-center pointer-coarse:pt-0",
          align === "center" && "self-center pt-0",
        )}
      >
        <button
          type="button"
          ref={setActivatorNodeRef}
          data-sortable-control=""
          {...attributes}
          {...listeners}
          aria-label={t("sortable.dragHandle", { name: label })}
          disabled={disabled}
          className={cn(
            buttonClassName,
            "cursor-grab touch-none active:cursor-grabbing pointer-coarse:hidden",
          )}
        >
          <GripVerticalIcon aria-hidden="true" className="size-4" />
        </button>
        <button
          type="button"
          data-sortable-control=""
          onClick={() => onMove(index, index - 1)}
          disabled={disabled || index === 0}
          aria-label={`${t("records.moveUp")}: ${label}`}
          className={cn(buttonClassName, moveClassName)}
        >
          <ChevronUpIcon aria-hidden="true" className="size-4" />
        </button>
        <button
          type="button"
          data-sortable-control=""
          onClick={() => onMove(index, index + 1)}
          disabled={disabled || index === total - 1}
          aria-label={`${t("records.moveDown")}: ${label}`}
          className={cn(buttonClassName, moveClassName)}
        >
          <ChevronDownIcon aria-hidden="true" className="size-4" />
        </button>
      </div>
      <div className="min-w-0 flex-1">{children}</div>
      {expanded ? <div className="min-w-0 basis-full">{expanded}</div> : null}
    </li>
  );
}

/**
 * Reorderable list with three equivalent inputs: dragging the handle (mouse,
 * pen), the keyboard (Space, arrows), and always-visible move up/down buttons
 * that work on touch screens without precise dragging.
 */
export function SortableList<T>({
  items,
  getKey,
  getLabel,
  onMove,
  renderItem,
  renderExpanded,
  className,
  itemClassName,
  disabled = false,
  compact = false,
  align = "start",
}: SortableListProps<T>) {
  const t = useTranslations("careerData.sortable");
  const [liveMessage, setLiveMessage] = useState("");
  // dnd-kit numbers its accessibility ids with a module counter, which differs
  // between the server render and the browser; a React id is the same on both.
  const dndId = useId();
  const keys = items.map(getKey);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const labelFor = (key: string | number) => {
    const index = keys.indexOf(String(key));
    const item = items[index];
    return item === undefined ? "" : getLabel(item, index);
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => t("pickedUp", { name: labelFor(active.id) }),
    onDragOver: ({ active, over }) =>
      over
        ? t("movedTo", {
            name: labelFor(active.id),
            position: keys.indexOf(String(over.id)) + 1,
            total: keys.length,
          })
        : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? t("dropped", {
            name: labelFor(active.id),
            position: keys.indexOf(String(over.id)) + 1,
            total: keys.length,
          })
        : undefined,
    onDragCancel: ({ active }) => t("cancelled", { name: labelFor(active.id) }),
  };

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    onMove(keys.indexOf(String(active.id)), keys.indexOf(String(over.id)));
  }

  function moveWithButtons(from: number, to: number) {
    if (to < 0 || to >= items.length) return;
    onMove(from, to);
    const item = items[from];
    if (item !== undefined) {
      setLiveMessage(
        t("movedTo", { name: getLabel(item, from), position: to + 1, total: items.length }),
      );
    }
  }

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={handleDragEnd}
      accessibility={{ announcements, screenReaderInstructions: { draggable: t("instructions") } }}
    >
      <SortableContext items={keys} strategy={verticalListSortingStrategy}>
        <ol className={className}>
          {items.map((item, index) => (
            <SortableRow
              key={keys[index]}
              id={keys[index]!}
              label={getLabel(item, index)}
              index={index}
              total={items.length}
              onMove={moveWithButtons}
              disabled={disabled}
              compact={compact}
              align={align}
              className={itemClassName}
              expanded={renderExpanded?.(item, index)}
            >
              {renderItem(item, index)}
            </SortableRow>
          ))}
        </ol>
      </SortableContext>
      <span role="status" aria-live="polite" className="sr-only">
        {liveMessage}
      </span>
    </DndContext>
  );
}
