"use client";

import { useId, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRightIcon, CircleAlertIcon, EyeIcon, EyeOffIcon, InfoIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { Locale } from "@/lib/i18n/config";
import { signIn } from "../actions";
import { credentialsSchema, type AuthErrorCode, type Credentials } from "../schema";

function isNavigationSignal(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof error.digest === "string" &&
    error.digest.startsWith("NEXT_REDIRECT")
  );
}

type LoginFormProps = {
  locale: Locale;
  next: string;
  notice?: "signedOut" | null;
  initialError?: AuthErrorCode | null;
};

export function LoginForm({ locale, next, notice = null, initialError = null }: LoginFormProps) {
  const t = useTranslations("auth");
  const tValidation = useTranslations("validation");
  const [serverError, setServerError] = useState<AuthErrorCode | null>(initialError);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ids = { email: useId(), password: useId(), error: useId() };

  const form = useForm<Credentials>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: { email: "", password: "" },
    mode: "onTouched",
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      try {
        const result = await signIn({ ...values, locale, next });
        // signIn only returns on failure; success navigates away.
        if (result && !result.ok) {
          setServerError(result.error);
          if (result.error === "invalid_credentials") form.resetField("password");
        }
      } catch (error) {
        // Navigation after a successful sign-in is handled by Next; only real
        // failures (network, server) reach the message below.
        if (isNavigationSignal(error)) return;
        setServerError("unavailable");
      }
    });
  });

  const fieldError = (message: string | undefined) =>
    message ? { message: tValidation(message as "required" | "invalidEmail") } : undefined;

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      className="flex flex-col gap-5"
      aria-describedby={serverError ? ids.error : undefined}
    >
      {notice === "signedOut" && !serverError ? (
        <p className="flex items-center gap-2 rounded-md bg-info-soft px-3 py-2.5 text-sm text-info">
          <InfoIcon aria-hidden="true" className="size-4 shrink-0" />
          {t("signedOut")}
        </p>
      ) : null}

      {serverError ? (
        <p
          id={ids.error}
          role="alert"
          className="flex items-start gap-2 rounded-md bg-destructive-soft px-3 py-2.5 text-sm text-destructive"
        >
          <CircleAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {t(`errors.${serverError}`)}
        </p>
      ) : null}

      <Field data-invalid={!!errors.email || undefined}>
        <FieldLabel htmlFor={ids.email}>{t("email")}</FieldLabel>
        <Input
          id={ids.email}
          type="email"
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={!!errors.email || undefined}
          aria-describedby={errors.email ? `${ids.email}-error` : undefined}
          {...form.register("email")}
        />
        <FieldError id={`${ids.email}-error`} errors={[fieldError(errors.email?.message)]} />
      </Field>

      <Field data-invalid={!!errors.password || undefined}>
        <FieldLabel htmlFor={ids.password}>{t("password")}</FieldLabel>
        <div className="relative">
          <Input
            id={ids.password}
            type={passwordVisible ? "text" : "password"}
            autoComplete="current-password"
            className="pr-11"
            aria-invalid={!!errors.password || undefined}
            aria-describedby={errors.password ? `${ids.password}-error` : undefined}
            {...form.register("password")}
          />
          <button
            type="button"
            onClick={() => setPasswordVisible((visible) => !visible)}
            aria-pressed={passwordVisible}
            aria-label={passwordVisible ? t("hidePassword") : t("showPassword")}
            aria-controls={ids.password}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:-outline-offset-2"
          >
            {passwordVisible ? (
              <EyeOffIcon aria-hidden="true" className="size-4" />
            ) : (
              <EyeIcon aria-hidden="true" className="size-4" />
            )}
          </button>
        </div>
        <FieldError id={`${ids.password}-error`} errors={[fieldError(errors.password?.message)]} />
      </Field>

      <Button type="submit" variant="signal" size="lg" disabled={isPending} className="mt-1 w-full">
        {isPending ? <Spinner /> : null}
        {isPending ? t("pending") : t("submit")}
        {!isPending ? <ArrowRightIcon aria-hidden="true" /> : null}
      </Button>
    </form>
  );
}
