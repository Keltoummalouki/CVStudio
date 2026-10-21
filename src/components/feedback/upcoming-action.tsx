"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type UpcomingActionProps = Pick<ButtonProps, "variant" | "size" | "className"> & {
  children: React.ReactNode;
  /** Hide the "Soon" badge when space is tight; the control then dims instead. */
  hideBadge?: boolean;
};

/**
 * Entry point for a capability scheduled in a later milestone. It stays
 * focusable (aria-disabled, not disabled) so keyboard users reach the
 * explanation; activating it (including a tap, where tooltips never appear)
 * explains instead of navigating to a route that does not exist yet.
 */
export function UpcomingAction({
  children,
  variant = "outline",
  size,
  className,
  hideBadge = false,
}: UpcomingActionProps) {
  const t = useTranslations("common");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size={size}
          aria-disabled="true"
          onClick={() => toast.info(t("availableSoon"), { id: "upcoming-action" })}
          className={cn(!hideBadge && "aria-disabled:opacity-100", className)}
        >
          <span className={cn("inline-flex items-center gap-1.5", !hideBadge && "opacity-70")}>
            {children}
          </span>
          {hideBadge ? (
            <span className="sr-only">{t("soon")}</span>
          ) : (
            <Badge
              variant="outline"
              className="ml-0.5 border-current/30 bg-transparent text-current"
            >
              {t("soon")}
            </Badge>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{t("availableSoon")}</TooltipContent>
    </Tooltip>
  );
}
