import type { LucideIcon } from "lucide-react";

/**
 * Draws an icon chosen at render time (elementIcon). Taking it as a prop keeps
 * the component itself static, as React requires.
 */
export function ElementIconView({
  icon: Icon,
  className,
}: {
  icon: LucideIcon;
  className?: string;
}) {
  return <Icon aria-hidden="true" className={className} />;
}
