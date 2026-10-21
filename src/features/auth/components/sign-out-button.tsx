"use client";

import { LogOutIcon } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { Locale } from "@/lib/i18n/config";
import { signOut } from "../actions";

function SubmitButton({
  label,
  variant,
  className,
}: { label: string } & Pick<ButtonProps, "variant" | "className">) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending} className={className}>
      {pending ? <Spinner /> : <LogOutIcon aria-hidden="true" />}
      {label}
    </Button>
  );
}

/** A real form posting to a Server Action: works before hydration and is CSRF-protected by Next. */
export function SignOutButton({
  locale,
  label,
  variant = "outline",
  className,
}: { locale: Locale; label: string } & Pick<ButtonProps, "variant" | "className">) {
  return (
    <form action={signOut.bind(null, locale)}>
      <SubmitButton label={label} variant={variant} className={className} />
    </form>
  );
}
