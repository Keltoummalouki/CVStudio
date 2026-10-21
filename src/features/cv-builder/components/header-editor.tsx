"use client";

import { arrayMove } from "@dnd-kit/sortable";
import { ExternalLinkIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { SortableList } from "@/components/forms/sortable-list";
import { Link } from "@/lib/i18n/navigation";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { cn } from "@/lib/utils";
import type { HeaderDefinition, ItemRef } from "../definition";
import { setHeader, setOverride, withOptional } from "../operations";
import { mergeOptOut } from "../resolve";
import { useBuilder, useCvText } from "./builder-context";
import { EditorGroup, OverrideField, ToggleChip, VisibilityToggle } from "./controls";

const PROFILE_HREF = "/dashboard/content/profile";

type HeaderToggle = Extract<
  keyof HeaderDefinition,
  "showTitle" | "showName" | "showPhoto" | "showPhone" | "showEmail" | "showLocation" | "showLinks"
>;

const TOGGLES: readonly HeaderToggle[] = [
  "showTitle",
  "showName",
  "showPhoto",
  "showPhone",
  "showEmail",
  "showLocation",
  "showLinks",
];

export function HeaderEditor() {
  const t = useTranslations("cvBuilder.header");
  const tContact = useTranslations("careerData.fields");
  const { definition, master, cvLocale, update } = useBuilder();
  const cvText = useCvText();
  const { header } = definition;
  const { profile } = master;

  const available: Record<HeaderToggle, boolean> = {
    showTitle: true,
    showName: !!profile.fullName.trim(),
    showPhoto: profile.hasPhoto,
    showPhone: !!profile.phone,
    showEmail: !!profile.email,
    showLocation: !!cvText(profile.location),
    showLinks: master.links.some((link) => !link.archived),
  };

  const links = mergeOptOut(header.links, master.links).map(({ item, ref }) => ({
    link: item,
    ref: ref ?? ({ refId: item.id, visible: true } satisfies ItemRef),
  }));
  const allLinks = links.map(({ ref }) => ref);
  const setLinks = (refs: ItemRef[]) => update((current) => setHeader(current, { links: refs }));

  return (
    <div className="flex flex-col gap-6">
      <EditorGroup title={t("show")} description={t("showHint")}>
        <div className="flex flex-wrap gap-1.5">
          {TOGGLES.map((key) => (
            <ToggleChip
              key={key}
              pressed={header[key] && available[key]}
              onChange={(pressed) => update((current) => setHeader(current, { [key]: pressed }))}
              label={available[key] ? undefined : t("unavailable", { field: t(`fields.${key}`) })}
            >
              {t(`fields.${key}`)}
            </ToggleChip>
          ))}
        </div>
        {!profile.hasPhoto ? <p className="text-xs text-muted-foreground">{t("noPhoto")}</p> : null}
      </EditorGroup>

      {header.showTitle ? (
        <OverrideField
          label={t("title")}
          maxLength={160}
          value={(header.title && resolveLocalizedText(header.title, cvLocale)) ?? ""}
          source={cvText(profile.title)}
          onChange={(text) =>
            update((current) => ({
              ...current,
              header: withOptional(
                current.header,
                "title",
                setOverride(current.header.title, cvLocale, text),
              ),
            }))
          }
        />
      ) : null}

      {header.showLinks && links.length > 0 ? (
        <EditorGroup title={t("links")} description={t("linksHint")}>
          <SortableList
            items={links}
            getKey={({ link }) => link.id}
            getLabel={({ link }) => link.displayText || link.url}
            onMove={(from, to) => setLinks(arrayMove(allLinks, from, to))}
            compact
            align="center"
            className="flex flex-col divide-y rounded-md border"
            itemClassName="px-2 py-1.5"
            renderItem={({ link, ref }) => (
              <div className="flex items-center gap-1">
                <p
                  className={cn(
                    "min-w-0 flex-1 truncate py-1 text-sm",
                    !ref.visible && "text-subtle-foreground line-through decoration-ink-300",
                  )}
                >
                  <span className="font-medium">{tContact(`linkKinds.${link.kind}`)}</span>
                  <span className="text-muted-foreground"> · {link.displayText || link.url}</span>
                </p>
                <VisibilityToggle
                  name={link.displayText || link.url}
                  visible={ref.visible}
                  onChange={(visible) =>
                    setLinks(
                      allLinks.map((entry) =>
                        entry.refId === link.id ? { ...entry, visible } : entry,
                      ),
                    )
                  }
                />
              </div>
            )}
          />
        </EditorGroup>
      ) : null}

      <Link
        href={PROFILE_HREF}
        className="inline-flex w-fit items-center gap-1.5 text-[0.8125rem] font-medium underline decoration-ink-300 underline-offset-4 hover:decoration-foreground"
      >
        <ExternalLinkIcon aria-hidden="true" className="size-3.5" />
        {t("editProfile")}
      </Link>
    </div>
  );
}
