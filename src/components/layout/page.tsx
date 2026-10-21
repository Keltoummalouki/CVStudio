import { cn } from "@/lib/utils";

/** Content column for every dashboard page: one gutter rhythm across breakpoints. */
export function PageContainer({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-[88rem] flex-col gap-6 px-4 py-6 sm:px-6 lg:gap-7 lg:px-8 lg:py-8",
        className,
      )}
      {...props}
    />
  );
}

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
};

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1.5">
        <h1 className="text-2xl leading-tight font-semibold tracking-[-0.03em] sm:text-[1.75rem]">
          {title}
        </h1>
        {description ? (
          <p className="max-w-prose text-sm/relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** A paper surface with a consistent, responsive content rhythm. */
export function Panel({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      className={cn("flex min-w-0 flex-col rounded-lg border bg-card", className)}
      {...props}
    />
  );
}

type PanelHeaderProps = {
  title: string;
  titleId?: string;
  description?: string;
  aside?: React.ReactNode;
  className?: string;
};

export function PanelHeader({ title, titleId, description, aside, className }: PanelHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b px-5 py-5 sm:px-6",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <h2 id={titleId} className="text-base leading-snug font-semibold tracking-[-0.01em]">
          {title}
        </h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {aside ? <div className="flex shrink-0 items-center gap-2">{aside}</div> : null}
    </div>
  );
}
