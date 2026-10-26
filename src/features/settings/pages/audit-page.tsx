import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  iamQueries,
  listAuditLogs,
  type AuditLog,
  type AuditLogsParams,
} from "@/lib/api";
import { defaultRange } from "@/lib/dates";
import { formatCompact, formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { Button, Card, DateRange, ErrorAlert, Kpi, Loading, PageHead } from "@/components/ui/kit";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/primitives";
import { SearchBox } from "@/components/ui/paged-list";
import { SelectField } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

const PAGE_SIZE = 25;

function toUtcStart(date: string): string {
  return `${date.slice(0, 10)}T00:00:00Z`;
}

function toUtcEnd(date: string): string {
  return `${date.slice(0, 10)}T23:59:59Z`;
}

function daysBetween(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00Z`).getTime();
  const end = new Date(`${to}T00:00:00Z`).getTime();
  const days = Math.round((end - start) / 86_400_000) + 1;
  return Math.min(365, Math.max(1, days || 1));
}

function prettyJson(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

export default function AuditPage() {
  const t = useT();
  const initial = useMemo(() => defaultRange(30), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [actorType, setActorType] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rangeDays = daysBetween(from, to);
  const filters: AuditLogsParams = {
    limit: PAGE_SIZE,
    offset,
    search: search.trim() || undefined,
    actor_type: actorType === "all" ? undefined : actorType,
    start: toUtcStart(from),
    end: toUtcEnd(to),
  };

  const logs = useQuery(iamQueries.auditLogs(filters));
  const stats = useQuery(iamQueries.auditStats({ days: rangeDays, top_n: 10 }));
  const detail = useQuery({
    ...iamQueries.auditLog(selectedId ?? ""),
    enabled: Boolean(selectedId),
  });

  const rows = logs.data?.items ?? [];
  const daily = stats.data?.daily ?? [];

  const statConfig = {
    count: { label: t("السجلات", "Entries"), color: "var(--coral)" },
  } satisfies ChartConfig;

  const columns: Column<AuditLog>[] = [
    { key: "when", header: t("التاريخ", "When"), sortable: true, cell: (row) => formatDateTime(row.created_at), exportKind: "datetime" },
    { key: "action", header: t("الإجراء", "Action"), cell: (row) => <span className="ma-num">{row.action}</span> },
    { key: "entity", header: t("الكيان", "Entity"), cell: (row) => <span className="ma-cell-sub">{row.entity_type}</span> },
    {
      key: "actor",
      header: t("المشرف / الفاعل", "Actor"),
      cell: (row) => <bdi className="ma-cell-sub">{row.actor_id ? row.actor_id.slice(0, 8) : row.actor_type}</bdi>,
    },
    {
      key: "status",
      header: t("الحالة", "Status"),
      align: "end",
      cell: (row) => (row.status_code != null ? <span className="ma-num">{row.status_code}</span> : "—"),
    },
    {
      key: "request",
      header: t("الطلب", "Request"),
      cell: (row) => <bdi className="ma-cell-sub">{row.request_id ? row.request_id.slice(0, 8) : "—"}</bdi>,
    },
    {
      key: "open",
      header: "",
      exportable: false,
      cell: (row) => (
        <Button sm kind="ghost" icon="eye" label={t("عرض", "View")} onClick={() => setSelectedId(row.audit_log_id)} />
      ),
    },
  ];

  const toolbar = (
    <>
      <SearchBox
        placeholder={t("بحث في الإجراء أو المسار أو الكيان…", "Search action, path or entity…")}
        value={search}
        onChange={(value) => {
          setSearch(value);
          setOffset(0);
        }}
      />
      <SelectField
        label={t("نوع الفاعل", "Actor type")}
        value={actorType}
        onChange={(value) => {
          setActorType(value);
          setOffset(0);
        }}
        options={[
          { value: "all", label: t("الكل", "All") },
          { value: "admin", label: t("مشرف", "Admin") },
          { value: "system", label: t("نظام", "System") },
        ]}
      />
    </>
  );

  const fetchAll = async (max: number) => {
    const pageSize = 200;
    let collected: AuditLog[] = [];
    let pageOffset = 0;
    while (collected.length < max) {
      const page = await listAuditLogs({ ...filters, limit: pageSize, offset: pageOffset });
      collected = collected.concat(page.items);
      if (page.items.length === 0 || collected.length >= page.total) break;
      pageOffset += pageSize;
    }
    return { items: collected.slice(0, max), truncated: collected.length > max };
  };

  return (
    <>
      <PageHead
        title={t("سجل التدقيق", "Audit log")}
        sub={t(
          "كل عمليات التعديل والكتابة في اللوحة الإدارية، مع سياق الطلب (المسار، الحالة، معرّف الطلب) — الأحدث أولًا.",
          "Every administrative write and mutation, with request context (path, status, request id) — newest first.",
        )}
        actions={
          <Button
            sm
            icon="refresh"
            label={t("تحديث", "Refresh")}
            onClick={() => {
              logs.refetch();
              stats.refetch();
            }}
          />
        }
      />

      <div className="ma-toolbar">
        <DateRange
          from={from}
          to={to}
          onFrom={(value) => {
            setFrom(value);
            setOffset(0);
          }}
          onTo={(value) => {
            setTo(value);
            setOffset(0);
          }}
          onClear={() => {
            setFrom(initial.from);
            setTo(initial.to);
            setOffset(0);
          }}
        />
      </div>

      {stats.data ? (
        <>
          <div className="ma-kpis">
            <Kpi label={t("سجلات في النطاق", "Entries in range")} value={<span className="ma-num">{formatNumber(stats.data.total)}</span>} icon="clipboard" field="var(--coral)" />
            <Kpi label={t("أكثر إجراء", "Top action")} value={<bdi style={{ fontSize: 13 }}>{stats.data.top_actions[0]?.action ?? "—"}</bdi>} icon="zap" field="var(--purple)" />
            <Kpi label={t("أنشط مشرف", "Busiest admin")} value={<bdi style={{ fontSize: 13 }}>{stats.data.top_actors[0]?.actor_id?.slice(0, 8) ?? "—"}</bdi>} icon="user" field="var(--sky)" />
            <Kpi label={t("أيام بها نشاط", "Active days")} value={<span className="ma-num">{formatNumber(stats.data.daily.length)}</span>} icon="calendar" field="var(--teal)" />
          </div>

          <Card title={t("حجم التدقيق يوميًا", "Audit volume")} className="ma-section-gap">
            {daily.length ? (
              <ChartContainer config={statConfig} className="h-[220px] w-full" dir="ltr">
                <BarChart data={daily} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} tickFormatter={(value: string) => formatDate(String(value)).slice(0, 6)} />
                  <YAxis width={48} tickLine={false} axisLine={false} tickFormatter={(value: number) => formatCompact(value)} />
                  <ChartTooltip
                    cursor={{ fill: "var(--line)", fillOpacity: 0.25 }}
                    content={<ChartTooltipContent labelFormatter={(label) => formatDate(String(label))} valueFormatter={(value) => formatNumber(Number(value))} />}
                  />
                  <Bar dataKey="count" fill="var(--color-count)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <Loading />
            )}
          </Card>
        </>
      ) : stats.isLoading ? (
        <Loading />
      ) : null}

      <Card flush className="ma-section-gap">
        <DataTable
          columns={columns}
          rows={rows}
          toolbar={toolbar}
          loading={logs.isLoading}
          error={logs.error}
          empty={t("لا سجلات مطابقة.", "No matching logs.")}
          exportConfig={{
            filename: "audit-log",
            title: t("سجل التدقيق", "Audit log"),
            pdf: true,
            fetchAll,
          }}
          footer={logs.data ? <Pagination total={logs.data.total} limit={logs.data.limit} offset={logs.data.offset} onPage={setOffset} /> : null}
        />
      </Card>

      <Modal
        open={Boolean(selectedId)}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        title={t("تفاصيل سجل التدقيق", "Audit entry")}
        size="lg"
      >
        {detail.isLoading ? (
          <Loading />
        ) : detail.error ? (
          <ErrorAlert error={detail.error} />
        ) : detail.data ? (
          <div className="ma-stack">
            <dl className="ma-dl">
              <div><dt>{t("الإجراء", "Action")}</dt><dd><bdi className="ma-num">{detail.data.action}</bdi></dd></div>
              <div><dt>{t("الكيان", "Entity")}</dt><dd><bdi>{detail.data.entity_type} · {detail.data.entity_id}</bdi></dd></div>
              <div><dt>{t("الفاعل", "Actor")}</dt><dd><bdi>{detail.data.actor_type} · {detail.data.actor_id ?? "—"}</bdi></dd></div>
              <div><dt>{t("الوقت", "When")}</dt><dd>{formatDateTime(detail.data.created_at)}</dd></div>
              <div><dt>{t("الطلب", "Request")}</dt><dd><bdi>{detail.data.request_id ?? "—"}</bdi></dd></div>
              <div><dt>{t("المسار", "Path")}</dt><dd><bdi>{detail.data.method ?? "—"} {detail.data.path ?? "—"}</bdi></dd></div>
              <div><dt>{t("الحالة / المدة", "Status / duration")}</dt><dd>{detail.data.status_code ?? "—"} · {detail.data.duration_ms != null ? `${detail.data.duration_ms}ms` : "—"}</dd></div>
              <div><dt>{t("بصمة IP", "IP hash")}</dt><dd><bdi className="ma-cell-sub">{detail.data.ip_hash?.slice(0, 16) ?? "—"}…</bdi></dd></div>
            </dl>

            <div className="ma-cols ma-cols--2">
              <div>
                <h4 className="ma-diff-title">{t("قبل", "Before")}</h4>
                <pre className="ma-code">{prettyJson(detail.data.before_state_json)}</pre>
              </div>
              <div>
                <h4 className="ma-diff-title">{t("بعد", "After")}</h4>
                <pre className="ma-code">{prettyJson(detail.data.after_state_json)}</pre>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
