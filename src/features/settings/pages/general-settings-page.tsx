import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { settingsQueries, type Row } from "@/lib/api";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { Card, Field, PageHead } from "@/components/ui/kit";
import { DataTable, type Column } from "@/components/ui/data-table";

export default function GeneralSettingsPage() {
  const t = useT();
  const countries = useQuery(settingsQueries.countries());
  const social = useQuery(settingsQueries.social());
  const tags = useQuery(settingsQueries.tags({ limit: 200 }));
  const modules = useQuery(settingsQueries.modules());
  const socialRows: Row[] = Object.entries(social.data ?? {}).map(([network, url]) => ({ network, url }));

  return (
    <>
      <PageHead title={t("عام", "General")} sub={t("بيانات مرجعية وإعدادات الموقع.", "Reference data and site settings.")} />
      <div className="ma-cols ma-cols--2">
        <ReferenceCard title={t("الدول", "Countries")} rows={countries.data?.items ?? []} loading={countries.isLoading} error={countries.error} />
        <ReferenceCard title={t("وسائل التواصل", "Social links")} rows={socialRows} loading={social.isLoading} error={social.error} />
        <ReferenceCard title={t("وسوم التتبع", "Tracking tags")} rows={tags.data?.items ?? []} loading={tags.isLoading} error={tags.error} />
        <ReferenceCard title={t("وحدات الصلاحيات", "Permission modules")} rows={modules.data?.items ?? []} loading={modules.isLoading} error={modules.error} />
      </div>
    </>
  );
}

function ReferenceCard({ title, rows, loading, error }: { title: string; rows: Row[]; loading: boolean; error: unknown }) {
  const t = useT();
  const [search, setSearch] = useState("");
  const allRows = rows;

  const filteredRows = useMemo(() => {
    if (!search.trim()) return allRows;
    const q = search.trim().toLowerCase();
    return allRows.filter((r) => JSON.stringify(r).toLowerCase().includes(q));
  }, [allRows, search]);

  return (
    <Card flush title={title}>
      <div className="ma-filter-bar">
        <Field
          id={`ref-search-${title}`}
          label={t("بحث", "Search")}
          placeholder={t("بحث…", "Search…")}
          value={search}
          onChange={setSearch}
        />
      </div>
      <DataTable columns={autoColumns(allRows)} rows={filteredRows} loading={loading} error={error} empty={t("لا بيانات.", "No data.")} />
    </Card>
  );
}

function autoColumns(rows: Row[]): Column<Row>[] {
  const keys = Array.from(new Set(rows.slice(0, 20).flatMap((row) => Object.keys(row)))).slice(0, 5);
  return keys.map((key) => ({ key, header: key.replace(/_/g, " "), cell: (row) => renderCell(row[key]) }));
}

function renderCell(value: unknown) {
  if (value == null) return "—";
  if (typeof value === "number") return <span className="ma-num">{formatNumber(value)}</span>;
  if (typeof value === "boolean") return value ? "yes" : "no";
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return formatDateTime(text);
  return text;
}
