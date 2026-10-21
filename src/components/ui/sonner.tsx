"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Toaster as Sonner, type ToasterProps } from "sonner";

// Toasts clear the mobile tab bar; the offset variable switches at the desktop breakpoint.
const OFFSET = { bottom: "var(--toast-offset-bottom)", right: "1.5rem", left: "1rem" } as const;

function Toaster(props: ToasterProps) {
  const t = useTranslations("common");

  return (
    <Sonner
      theme="light"
      position="bottom-right"
      offset={OFFSET}
      mobileOffset={OFFSET}
      containerAriaLabel={t("notifications")}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-success" />,
        info: <InfoIcon className="size-4 text-info" />,
        warning: <TriangleAlertIcon className="size-4 text-warning" />,
        error: <OctagonXIcon className="size-4 text-destructive" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border-strong)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        closeButtonAriaLabel: t("dismiss"),
        classNames: {
          toast: "font-sans !shadow-overlay text-sm",
          description: "!text-muted-foreground",
          actionButton: "!bg-primary !text-primary-foreground !rounded-sm !font-medium",
          cancelButton: "!bg-secondary !text-secondary-foreground !rounded-sm",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
