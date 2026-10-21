import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-transparent",
    "text-sm font-medium whitespace-nowrap outline-none select-none",
    "transition-[background-color,border-color,color,box-shadow] duration-(--duration-fast) ease-out",
    "focus-visible:focus-ring active:not-aria-[haspopup]:translate-y-px",
    // aria-disabled stays hoverable/focusable so an explanatory tooltip can still be reached.
    "disabled:pointer-events-none disabled:opacity-45 aria-disabled:cursor-not-allowed aria-disabled:opacity-55",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-ink-800",
        signal: "bg-signal text-signal-foreground hover:bg-signal-hover",
        outline:
          "border-input bg-card text-foreground hover:border-ink-600 hover:bg-ink-50 aria-expanded:bg-ink-100",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-ink-150 aria-expanded:bg-ink-150",
        ghost: "text-foreground hover:bg-ink-100 aria-expanded:bg-ink-100",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        "destructive-outline":
          "border-destructive/40 bg-card text-destructive hover:border-destructive hover:bg-destructive-soft",
        link: "h-auto px-0 text-foreground underline decoration-ink-300 underline-offset-4 hover:decoration-foreground",
      },
      size: {
        default:
          "h-10 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3 pointer-coarse:h-11",
        sm: "h-8 gap-1 px-2.5 text-[0.8125rem] pointer-coarse:h-11 pointer-coarse:min-w-11 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 px-5 pointer-coarse:h-12",
        icon: "size-10 pointer-coarse:size-11",
        "icon-sm": "size-8 pointer-coarse:size-11 [&_svg:not([class*='size-'])]:size-3.5",
      },
    },
    compoundVariants: [{ variant: "link", className: "h-auto px-0 pointer-coarse:h-auto" }],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants, type ButtonProps };
