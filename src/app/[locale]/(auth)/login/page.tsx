import { Suspense } from "react";
import type { Metadata } from "next";
import { ArrowRightIcon, LockKeyholeIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { BrandMark } from "@/components/brand/brand-mark";
import { A4SheetIllustration } from "@/components/feedback/a4-sheet-illustration";
import { ErrorState } from "@/components/feedback/error-state";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { Skeleton } from "@/components/ui/skeleton";
import { LoginForm } from "@/features/auth/components/login-form";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { sanitizeNextPath } from "@/lib/auth/routes";
import { AccessCheckError, getSessionState, type SessionState } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env/public";
import type { Locale } from "@/lib/i18n/config";
import { redirect } from "@/lib/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("title") };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function single(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

async function readSessionState(): Promise<SessionState | "unavailable"> {
  try {
    return await getSessionState();
  } catch (error) {
    if (error instanceof AccessCheckError) return "unavailable";
    throw error;
  }
}

/** Reads the session and query string at request time, inside the Suspense boundary. */
async function LoginGate({ searchParams }: { searchParams: SearchParams }) {
  const [params, locale, t] = await Promise.all([
    searchParams,
    getLocale() as Promise<Locale>,
    getTranslations("auth"),
  ]);
  const next = sanitizeNextPath(single(params.next));

  if (!isSupabaseConfigured()) {
    return <ErrorState title={t("errors.unavailable")} description={t("configMissing")} />;
  }

  const state = await readSessionState();
  if (state !== "unavailable" && state.status === "owner") {
    return redirect({ href: next, locale });
  }

  if (state !== "unavailable" && state.status === "not_owner") {
    return (
      <div role="alert" className="space-y-4 rounded-lg border border-border-strong bg-card p-5">
        <div className="space-y-1.5">
          <h2 className="text-base font-semibold">{t("notAuthorized.title")}</h2>
          <p className="text-sm/relaxed text-muted-foreground">
            {t("notAuthorized.description", { email: state.email ?? "—" })}
          </p>
        </div>
        <SignOutButton locale={locale} label={t("notAuthorized.signOut")} />
      </div>
    );
  }

  return (
    <LoginForm
      locale={locale}
      next={next}
      notice={single(params.reason) === "signed_out" ? "signedOut" : null}
      initialError={state === "unavailable" ? "unavailable" : null}
    />
  );
}

function LoginFormSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-hidden="true">
      {[0, 1].map((index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
      <Skeleton className="mt-1 h-10 w-full" />
    </div>
  );
}

export default async function LoginPage({ searchParams }: PageProps<"/[locale]/login">) {
  const t = await getTranslations("auth");

  return (
    <main className="grid min-h-dvh bg-card lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-rail p-10 text-rail-foreground lg:flex xl:p-14">
        <BrandMark tone="rail" wordmarkClassName="text-xl" />
        <div className="my-10 space-y-8">
          <div className="relative mx-auto flex h-64 w-72 items-center justify-center xl:h-80">
            <div
              aria-hidden="true"
              className="absolute inset-3 rounded-full border border-rail-border"
            />
            <div
              aria-hidden="true"
              className="absolute -inset-8 rounded-full border border-rail-border"
            />
            <div className="absolute left-6 -rotate-12">
              <A4SheetIllustration className="w-36 opacity-70 xl:w-44" showPortrait={false} />
            </div>
            <div className="relative ml-16 rotate-6">
              <A4SheetIllustration className="w-40 xl:w-48" />
            </div>
            <div className="absolute right-0 bottom-5 flex overflow-hidden rounded-md border border-rail-border bg-rail text-xs font-semibold">
              <span className="px-3 py-2">EN</span>
              <span className="border-l border-rail-border px-3 py-2">FR</span>
            </div>
          </div>
          <h2 className="max-w-lg text-3xl leading-tight font-semibold tracking-[-0.03em] xl:text-4xl">
            {t("studioHeadline")}
          </h2>
          <p className="max-w-md text-sm/relaxed text-rail-muted">{t("tagline")}</p>
          <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-rail-muted">
            <span>{t("workflow.collect")}</span>
            <ArrowRightIcon aria-hidden="true" className="size-3" />
            <span>{t("workflow.compose")}</span>
            <ArrowRightIcon aria-hidden="true" className="size-3" />
            <span>{t("workflow.refine")}</span>
          </div>
        </div>
        <LocaleSwitcher tone="rail" className="w-fit" />
      </aside>

      <section className="flex flex-col px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-8 sm:px-8">
        <div className="flex items-center justify-between gap-3 lg:hidden">
          <BrandMark />
          <LocaleSwitcher />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-7 py-12">
          <header className="space-y-3">
            <span
              aria-hidden="true"
              className="mb-6 flex size-12 items-center justify-center rounded-lg bg-signal-soft text-signal-hover"
            >
              <LockKeyholeIcon className="size-5" />
            </span>
            <h1 className="text-3xl font-semibold tracking-[-0.03em]">{t("title")}</h1>
            <p className="text-sm/relaxed text-muted-foreground">{t("description")}</p>
          </header>
          <Suspense fallback={<LoginFormSkeleton />}>
            <LoginGate searchParams={searchParams} />
          </Suspense>
          <p className="border-t pt-4 text-xs/relaxed text-muted-foreground">{t("noSignUp")}</p>
        </div>
      </section>
    </main>
  );
}
