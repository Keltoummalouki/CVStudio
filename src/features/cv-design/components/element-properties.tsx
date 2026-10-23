"use client";

import { useId } from "react";
import { AlignCenterIcon, AlignLeftIcon, AlignRightIcon, CopyIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { fieldControlClassName } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { LocalizedTextValue } from "@/lib/i18n/localized-text";
import { cn } from "@/lib/utils";
import {
  FONT_FAMILIES,
  MAX_FONT_PT,
  MIN_FONT_PT,
  MIN_SIZE_MM,
  PAGE_MM,
  PHOTO_SHAPES,
  isDecoration,
  type Design,
  type DesignElement,
  type ElementContent,
  type ElementStyle,
} from "../design";
import {
  moveElement,
  resizeElement,
  setAutoHeight,
  setElementContent,
  setElementStyle,
} from "../operations";
import {
  ColorField,
  NumberField,
  PropertyGroup,
  SegmentedField,
  SelectField,
  SwitchField,
} from "./property-fields";
import { ElementIconView } from "./element-icon-view";
import { elementIcon } from "./use-element-label";

/** Sections whose items can read in two columns. */
const COLUMN_SECTIONS = new Set(["technical_skills", "soft_skills", "languages"]);

function TextContentFields({
  value,
  onChange,
}: {
  value: LocalizedTextValue;
  onChange: (value: LocalizedTextValue) => void;
}) {
  const t = useTranslations("designer.properties");
  const id = useId();
  // Text written once for both languages shows in both fields until one is changed.
  const en = value.shared ?? value.en ?? "";
  const fr = value.shared ?? value.fr ?? "";
  return (
    <div className="space-y-3">
      {(
        [
          ["en", t("textEn"), en],
          ["fr", t("textFr"), fr],
        ] as const
      ).map(([locale, label, text]) => (
        <div key={locale} className="space-y-1">
          <label htmlFor={`${id}-${locale}`} className="text-xs font-medium text-muted-foreground">
            {label}
          </label>
          <textarea
            id={`${id}-${locale}`}
            rows={2}
            maxLength={500}
            value={text}
            onChange={(event) =>
              onChange({ en, fr, [locale]: event.target.value } as LocalizedTextValue)
            }
            className={cn(fieldControlClassName, "resize-y px-3 py-2 text-sm")}
          />
        </div>
      ))}
    </div>
  );
}

type ElementPropertiesProps = {
  element: DesignElement;
  pages: number;
  name: string;
  onChange: (change: (design: Design) => Design) => void;
  onRemove: () => void;
  /** Null when this element can appear only once. */
  onDuplicate: (() => void) | null;
  onDeselect: () => void;
};

export function ElementProperties({
  element,
  pages,
  name,
  onChange,
  onRemove,
  onDuplicate,
  onDeselect,
}: ElementPropertiesProps) {
  const t = useTranslations("designer.properties");
  const { id, style, content } = element;
  const decoration = isDecoration(content);
  const setStyle = (patch: Partial<ElementStyle>) =>
    onChange((design) => setElementStyle(design, id, patch));
  const setContent = (next: ElementContent) =>
    onChange((design) => setElementContent(design, id, next));
  const setBox = (patch: Partial<Pick<DesignElement, "x" | "y" | "w" | "h">>) =>
    onChange((design) =>
      patch.x !== undefined || patch.y !== undefined
        ? moveElement(design, id, patch.x ?? element.x, patch.y ?? element.y)
        : resizeElement(design, id, {
            x: element.x,
            y: element.y,
            w: patch.w ?? element.w,
            h: patch.h ?? element.h,
          }),
    );

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3">
        <ElementIconView
          icon={elementIcon(content)}
          className="size-4 shrink-0 text-muted-foreground"
        />
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{name}</h2>
        {onDuplicate ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("duplicate")}
            title={t("duplicate")}
            onClick={onDuplicate}
          >
            <CopyIcon aria-hidden="true" />
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("remove")}
          title={t("remove")}
          onClick={onRemove}
        >
          <Trash2Icon aria-hidden="true" />
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onDeselect}>
          {t("deselect")}
        </Button>
      </div>

      <PropertyGroup title={t("position")}>
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label={t("x")}
            unit={t("mm")}
            value={element.x}
            min={0}
            max={PAGE_MM.width - element.w}
            step={0.5}
            onChange={(x) => setBox({ x })}
          />
          <NumberField
            label={t("y")}
            unit={t("mm")}
            value={element.y}
            min={0}
            max={PAGE_MM.height - element.h}
            step={0.5}
            onChange={(y) => setBox({ y })}
          />
          <NumberField
            label={t("width")}
            unit={t("mm")}
            value={element.w}
            min={MIN_SIZE_MM}
            max={PAGE_MM.width - element.x}
            step={0.5}
            onChange={(w) => setBox({ w })}
          />
          <NumberField
            label={element.autoHeight && !decoration ? t("minHeight") : t("height")}
            unit={t("mm")}
            value={element.h}
            min={MIN_SIZE_MM}
            max={PAGE_MM.height - element.y}
            step={0.5}
            onChange={(h) => setBox({ h })}
          />
        </div>
        {pages > 1 ? (
          <SelectField
            label={t("page")}
            value={String(element.page)}
            options={Array.from({ length: pages }, (_, page) => ({
              value: String(page),
              label: String(page + 1),
            }))}
            onChange={(page) =>
              onChange((design) => ({
                ...design,
                elements: design.elements.map((item) =>
                  item.id === id ? { ...item, page: Number(page) } : item,
                ),
              }))
            }
          />
        ) : null}
        {!decoration ? (
          <SwitchField
            label={t("autoHeight")}
            hint={t("autoHeightHint")}
            checked={element.autoHeight}
            onChange={(autoHeight) => onChange((design) => setAutoHeight(design, id, autoHeight))}
          />
        ) : null}
      </PropertyGroup>

      {content.type === "field" && (content.field === "contacts" || content.field === "links") ? (
        <PropertyGroup title={t("content")}>
          <SwitchField
            label={t("inline")}
            checked={content.inline}
            onChange={(inline) => setContent({ ...content, inline })}
          />
        </PropertyGroup>
      ) : null}
      {content.type === "section" || content.type === "custom" ? (
        <PropertyGroup title={t("content")}>
          <SwitchField
            label={t("showTitle")}
            checked={content.showTitle}
            onChange={(showTitle) => setContent({ ...content, showTitle })}
          />
          <SwitchField
            label={t("rule")}
            checked={content.rule}
            onChange={(rule) => setContent({ ...content, rule })}
          />
          {content.type === "section" && COLUMN_SECTIONS.has(content.section) ? (
            <SwitchField
              label={t("columns")}
              checked={content.columns === 2}
              onChange={(two) => setContent({ ...content, columns: two ? 2 : 1 })}
            />
          ) : null}
        </PropertyGroup>
      ) : null}
      {content.type === "text" ? (
        <PropertyGroup title={t("content")}>
          <TextContentFields
            value={content.text}
            onChange={(text) => setContent({ ...content, text })}
          />
        </PropertyGroup>
      ) : null}
      {content.type === "photo" ? (
        <PropertyGroup title={t("content")}>
          <SelectField
            label={t("shape")}
            value={content.shape}
            options={PHOTO_SHAPES.map((shape) => ({ value: shape, label: t(`shapes.${shape}`) }))}
            onChange={(shape) => setContent({ ...content, shape })}
          />
        </PropertyGroup>
      ) : null}

      {!decoration ? (
        <PropertyGroup title={t("text")}>
          <div className="grid grid-cols-2 gap-2">
            <SelectField
              label={t("font")}
              value={style.font}
              options={FONT_FAMILIES.map((font) => ({ value: font, label: t(`fonts.${font}`) }))}
              onChange={(font) => setStyle({ font })}
            />
            <NumberField
              label={t("size")}
              unit={t("pt")}
              value={style.size}
              min={MIN_FONT_PT}
              max={MAX_FONT_PT}
              step={0.5}
              onChange={(size) => setStyle({ size })}
            />
          </div>
          <SegmentedField
            label={t("align")}
            value={style.align}
            options={[
              {
                value: "left",
                label: t("aligns.left"),
                icon: <AlignLeftIcon className="size-4" />,
              },
              {
                value: "center",
                label: t("aligns.center"),
                icon: <AlignCenterIcon className="size-4" />,
              },
              {
                value: "right",
                label: t("aligns.right"),
                icon: <AlignRightIcon className="size-4" />,
              },
            ]}
            onChange={(align) => setStyle({ align })}
          />
          <NumberField
            label={t("lineHeight")}
            value={style.lineHeight}
            min={1}
            max={2}
            step={0.05}
            onChange={(lineHeight) => setStyle({ lineHeight })}
          />
          <SwitchField
            label={t("bold")}
            checked={style.weight === 700}
            onChange={(bold) => setStyle({ weight: bold ? 700 : 400 })}
          />
          <SwitchField
            label={t("uppercase")}
            checked={style.uppercase}
            onChange={(uppercase) => setStyle({ uppercase })}
          />
          <ColorField
            label={t("color")}
            value={style.color}
            onChange={(color) => setStyle({ color })}
          />
          {content.type === "section" || content.type === "custom" ? (
            <ColorField
              label={t("accent")}
              value={style.accent}
              onChange={(accent) => setStyle({ accent })}
            />
          ) : null}
        </PropertyGroup>
      ) : null}

      {content.type === "line" ? (
        <PropertyGroup title={t("box")}>
          <ColorField
            label={t("lineColor")}
            value={style.accent}
            onChange={(accent) => setStyle({ accent })}
          />
          <NumberField
            label={t("lineWidth")}
            unit={t("pt")}
            value={style.borderWidth}
            min={0.25}
            max={4}
            step={0.25}
            onChange={(borderWidth) => setStyle({ borderWidth })}
          />
        </PropertyGroup>
      ) : (
        <PropertyGroup title={t("box")}>
          <SwitchField
            label={t("noBackground")}
            checked={style.background === null}
            onChange={(none) => setStyle({ background: none ? null : "#eef0f3" })}
          />
          {style.background !== null ? (
            <ColorField
              label={t("background")}
              value={style.background}
              onChange={(background) => setStyle({ background })}
            />
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label={t("border")}
              unit={t("pt")}
              value={style.borderWidth}
              min={0}
              max={4}
              step={0.25}
              onChange={(borderWidth) => setStyle({ borderWidth })}
            />
            <NumberField
              label={t("radius")}
              unit={t("mm")}
              value={style.radius}
              min={0}
              max={50}
              step={0.5}
              onChange={(radius) => setStyle({ radius })}
            />
          </div>
          {style.borderWidth > 0 ? (
            <ColorField
              label={t("borderColor")}
              value={style.borderColor}
              onChange={(borderColor) => setStyle({ borderColor })}
            />
          ) : null}
          {!decoration ? (
            <NumberField
              label={t("padding")}
              unit={t("mm")}
              value={style.padding}
              min={0}
              max={10}
              step={0.5}
              onChange={(padding) => setStyle({ padding })}
            />
          ) : null}
        </PropertyGroup>
      )}
    </div>
  );
}
