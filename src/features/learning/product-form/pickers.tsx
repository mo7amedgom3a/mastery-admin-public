import { useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/kit";
import { useT } from "@/lib/i18n";

/**
 * Searchable multi-select picker. Replaces the old wall-of-checkboxes so lists of 500 instructors
 * or every skill stay usable, and keeps the design system's field box (`.ma-picker` on `.ma-field`).
 */
export type PickerOption = { value: string | number; label: string; hint?: string };

export function CheckPicker({
  id,
  label,
  options,
  selected,
  onToggle,
  onClear,
  hint,
  required,
  searchPlaceholder,
  emptyText,
  onCreate,
  createLabel,
}: {
  id: string;
  label: ReactNode;
  options: PickerOption[];
  selected: (string | number)[];
  onToggle: (value: string | number) => void;
  onClear?: () => void;
  hint?: ReactNode;
  required?: boolean;
  searchPlaceholder?: string;
  emptyText?: ReactNode;
  /** Offers "+ create" for a search with no exact match; called with the trimmed query. */
  onCreate?: (query: string) => void;
  createLabel?: (query: string) => string;
}) {
  const t = useT();
  const [query, setQuery] = useState("");
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) => option.label.toLowerCase().includes(needle));
  }, [options, query]);

  const many = options.length > 8 || onCreate != null;
  const trimmed = query.trim();
  const canCreate =
    onCreate != null && trimmed !== "" && !options.some((option) => option.label.toLowerCase() === trimmed.toLowerCase());

  return (
    <div className="ma-field">
      <label className="ma-label" htmlFor={id}>
        {label}
        {required ? <span aria-hidden="true" className="ma-req"> *</span> : null}
      </label>

      {options.length === 0 && onCreate == null ? (
        <span className="ma-help">{emptyText ?? hint ?? "—"}</span>
      ) : (
        <div className="ma-picker">
          {many ? (
            <input
              id={id}
              className="ma-input ma-picker__search"
              type="search"
              value={query}
              placeholder={searchPlaceholder ?? t("ابحث…", "Search…")}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && canCreate) {
                  event.preventDefault();
                  onCreate?.(trimmed);
                  setQuery("");
                }
              }}
            />
          ) : null}
          {canCreate ? (
            <button
              type="button"
              className="ma-link ma-picker__create"
              onClick={() => {
                onCreate?.(trimmed);
                setQuery("");
              }}
            >
              + {createLabel ? createLabel(trimmed) : t(`إضافة «${trimmed}»`, `Add “${trimmed}”`)}
            </button>
          ) : null}
          <div className="ma-picker__list" role="group" aria-label={typeof label === "string" ? label : id}>
            {filtered.length === 0 ? (
              <span className="ma-picker__empty">
                {options.length === 0 ? emptyText ?? t("لا عناصر بعد.", "Nothing yet.") : t("لا نتائج مطابقة.", "No matches.")}
              </span>
            ) : (
              filtered.map((option) => (
                <label key={option.value} className="ma-check">
                  <input
                    type="checkbox"
                    checked={selectedSet.has(option.value)}
                    onChange={() => onToggle(option.value)}
                  />
                  <span>
                    {option.label}
                    {option.hint ? <span className="ma-member__meta"> · {option.hint}</span> : null}
                  </span>
                </label>
              ))
            )}
          </div>
          <div className="ma-picker__foot">
            <span className="ma-picker__count">
              {t(`المحدّد: ${selected.length}`, `Selected: ${selected.length}`)}
            </span>
            {onClear && selected.length > 0 ? (
              <button type="button" className="ma-link" onClick={onClear}>
                {t("مسح الكل", "Clear all")}
              </button>
            ) : null}
          </div>
        </div>
      )}

      {hint ? (
        <span className="ma-help" id={`${id}-hint`}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

/** Removable chips for the current selection (used above wide pickers). */
export function SelectedChips({
  items,
  onRemove,
  empty,
}: {
  items: { value: string | number; label: string }[];
  onRemove: (value: string | number) => void;
  empty?: ReactNode;
}) {
  if (items.length === 0) return empty ? <span className="ma-help">{empty}</span> : null;
  return (
    <div className="ma-chips">
      {items.map((item) => (
        <span key={item.value} className="ma-chips__chip">
          {item.label}
          <button type="button" aria-label={`remove ${item.label}`} onClick={() => onRemove(item.value)}>
            ×
          </button>
        </span>
      ))}
    </div>
  );
}

/**
 * Keyword input with suggestions. Fixed: an empty draft is never committed (the old version added
 * a blank tag on blur) and duplicates are ignored case-insensitively.
 */
export function TagInput({
  id,
  label,
  tags,
  suggestions,
  onChange,
  hint,
  placeholder,
}: {
  id: string;
  label: ReactNode;
  tags: string[];
  suggestions: string[];
  onChange: (tags: string[]) => void;
  hint?: ReactNode;
  placeholder?: string;
}) {
  const t = useT();
  const [draft, setDraft] = useState("");

  const add = (value: string) => {
    const clean = value.trim();
    if (!clean) return;
    if (tags.some((tag) => tag.toLowerCase() === clean.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...tags, clean]);
    setDraft("");
  };

  const suggestionsLeft = suggestions.filter((s) => !tags.some((tag) => tag.toLowerCase() === s.toLowerCase())).slice(0, 12);

  return (
    <div className="ma-field">
      <label className="ma-label" htmlFor={`${id}-input`}>
        {label}
      </label>
      <div className="ma-taginput">
        {tags.map((tag) => (
          <span key={tag} className="ma-tag">
            {tag}
            <button type="button" aria-label={`remove ${tag}`} onClick={() => onChange(tags.filter((item) => item !== tag))}>
              ×
            </button>
          </span>
        ))}
        <input
          id={`${id}-input`}
          className="ma-input ma-taginput__input"
          value={draft}
          placeholder={placeholder ?? t("اكتب ثم Enter…", "Type then Enter…")}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              add(draft);
            }
          }}
          onBlur={() => add(draft)}
        />
      </div>
      {suggestionsLeft.length > 0 ? (
        <div className="ma-tagsuggestions">
          {suggestionsLeft.map((suggestion) => (
            <button key={suggestion} type="button" className="ma-tag ma-tag--ghost" onClick={() => add(suggestion)}>
              + {suggestion}
            </button>
          ))}
        </div>
      ) : null}
      {hint ? <span className="ma-help">{hint}</span> : null}
    </div>
  );
}

/** Segmented single-choice control (course/diploma, order direction), styled as soft chips. */
export function SegmentedChoice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: ReactNode;
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="ma-field">
      <span className="ma-label">{label}</span>
      <div className="ma-segmented" role="tablist" aria-label={typeof label === "string" ? label : undefined}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={option.value === value}
            className={`ma-btn ma-btn--sm ${option.value === value ? "ma-btn--secondary" : "ma-btn--soft"}`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Small inline "add a row" helper button used by list editors. */
export function AddRowButton({ label, onClick }: { label: ReactNode; onClick: () => void }) {
  return <Button kind="soft" sm icon="plus" label={label} onClick={onClick} />;
}
