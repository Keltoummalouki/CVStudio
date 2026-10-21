import * as React from "react";
import { cn } from "@/lib/utils";

/** Shared look for every single-line and multi-line text field. */
const fieldControlClassName = cn(
  "w-full min-w-0 rounded-md border border-input bg-card text-base text-foreground md:text-sm",
  "transition-[border-color,box-shadow] duration-(--duration-fast) outline-none",
  "placeholder:text-subtle-foreground hover:border-ink-600",
  "focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring",
  "disabled:cursor-not-allowed disabled:border-border-strong disabled:bg-muted disabled:text-muted-foreground",
  "aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive",
);

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        fieldControlClassName,
        "h-10 px-3.5 py-1 pointer-coarse:h-11",
        "file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { Input, fieldControlClassName };
