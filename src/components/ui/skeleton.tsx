import { cn } from "@/lib/utils";

/** Decorative placeholder; the surrounding region announces loading via aria-busy. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("animate-pulse rounded-sm bg-ink-150 [animation-duration:1.6s]", className)}
      {...props}
    />
  );
}

export { Skeleton };
