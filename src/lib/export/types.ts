export type ExportValue = string | number | boolean | Date | null | undefined;

/** How a cell is typed in Excel and aligned/formatted in the PDF. */
export type ExportKind = "text" | "number" | "money" | "date" | "datetime";

export type ExportColumn<T> = {
  key: string;
  header: string;
  value: (row: T) => ExportValue;
  kind?: ExportKind;
  /** ISO currency code shown in the Excel number format for `money` columns. */
  currency?: (row: T) => string | null | undefined;
  align?: "start" | "end";
};

export type ExportMeta = {
  /** Shown under the title: date range, active filters, etc. */
  filters?: string[];
  /** Rows shown as summary tiles in the PDF. */
  summary?: { label: string; value: string }[];
  /** True when the row cap cut the result short. */
  truncated?: boolean;
};
