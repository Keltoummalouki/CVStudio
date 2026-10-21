import { CheckIcon, LanguagesIcon, PlusIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { getCareerSection } from "@/config/career-sections";
import { Link } from "@/lib/i18n/navigation";
import type { RecordKind } from "../record-kinds";
import { listRecords } from "../server/queries";
import { RecordList } from "./record-list";

/** List page shared by every "records" section (experience, education, ...). */
export async function RecordListPage({ kind }: { kind: RecordKind }) {
  const section = getCareerSection(kind);
  const [t, workspace, items] = await Promise.all([
    getTranslations("careerData"),
    getTranslations("careerWorkspace"),
    listRecords(kind),
  ]);
  const Icon = section.icon;
  const addLabel = t(`sections.${section.messageKey}.add`);

  const addButton = (
    <Button asChild>
      <Link href={`${section.href}/new`}>
        <PlusIcon aria-hidden="true" />
        {addLabel}
      </Link>
    </Button>
  );

  return (
    <PageContainer>
      <PageHeader
        title={t(`sections.${section.messageKey}.title`)}
        description={t(`sections.${section.messageKey}.description`)}
        actions={items.length > 0 ? addButton : null}
      />
      {items.length === 0 ? (
        <div className="grid overflow-hidden rounded-2xl border bg-card 2xl:grid-cols-[1.2fr_1fr]">
          <div className="flex flex-col items-start gap-5 p-6 sm:p-8">
            <Icon aria-hidden="true" className="size-8 text-muted-foreground" />
            <div className="space-y-2">
              <h2 className="text-xl font-semibold tracking-[-0.02em]">
                {workspace(`empty.${kind}.title`)}
              </h2>
              <p className="max-w-md text-sm/relaxed text-muted-foreground">
                {workspace(`empty.${kind}.description`)}
              </p>
            </div>
            {addButton}
          </div>
          <div className="flex flex-col justify-center gap-4 border-t bg-ink-50/60 p-6 sm:p-8 2xl:border-t-0 2xl:border-l">
            <h3 className="text-sm font-semibold">{workspace("empty.includeTitle")}</h3>
            <ul className="space-y-3 text-sm/relaxed text-muted-foreground">
              {(["first", "second"] as const).map((tip) => (
                <li key={tip} className="flex gap-2.5">
                  <CheckIcon aria-hidden="true" className="mt-1 size-4 shrink-0" />
                  <span>{workspace(`empty.${kind}.${tip}`)}</span>
                </li>
              ))}
              <li className="flex gap-2.5">
                <LanguagesIcon aria-hidden="true" className="mt-1 size-4 shrink-0" />
                <span>{workspace("empty.languages")}</span>
              </li>
            </ul>
          </div>
        </div>
      ) : (
        <RecordList
          // Remount when the server order or archive state changes after a refresh.
          key={items.map((item) => `${item.id}:${item.archived ? 1 : 0}`).join("|")}
          kind={kind}
          items={items}
          hrefBase={section.href}
        />
      )}
    </PageContainer>
  );
}
