import { formatDateTime } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { Dl } from "@/components/ui/kit";
import { DataTable, type Column } from "@/components/ui/data-table";
import type { Row } from "@/lib/api";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** One legacy value as a definition-list cell: dates by key suffix, primitives inline, JSON block. */
export function RawValue({ fieldKey, value }: { fieldKey: string; value: unknown }) {
  const t = useT();
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? t("نعم", "yes") : t("لا", "no");
  if (typeof value === "number") return <span className="ma-num">{value}</span>;
  if (typeof value === "string") {
    if (/at$/i.test(fieldKey) && /\d{4}-\d{2}-\d{2}/.test(value)) return formatDateTime(value);
    return <bdi>{value}</bdi>;
  }
  if (isRecord(value) || Array.isArray(value)) return <pre className="ma-json">{JSON.stringify(value, null, 2)}</pre>;
  return String(value);
}

/** Renders an untyped legacy object as a definition list. */
export function RawFields({ data }: { data: Row }) {
  return <Dl rows={Object.entries(data).map(([key, value]) => [key, <RawValue key={key} fieldKey={key} value={value} />])} />;
}

/** A table over untyped legacy rows, showing the first N keys discovered in the data. */
export function RawTable({ rows, keys }: { rows: Row[]; keys?: string[] }) {
  const t = useT();
  const discovered = keys ?? Array.from(new Set(rows.slice(0, 20).flatMap((row) => Object.keys(row)))).slice(0, 6);
  const columns: Column<Row>[] = discovered.map((key) => ({
    key,
    header: key,
    cell: (row) => <RawValue fieldKey={key} value={row[key]} />,
  }));
  return <DataTable rows={rows} columns={columns} exportConfig={false} empty={t("لا بيانات.", "No data.")} />;
}
