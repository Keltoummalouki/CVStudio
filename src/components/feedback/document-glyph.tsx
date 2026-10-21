import { cn } from "@/lib/utils";

/** A tiny A4 sheet that marks a row as a CV document. */
export function DocumentGlyph({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex aspect-a4 w-7 shrink-0 flex-col gap-[3px] rounded-[2px] border border-border-strong bg-card px-1 pt-1.5",
        className,
      )}
    >
      <span className="h-[2px] w-3/4 self-center bg-ink-700" />
      <span className="h-px w-full bg-ink-300" />
      <span className="h-[2px] w-full bg-ink-200" />
      <span className="h-[2px] w-2/3 bg-ink-200" />
    </span>
  );
}
