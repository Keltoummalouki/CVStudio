import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type ChoiceCardProps = Omit<React.ComponentProps<"input">, "type" | "title"> & {
  /** Drives the selected look; the radio itself may be controlled or registered. */
  selected: boolean;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Extra details under the description, e.g. a language badge. */
  meta?: React.ReactNode;
  compact?: boolean;
  containerClassName?: string;
};

/** A radio option drawn as a card: the whole card is the hit target, focus shows on the card. */
export function ChoiceCard({
  selected,
  title,
  description,
  meta,
  compact = false,
  containerClassName,
  ...inputProps
}: ChoiceCardProps) {
  return (
    <label
      className={cn(
        "relative flex cursor-pointer items-start gap-3 rounded-lg border transition-colors has-focus-visible:focus-ring has-disabled:cursor-not-allowed has-disabled:opacity-60",
        compact ? "p-4" : "p-5",
        selected
          ? "border-ink-950 bg-ink-950 text-paper"
          : "border-border-strong bg-card hover:border-ink-600 hover:bg-ink-50",
        containerClassName,
      )}
    >
      <input
        type="radio"
        className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        {...inputProps}
      />
      <span className={cn("flex min-w-0 flex-1 flex-col", compact ? "gap-1" : "gap-2")}>
        <span className={cn("font-semibold", compact ? "text-sm" : "text-lg tracking-[-0.02em]")}>
          {title}
        </span>
        {description ? (
          <span
            className={cn(
              "text-[0.8125rem] leading-relaxed",
              selected ? "text-paper/75" : "text-muted-foreground",
            )}
          >
            {description}
          </span>
        ) : null}
        {meta}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border",
          selected ? "border-paper bg-paper text-ink-950" : "border-input",
        )}
      >
        {selected ? <CheckIcon className="size-3.5" /> : null}
      </span>
    </label>
  );
}
