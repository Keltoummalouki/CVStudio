"use client";

import { useId, useState } from "react";
import { Input, fieldControlClassName } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/**
 * A number in a unit (mm, pt). The text can be empty or half-typed while
 * editing; only valid numbers reach the design, held within [min, max].
 */
export function NumberField({
  label,
  value,
  unit,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  unit?: string;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  const id = useId();
  const [text, setText] = useState(String(value));
  const [synced, setSynced] = useState(value);
  // Follows outside changes (dragging on the canvas, undo).
  if (value !== synced) {
    setSynced(value);
    setText(String(value));
  }
  return (
    <div className="min-w-0 space-y-1">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          value={text}
          min={min}
          max={max}
          step={step}
          onChange={(event) => {
            setText(event.target.value);
            const next = Number.parseFloat(event.target.value);
            if (Number.isFinite(next) && next >= min && next <= max) onChange(next);
          }}
          onBlur={() => {
            const next = Number.parseFloat(text);
            const kept = Number.isFinite(next) ? Math.min(Math.max(next, min), max) : value;
            setText(String(kept));
            if (kept !== value) onChange(kept);
          }}
          className={cn("h-9 pr-9 tabular-nums", !unit && "pr-3")}
        />
        {unit ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground"
          >
            {unit}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <label htmlFor={id} className="text-sm">
        {label}
      </label>
      <input
        id={id}
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value.toLowerCase())}
        className="h-8 w-12 shrink-0 cursor-pointer rounded-md border border-input bg-card p-0.5 outline-none focus-visible:focus-ring"
      />
    </div>
  );
}

export function SwitchField({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 space-y-0.5">
        <label htmlFor={id} className="text-sm">
          {label}
        </label>
        {hint ? <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} className="mt-0.5" />
    </div>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    <div className="min-w-0 space-y-1">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => {
          const chosen = options.find((option) => option.value === event.target.value);
          if (chosen) onChange(chosen.value);
        }}
        className={cn(fieldControlClassName, "h-9 px-2.5")}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** A few exclusive choices shown side by side, e.g. text alignment. */
export function SegmentedField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string; icon?: React.ReactNode }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div
        role="radiogroup"
        aria-label={label}
        className="grid auto-cols-fr grid-flow-col gap-0.5 rounded-md bg-ink-100 p-1"
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            aria-label={option.label}
            title={option.label}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex h-7 items-center justify-center rounded-sm text-xs transition-colors outline-none focus-visible:focus-ring pointer-coarse:h-10",
              value === option.value
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.icon ?? option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** A titled group of fields in the properties panel. */
export function PropertyGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="space-y-3 border-t px-4 py-4">
      <h3
        id={id}
        className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase"
      >
        {title}
      </h3>
      {children}
    </section>
  );
}
