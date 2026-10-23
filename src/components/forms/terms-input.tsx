"use client";

import { useId, useState } from "react";
import { PlusIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type TermsInputProps = {
  label: string;
  /** Added to the input's accessible name, e.g. which item of a list this is. */
  labelDetail?: string;
  value: readonly string[];
  onChange: (next: string[]) => void;
  onBlur?: () => void;
  /** Most terms the list may hold. */
  max: number;
  maxLength: number;
  /** Identity used to refuse duplicates (e.g. "React.js" = "reactjs"); defaults to lowercase. */
  identity?: (term: string) => string;
  /** Terms used elsewhere that must not be added again, such as the item's own name. */
  taken?: readonly string[];
  description?: string;
  /** Already-translated message. */
  error?: string;
  placeholder?: string;
  className?: string;
};

const SEPARATORS = /[,;\n]/;

/**
 * A short list of names edited as chips: type and press Enter (or a comma)
 * to add, paste a comma-separated list, remove one with its × button. Text
 * still in the box when it loses focus is added, so a Save never drops it.
 */
export function TermsInput({
  label,
  labelDetail,
  value,
  onChange,
  onBlur,
  max,
  maxLength,
  identity = (term) => term.trim().toLocaleLowerCase(),
  taken = [],
  description,
  error,
  placeholder,
  className,
}: TermsInputProps) {
  const t = useTranslations("termsInput");
  const id = useId();
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const full = value.length >= max;
  const describedBy =
    [description ? `${id}-description` : null, error ? `${id}-error` : null, `${id}-notice`]
      .filter(Boolean)
      .join(" ") || undefined;

  function commit(raw: string) {
    const known = new Set([...taken, ...value].map(identity));
    const next = [...value];
    const repeated: string[] = [];
    for (const piece of raw.split(SEPARATORS)) {
      const term = piece.trim().slice(0, maxLength).trim();
      if (!term) continue;
      const key = identity(term);
      if (!key || known.has(key)) {
        repeated.push(term);
        continue;
      }
      if (next.length >= max) break;
      known.add(key);
      next.push(term);
    }
    setDraft("");
    setNotice(
      repeated.length > 0
        ? t("duplicate", { term: repeated.join(", ") })
        : next.length >= max && raw.trim()
          ? t("limit", { max })
          : null,
    );
    if (next.length !== value.length) onChange(next);
  }

  return (
    <div className={cn("min-w-0 space-y-1.5", className)} data-invalid={error ? true : undefined}>
      <label id={`${id}-label`} htmlFor={`${id}-input`} className="text-sm font-medium">
        {label}
      </label>
      <div
        className={cn(
          "flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-input bg-card p-1.5 focus-within:border-ring",
          error && "border-destructive",
        )}
      >
        {value.length > 0 ? (
          <ul aria-labelledby={`${id}-label`} className="flex min-w-0 flex-wrap gap-1.5">
            {value.map((term, index) => (
              <li
                key={`${term}-${index}`}
                className="flex max-w-full items-center gap-1 rounded-sm bg-ink-100 py-0.5 pr-0.5 pl-2 text-[0.8125rem]"
              >
                <span className="min-w-0 truncate">{term}</span>
                <button
                  type="button"
                  onClick={() => onChange(value.filter((_, position) => position !== index))}
                  aria-label={t("remove", { term })}
                  className="flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-ink-200 hover:text-foreground focus-visible:focus-ring pointer-coarse:size-8"
                >
                  <XIcon aria-hidden="true" className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <Input
          id={`${id}-input`}
          // Starts with the visible label, so speech input still finds it.
          aria-label={labelDetail ? `${label}, ${labelDetail}` : undefined}
          value={draft}
          disabled={full}
          maxLength={maxLength * 4}
          placeholder={full ? t("limit", { max }) : (placeholder ?? t("placeholder"))}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          onChange={(event) => {
            const text = event.target.value;
            if (SEPARATORS.test(text)) commit(text);
            else setDraft(text);
          }}
          onPaste={(event) => {
            // A single-line input drops line breaks: read the list before it does.
            const pasted = event.clipboardData.getData("text");
            if (!SEPARATORS.test(pasted)) return;
            event.preventDefault();
            commit(`${draft}${pasted}`);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              // Enter adds the term instead of submitting the form.
              event.preventDefault();
              commit(draft);
            }
          }}
          onBlur={() => {
            if (draft.trim()) commit(draft);
            onBlur?.();
          }}
          className="h-8 min-w-32 flex-1 border-0 bg-transparent px-1.5 hover:border-transparent focus-visible:border-0 focus-visible:ring-0 pointer-coarse:h-10"
        />
        {draft.trim() ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => commit(draft)}>
            <PlusIcon aria-hidden="true" />
            {t("add")}
          </Button>
        ) : null}
      </div>
      {description ? (
        <p id={`${id}-description`} className="text-[0.8125rem] text-muted-foreground">
          {description}
        </p>
      ) : null}
      {/* Always rendered: a live region must exist before its text changes. */}
      <p
        id={`${id}-notice`}
        role="status"
        aria-live="polite"
        className="text-[0.8125rem] text-warning"
      >
        {notice}
      </p>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-[0.8125rem] text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
