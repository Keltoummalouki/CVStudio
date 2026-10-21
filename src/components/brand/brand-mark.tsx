import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
  /** "rail" renders on the ink rail (white sheet); "default" on light surfaces. */
  tone?: "default" | "rail";
  showWordmark?: boolean;
  wordmarkClassName?: string;
};

/**
 * An A4 sheet at true proportion with a vermilion header rule: the document is
 * the product, the rule is the one signal colour.
 */
export function BrandMark({
  className,
  tone = "default",
  showWordmark = true,
  wordmarkClassName,
}: BrandMarkProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg
        viewBox="0 0 21 29.7"
        className={cn("h-7 w-auto shrink-0", tone === "rail" ? "text-paper" : "text-ink-950")}
        aria-hidden="true"
        focusable="false"
      >
        <rect width="21" height="29.7" rx="1.6" fill="currentColor" />
        <rect x="3.5" y="5" width="14" height="2.4" fill="var(--signal)" />
        <rect
          x="3.5"
          y="10.5"
          width="9"
          height="1.2"
          className={tone === "rail" ? "fill-ink-300" : "fill-ink-500"}
        />
        <rect
          x="3.5"
          y="13.5"
          width="14"
          height="1.2"
          className={tone === "rail" ? "fill-ink-300" : "fill-ink-500"}
        />
      </svg>
      {showWordmark ? (
        <span className={cn("text-[0.9375rem] leading-none tracking-[-0.01em]", wordmarkClassName)}>
          <span className="font-bold">CV</span>
          <span className="font-normal">Studio</span>
        </span>
      ) : null}
    </span>
  );
}
