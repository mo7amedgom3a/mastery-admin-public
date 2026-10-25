import { useQuery, type QueryKey, type UseQueryOptions } from "@tanstack/react-query";

import type { Row } from "@/lib/api";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { normalizeRows } from "@/lib/rows";
import { Card, Dl, PageHead } from "@/components/ui/kit";
import { DataTable, type Column } from "@/components/ui/data-table";

export type AdminListPanelProps = {
  titleAr: string;
  titleEn: string;
  subAr: string;
  subEn: string;
  /** An admin API query (`<area>Queries.*`); pages, arrays and single objects are all rendered. */
  query: UseQueryOptions<unknown, Error, unknown, QueryKey>;
  /** Columns to show, in order (default: the first keys found in the rows). */
  columns?: string[];
  /** Skip the page header (for pages that compose several panels). */
  hideHead?: boolean;
  /** Card title used when the page header is hidden. */
  panelTitle?: string;
};

/** Read panel over one admin API resource: rows as a table, a single object as a definition list. */
export function AdminListPanel({ titleAr, titleEn, subAr, subEn, query, columns, hideHead, panelTitle }: AdminListPanelProps) {
  const t = useT();
  const result = useQuery(query);
  const data = result.data;
  const isPage = Array.isArray(data) || (isPlainObject(data) && Array.isArray((data as { items?: unknown }).items));
  const rows = isPage ? normalizeRows(data) : [];
  const objectEntries = !isPage && isPlainObject(data) ? Object.entries(data) : [];

  return (
    <>
      {hideHead ? null : <PageHead title={t(titleAr, titleEn)} sub={t(subAr, subEn)} />}
      <Card flush title={hideHead ? panelTitle : undefined}>
        {objectEntries.length > 0 ? (
          <div className="ma-panel__body">
            <Dl rows={objectEntries.map(([key, value]) => [labelOf(key), renderCell(value)])} />
          </div>
        ) : (
          <DataTable
            columns={autoColumns(rows, columns)}
            rows={rows}
            loading={result.isLoading}
            error={result.error}
            empty={t("لا بيانات.", "No data.")}
          />
        )}
      </Card>
    </>
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** `legacy_offer_id` → `Legacy offer id`. */
function labelOf(key: string): string {
  const text = key.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function autoColumns(rows: Row[], wanted?: string[]): Column<Row>[] {
  const keys = wanted ?? Array.from(new Set(rows.slice(0, 20).flatMap((row) => Object.keys(row)))).slice(0, 7);
  return keys.map((key) => ({
    key,
    header: labelOf(key),
    sortable: true,
    sortValue: (row) => {
      const value = row[key];
      return typeof value === "number" || typeof value === "string" ? value : null;
    },
    cell: (row) => renderCell(row[key]),
  }));
}

function renderCell(value: unknown) {
  if (value == null) return "—";
  if (typeof value === "number") return <span className="ma-num">{formatNumber(value)}</span>;
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (Array.isArray(value)) return value.length ? value.map((item) => (isPlainObject(item) ? JSON.stringify(item) : String(item))).join(", ") : "—";
  if (isPlainObject(value)) return <code className="ma-cell-sub">{JSON.stringify(value)}</code>;
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) return formatDateTime(text);
  return text;
}
