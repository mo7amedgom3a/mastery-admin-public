import { translate, type Lang } from "@/lib/i18n";
import type { Column } from "@/components/ui/data-table";
import type { ExportColumn, ExportValue } from "./types";

const dateFmt = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const numberFmt = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });
const moneyFmt = new Intl.NumberFormat("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Plain-text cell used by the PDF table (Excel keeps the typed value). */
export function formatExportCell<T>(column: ExportColumn<T>, row: T): string {
  const value: ExportValue = column.value(row);
  if (value === null || value === undefined || value === "") return "—";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "—" : (column.kind === "date" ? dateFmt : dateTimeFmt).format(value);
  if (typeof value === "number") {
    if (column.kind === "money") {
      const currency = column.currency?.(row);
      return currency ? `${moneyFmt.format(value)} ${currency}` : moneyFmt.format(value);
    }
    return numberFmt.format(value);
  }
  return String(value);
}

/**
 * Derives export columns from table columns. Only columns that declare `exportValue`
 * (or a `sortValue` fallback) are exported; `exportable: false` opts a column out.
 */
export function toExportColumns<T>(columns: Column<T>[], visibleKeys?: string[]): ExportColumn<T>[] {
  const result: ExportColumn<T>[] = [];
  for (const column of columns) {
    if (column.exportable === false) continue;
    if (visibleKeys && !visibleKeys.includes(column.key)) continue;
    const value = column.exportValue ?? (column.sortValue ? (row: T) => column.sortValue!(row) : undefined);
    if (!value) continue;
    result.push({
      key: column.key,
      header: column.exportHeader ?? column.header,
      value,
      kind: column.exportKind,
      currency: column.exportCurrency,
      align: column.align,
    });
  }
  return result;
}

/** Plain-text label of a status badge in the given language (exports carry the word, not the colour). */
export function badgeLabel(def: { label: { ar: string; en: string } } | null | undefined, lang: Lang): string {
  return def ? translate(lang, def.label.ar, def.label.en) : "";
}

/** ISO string → `Date` for typed Excel date cells (null when absent/invalid). */
export function dateValue(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}
