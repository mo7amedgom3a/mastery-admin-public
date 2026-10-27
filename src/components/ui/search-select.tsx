import * as Popover from "@radix-ui/react-popover";
import { useMemo, useState } from "react";

import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n";
import { Icon } from "@/components/ui/icon";

export type SearchSelectOption = {
  value: string;
  label: string;
  description?: string;
};

/**
 * A single-select dropdown with a search box. Used for long lists such as "attach policy"
 * and "choose team/admin", where a plain select is hard to scan.
 */
export function SearchSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  showLabel = false,
  fullWidth = false,
  size = "sm",
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  showLabel?: boolean;
  fullWidth?: boolean;
  size?: "sm" | "md";
  disabled?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = options.find((option) => option.value === value);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(needle) ||
        (option.description ?? "").toLowerCase().includes(needle),
    );
  }, [options, query]);

  const trigger = (
    <Popover.Trigger asChild>
      <button
        type="button"
        className={cn(
          "ma-select-trigger",
          size === "md" && "ma-select-trigger--lg",
          fullWidth && "ma-select-trigger--full",
        )}
        aria-label={label}
        data-placeholder={selected ? undefined : ""}
        disabled={disabled}
      >
        <span className="ma-multiselect__summary">{selected?.label ?? placeholder ?? label}</span>
        <Icon name="chevron" />
      </button>
    </Popover.Trigger>
  );

  const control = (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      {trigger}
      <Popover.Portal>
        <Popover.Content
          className="ma-multiselect"
          sideOffset={8}
          align="start"
          collisionPadding={8}
        >
          <input
            className="ma-input ma-picker__search"
            type="search"
            value={query}
            placeholder={searchPlaceholder ?? t("ابحث…", "Search…")}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
          />
          <div className="ma-picker__list" role="listbox" aria-label={label}>
            {filtered.length === 0 ? (
              <span className="ma-picker__empty">{t("لا نتائج مطابقة.", "No matches.")}</span>
            ) : (
              filtered.map((option) => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className="ma-picker__option"
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <span>
                      <span className="ma-cell-main">{option.label}</span>
                      {option.description ? (
                        <span className="ma-cell-sub">{option.description}</span>
                      ) : null}
                    </span>
                    {isSelected ? <Icon name="check" /> : null}
                  </button>
                );
              })
            )}
          </div>
          <div className="ma-picker__foot">
            <span className="ma-picker__count">
              {t(`النتائج: ${filtered.length}`, `Results: ${filtered.length}`)}
            </span>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );

  if (!showLabel) return control;

  return (
    <div className={cn("ma-field", fullWidth && "ma-field--full")}>
      <span className="ma-label">{label}</span>
      {control}
    </div>
  );
}
