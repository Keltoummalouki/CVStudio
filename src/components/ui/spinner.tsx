import { Loader2Icon } from "lucide-react";
import { cn } from "@/lib/utils";

type SpinnerProps = React.ComponentProps<"svg"> & {
  /** Translated status text. Omit when a nearby label already describes the pending state. */
  label?: string;
};

function Spinner({ className, label, ...props }: SpinnerProps) {
  const accessibility = label
    ? ({ role: "status", "aria-label": label } as const)
    : ({ "aria-hidden": true } as const);

  return (
    <Loader2Icon
      data-slot="spinner"
      className={cn("size-4 animate-spin", className)}
      {...accessibility}
      {...props}
    />
  );
}

export { Spinner };
