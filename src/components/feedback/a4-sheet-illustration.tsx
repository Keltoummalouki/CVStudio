import { cn } from "@/lib/utils";

type A4SheetIllustrationProps = {
  className?: string;
  showPortrait?: boolean;
};

const LINE = "fill-ink-200";
const STRONG = "fill-ink-700";
const RULE = "fill-ink-300";

/**
 * A schematic CV page at true A4 proportion (210 × 297), echoing the reference
 * layout: centred title, rules, two-column skills, entries with right-aligned
 * dates. One vermilion rule marks the section a composition acts on.
 */
export function A4SheetIllustration({ className, showPortrait = true }: A4SheetIllustrationProps) {
  return (
    <svg
      viewBox="0 0 210 297"
      aria-hidden="true"
      focusable="false"
      className={cn(
        "aspect-a4 h-auto w-28 drop-shadow-[0_6px_14px_oklch(0.175_0.006_265/0.12)]",
        className,
      )}
    >
      <rect width="210" height="297" rx="3" className="fill-paper stroke-ink-200" strokeWidth="1" />
      {/* Header */}
      <rect x="45" y="17" width="120" height="9" rx="1" className={STRONG} />
      <rect x="75" y="31" width="60" height="5" rx="1" className="fill-ink-500" />
      {showPortrait ? <circle cx="182" cy="27" r="13" className="fill-ink-200" /> : null}
      <rect x="15" y="47" width="180" height="0.8" className={RULE} />
      <rect x="40" y="53" width="130" height="2.5" rx="1" className={LINE} />
      <rect x="55" y="59" width="100" height="2.5" rx="1" className={LINE} />
      <rect x="15" y="67" width="180" height="0.8" className={RULE} />
      {/* Technical skills, two columns */}
      <rect x="15" y="75" width="48" height="4" rx="1" className={STRONG} />
      <rect x="15" y="82" width="180" height="0.8" className={RULE} />
      {[88, 94, 100, 106].map((y) => (
        <g key={y}>
          <rect x="15" y={y} width={y === 106 ? 60 : 82} height="2.5" rx="1" className={LINE} />
          <rect x="110" y={y} width={y === 100 ? 55 : 80} height="2.5" rx="1" className={LINE} />
        </g>
      ))}
      {/* Experience: the section being composed */}
      <rect x="15" y="117" width="62" height="4" rx="1" className={STRONG} />
      <rect x="15" y="124" width="180" height="1.2" className="fill-signal" />
      {[131, 165].map((y) => (
        <g key={y}>
          <rect x="17" y={y} width="88" height="3.2" rx="1" className="fill-ink-600" />
          <rect x="165" y={y} width="30" height="2.5" rx="1" className="fill-ink-400" />
          <rect x="21" y={y + 7} width="150" height="2.5" rx="1" className={LINE} />
          <rect x="21" y={y + 13} width="120" height="2.5" rx="1" className={LINE} />
          <rect x="17" y={y + 20} width="52" height="2.5" rx="1" className="fill-ink-400" />
          <rect x="21" y={y + 26} width="140" height="2.5" rx="1" className={LINE} />
        </g>
      ))}
      {/* Education */}
      <rect x="15" y="203" width="44" height="4" rx="1" className={STRONG} />
      <rect x="15" y="210" width="180" height="0.8" className={RULE} />
      <rect x="17" y="217" width="110" height="3.2" rx="1" className="fill-ink-600" />
      <rect x="168" y="217" width="27" height="2.5" rx="1" className="fill-ink-400" />
      <rect x="17" y="224" width="130" height="2.5" rx="1" className={LINE} />
      {/* Soft skills and languages, three columns */}
      {[240, 266].map((y) => (
        <g key={y}>
          <rect x="15" y={y} width="50" height="4" rx="1" className={STRONG} />
          <rect x="15" y={y + 7} width="180" height="0.8" className={RULE} />
          <rect x="15" y={y + 13} width="40" height="2.5" rx="1" className={LINE} />
          <rect x="85" y={y + 13} width="40" height="2.5" rx="1" className={LINE} />
          <rect x="155" y={y + 13} width="40" height="2.5" rx="1" className={LINE} />
        </g>
      ))}
    </svg>
  );
}
