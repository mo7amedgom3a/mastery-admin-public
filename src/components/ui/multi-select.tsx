import * as Popover from "@radix-ui/react-popover";
import { useMemo, useState } from "react";

import { useT } from "@/lib/i18n";
import { Icon } from "@/components/ui/icon";

export type MultiOption = { value: string; label: string };

/**
 * Multi-select facet control for list toolbars: a compact trigger (`.ma-select-trigger`) opening a
 * searchable checkbox panel on the kit picker styles. Selecting several values never closes the
 * panel, so a filter can hold more than one value the way the storefront search facets do.
 */
export function MultiSelect({
  label,
  options,
  selected,
  onChange,
  searchPlaceholder,
}: {
  label: string;
  options: MultiOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  searchPlaceholder?: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) => option.label.toLowerCase().includes(needle));
  }, [options, query]);

  const summary =
    selected.length === 0
      ? label
      : selected.length === 1
        ? (options.find((option) => option.value === selected[0])?.label ?? label)
        : `${label} · ${selected.length}`;

  const toggle = (value: string) =>
    onChange(selectedSet.has(value) ? selected.filter((item) => item !== value) : [...selected, value]);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="ma-select-trigger"
          data-placeholder={selected.length === 0 ? "" : undefined}
          aria-label={label}
        >
          <span className="ma-multiselect__summary">{summary}</span>
          <Icon name="chevron" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="ma-multiselect" sideOffset={8} align="start" collisionPadding={8}>
          {options.length > 8 ? (
            <input
              className="ma-input ma-picker__search"
              type="search"
              value={query}
              placeholder={searchPlaceholder ?? t("ابحث…", "Search…")}
              onChange={(event) => setQuery(event.target.value)}
            />
          ) : null}
          <div className="ma-picker__list" role="group" aria-label={label}>
            {filtered.length === 0 ? (
              <span className="ma-picker__empty">{t("لا نتائج مطابقة.", "No matches.")}</span>
            ) : (
              filtered.map((option) => (
                <label key={option.value} className="ma-check">
                  <input
                    type="checkbox"
                    checked={selectedSet.has(option.value)}
                    onChange={() => toggle(option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))
            )}
          </div>
          <div className="ma-picker__foot">
            <span className="ma-picker__count">
              {t(`المحدّد: ${selected.length}`, `Selected: ${selected.length}`)}
            </span>
            {selected.length > 0 ? (
              <button type="button" className="ma-link" onClick={() => onChange([])}>
                {t("مسح الكل", "Clear all")}
              </button>
            ) : null}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
