import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { behaviorQueries, type EventStreamRow } from "@/lib/api";
import { buildWindows } from "@/lib/dates";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { AppLink } from "@/components/ui/app-link";
import { Badge, Button, Card, DateRange, Field, Loading, PageHead } from "@/components/ui/kit";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageState, Pagination } from "@/components/ui/primitives";

const PAGE_SIZE = 25;

export default function BehaviorMapPage() {
  const t = useT();
  const initial = useMemo(() => buildWindows(30).current, []);
  const [from, setFrom] = useState(initial.start);
  const [to, setTo] = useState(initial.end);
  const [eventType, setEventType] = useState("");
  const [entityType, setEntityType] = useState("");
  const [offset, setOffset] = useState(0);

  const params = {
    start: from,
    end: to,
    event_type: eventType || undefined,
    entity_type: entityType || undefined,
    limit: PAGE_SIZE,
    offset,
  };
  const stream = useQuery(behaviorQueries.events(params));
  const data = stream.data;

  const columns: Column<EventStreamRow>[] = [
    { key: "when", header: t("الوقت", "When"), cell: (row) => formatDateTime(row.created_at) },
    { key: "event", header: t("الحدث", "Event"), cell: (row) => <bdi>{row.event_type}</bdi> },
    { key: "entity", header: t("الكيان", "Entity"), cell: (row) => <bdi>{row.entity_type}{row.legacy_entity_id ? ` #${row.legacy_entity_id}` : ""}</bdi> },
    {
      key: "customer",
      header: t("العميل", "Customer"),
      cell: (row) =>
        row.customer_id ? (
          <AppLink className="ma-link ma-link--plain" to={`/customers/${row.customer_id}`}>
            <bdi>{row.customer_id.slice(0, 8)}</bdi>
          </AppLink>
        ) : (
          <span className="ma-cell-sub">{t("زائر مجهول", "Anonymous")}</span>
        ),
    },
    { key: "path", header: t("المسار", "Path"), cell: (row) => <bdi className="ma-cell-sub">{row.method} {row.path}</bdi> },
    { key: "status", header: t("الحالة", "Status"), align: "end", cell: (row) => <Badge def={{ label: { ar: String(row.status_code), en: String(row.status_code) }, tone: row.status_code < 400 ? "success" : "danger" }} /> },
    { key: "dwell", header: t("المدة", "Duration"), align: "end", cell: (row) => (row.duration_ms != null ? <span className="ma-num">{formatNumber(row.duration_ms)}ms</span> : "—") },
  ];

  return (
    <>
      <PageHead title={t("مخطط السلوك", "Behavior map")} sub={t("تيار أحداث السلوك الخام، مع تصفية بالحدث والكيان.", "The raw behavior event stream, filtered by event and entity.")} actions={<Button sm icon="refresh" label={t("تحديث", "Refresh")} onClick={() => stream.refetch()} />} />

      <Card>
        <div className="ma-toolbar">
          <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} onClear={() => { setFrom(initial.start); setTo(initial.end); }} />
          <Field id="evt-type" label={t("نوع الحدث", "Event type")} placeholder={t("مثال: page_view…", "e.g. page_view…")} value={eventType} onChange={(value) => { setEventType(value); setOffset(0); }} />
          <Field id="ent-type" label={t("نوع الكيان", "Entity type")} placeholder={t("مثال: course…", "e.g. course…")} value={entityType} onChange={(value) => { setEntityType(value); setOffset(0); }} />
        </div>
      </Card>

      <PageState error={stream.error}>
        {stream.isLoading ? (
          <Loading />
        ) : (
          <Card className="ma-section-gap">
            <DataTable
              rows={data?.items ?? []}
              columns={columns}
              empty={t("لا أحداث.", "No events.")}
              footer={data ? <Pagination total={data.total} limit={data.limit} offset={data.offset} onPage={setOffset} /> : null}
            />
          </Card>
        )}
      </PageState>
    </>
  );
}
