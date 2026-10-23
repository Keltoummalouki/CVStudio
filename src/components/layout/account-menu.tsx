"use client";

import { CircleUserRoundIcon, SettingsIcon, UserRoundIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PROFILE_HREF, SETTINGS_HREF } from "@/config/navigation";
import { Link } from "@/lib/i18n/navigation";

/**
 * Phones and tablets: Settings and the profile live here, so the bottom bar
 * keeps five working destinations. The desktop rail lists them directly.
 */
export function AccountMenu() {
  const t = useTranslations("navigation");
  const tStudio = useTranslations("studio");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label={t("accountMenu")}>
          <CircleUserRoundIcon aria-hidden="true" className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuItem asChild>
          <Link href={PROFILE_HREF}>
            <UserRoundIcon aria-hidden="true" />
            {tStudio("editProfile")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={SETTINGS_HREF}>
            <SettingsIcon aria-hidden="true" />
            {t("settings")}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
