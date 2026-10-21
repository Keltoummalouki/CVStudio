import type { Metadata } from "next";
import { ArrowUpRightIcon, CheckIcon, ChevronRightIcon, UserRoundIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { CAREER_SECTIONS, type CareerSectionKind } from "@/config/career-sections";
import { getCareerSummary, type CareerSummary } from "@/features/career-data/server/queries";
import { Link } from "@/lib/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("careerData");
  return { title: t("title") };
}

function countFor(summary: CareerSummary, kind: CareerSectionKind): number | null {
  return kind === "profile" ? null : summary[kind];
}

const SECTION_GROUPS = [
  { key: "path", kinds: ["experience", "education", "certifications"] },
  { key: "abilities", kinds: ["technical_skills", "soft_skills", "languages"] },
  { key: "work", kinds: ["projects", "custom"] },
] as const;

export default async function CareerDataPage() {
  const [t, workspace, summary] = await Promise.all([
    getTranslations("careerData"),
    getTranslations("careerWorkspace"),
    getCareerSummary(),
  ]);

  return (
    <PageContainer>
      <PageHeader title={t("title")} description={t("description")} />
      <section
        aria-labelledby="career-profile-title"
        className="grid gap-6 rounded-2xl bg-ink-950 p-6 text-paper sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-7"
      >
        <div className="flex items-start gap-4">
          <UserRoundIcon
            aria-hidden="true"
            className="mt-1 hidden size-6 shrink-0 text-paper/70 sm:block"
          />
          <div className="space-y-3">
            <h2 id="career-profile-title" className="text-xl font-semibold tracking-[-0.025em]">
              {workspace(summary.profileStarted ? "profile.readyTitle" : "profile.startTitle")}
            </h2>
            <p className="max-w-xl text-sm/relaxed text-paper/75">
              {workspace("profile.description")}
            </p>
            {summary.profileStarted ? (
              <p className="flex items-center gap-1.5 text-xs font-medium text-paper/75">
                <CheckIcon aria-hidden="true" className="size-3.5" />
                {workspace("profile.started")}
              </p>
            ) : null}
          </div>
        </div>
        <Button
          asChild
          variant="secondary"
          className="justify-self-start bg-paper text-ink-950 hover:bg-ink-100"
        >
          <Link href="/dashboard/content/profile">
            {workspace(summary.profileStarted ? "profile.edit" : "profile.start")}
            <ArrowUpRightIcon aria-hidden="true" />
          </Link>
        </Button>
      </section>

      <div className="flex flex-col gap-7">
        {SECTION_GROUPS.map((group) => (
          <section
            key={group.key}
            aria-labelledby={`career-${group.key}-title`}
            className="grid gap-4 2xl:grid-cols-[12rem_minmax(0,1fr)] 2xl:gap-6"
          >
            <div className="space-y-1 2xl:pt-5">
              <h2
                id={`career-${group.key}-title`}
                className="text-base font-semibold tracking-[-0.015em]"
              >
                {workspace(`groups.${group.key}.title`)}
              </h2>
              <p className="max-w-prose text-sm/relaxed text-muted-foreground">
                {workspace(`groups.${group.key}.description`)}
              </p>
            </div>
            <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
              {group.kinds.map((kind) => {
                const section = CAREER_SECTIONS.find((candidate) => candidate.kind === kind)!;
                const Icon = section.icon;
                const count = countFor(summary, section.kind);
                return (
                  <li key={section.kind}>
                    <Link
                      href={section.href}
                      className="group flex h-full items-center gap-3.5 px-4 py-5 transition-colors hover:bg-ink-50 focus-visible:-outline-offset-2 sm:px-5"
                    >
                      <span
                        aria-hidden="true"
                        className="hidden shrink-0 text-muted-foreground sm:block"
                      >
                        <Icon className="size-[1.125rem]" />
                      </span>
                      <span className="min-w-0 flex-1 space-y-1.5">
                        <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                          <span className="text-sm font-semibold">
                            {t(`sections.${section.messageKey}.title`)}
                          </span>
                          {count !== null ? (
                            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                              {count === 0 ? workspace("startSection") : t("entryCount", { count })}
                            </span>
                          ) : null}
                        </span>
                        <span className="block text-[0.8125rem]/relaxed text-muted-foreground">
                          {t(`sections.${section.messageKey}.description`)}
                        </span>
                      </span>
                      <ChevronRightIcon
                        aria-hidden="true"
                        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none"
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </PageContainer>
  );
}
