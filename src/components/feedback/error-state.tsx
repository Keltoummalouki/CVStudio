import { TriangleAlertIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type ErrorStateProps = {
  title: string;
  description: string;
  /** Primary recovery, e.g. a retry button or a link back to safety. */
  action?: React.ReactNode;
  /** Opaque server reference (error digest). Never pass raw error messages. */
  reference?: string;
  className?: string;
  headingLevel?: "h1" | "h2";
};

export function ErrorState({
  title,
  description,
  action,
  reference,
  className,
  headingLevel: Heading = "h2",
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-start gap-4 rounded-lg border border-border-strong bg-card p-6 sm:p-8",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="flex size-10 items-center justify-center rounded-md bg-destructive-soft text-destructive"
      >
        <TriangleAlertIcon className="size-5" />
      </span>
      <div className="max-w-prose space-y-1.5">
        <Heading className="text-lg font-semibold tracking-tight">{title}</Heading>
        <p className="text-sm/relaxed text-muted-foreground">{description}</p>
        {reference ? (
          <p className="pt-1 text-xs text-subtle-foreground" data-numeric>
            {reference}
          </p>
        ) : null}
      </div>
      {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
    </div>
  );
}
