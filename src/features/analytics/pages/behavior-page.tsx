import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { behaviorQueries, type ContentView, type EventTypeCount } from "@/lib/api";
import { buildWindows } from "@/lib/dates";
import { formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { AppLink } from "@/components/ui/app-link";
import { Button, Card, DateRange, Field, Kpi, Loading, PageHead } from "@/components/ui/kit";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageState } from "@/components/ui/primitives";

export default function BehaviorOverviewPage() {
  const t = useT();
  const initial = useMemo(() => buildWindows(30).current, []);
  const [from, setFrom] = useState(initial.start);
  const [to, setTo] = useState(initial.end);
  const [eventSearch, setEventSearch] = useState("");
  const [contentSearch, setContentSearch] = useState("");

  const params = { start: from, end: to };
  const overview = useQuery(behaviorQueries.overview(params));
  const data = overview.data;

  const typeColumns: Column<EventTypeCount>[] = [
    { key: "event", header: t("الحدث", "Event"), cell: (row) => <bdi>{row.event_type}</bdi> },
    { key: "count", header: t("العدد", "Count"), align: "end", cell: (row) => <span className="ma-num">{formatNumber(row.count)}</span> },
  ];

  const contentColumns: Column<ContentView>[] = [
    {
      key: "title",
      header: t("المحتوى", "Content"),
      cell: (row) =>
        row.product_id ? (
          <AppLink className="ma-link ma-link--plain" to={`/learning/catalog/${row.product_id}`}>
            {row.title ?? row.slug ?? row.product_id.slice(0, 8)}
          </AppLink>
        ) : (
          row.title ?? "—"
        ),
    },
    { key: "views", header: t("المشاهدات", "Views"), align: "end", cell: (row) => <span className="ma-num">{formatNumber(row.views)}</span> },
    { key: "viewers", header: t("زوّار فريدون", "Unique viewers"), align: "end", cell: (row) => <span className="ma-num">{formatNumber(row.viewers)}</span> },
    { key: "dwell", header: t("متوسط البقاء", "Avg dwell"), align: "end", cell: (row) => (row.avg_dwell_ms != null ? <span className="ma-num">{Math.round(row.avg_dwell_ms / 1000)}s</span> : "—") },
  ];

  const filteredEvents = useMemo(() => {
    const items = data?.top_event_types ?? [];
    if (!eventSearch.trim()) return items;
    const q = eventSearch.trim().toLowerCase();
    return items.filter((e) => e.event_type.toLowerCase().includes(q));
  }, [data?.top_event_types, eventSearch]);

  const filteredContent = useMemo(() => {
    const items = data?.top_content ?? [];
    if (!contentSearch.trim()) return items;
    const q = contentSearch.trim().toLowerCase();
    return items.filter((c) => (c.title?.toLowerCase().includes(q) || c.slug?.toLowerCase().includes(q)));
  }, [data?.top_content, contentSearch]);

  return (
    <>
      <PageHead title={t("سلوك المستخدمين", "User behavior")} sub={t("حركة الزوّار وأكثر المحتوى مشاهدة خلال النطاق المحدد.", "Visitor traffic and top content for the selected window.")} actions={<Button sm icon="refresh" label={t("تحديث", "Refresh")} onClick={() => overview.refetch()} />} />

      <div className="ma-toolbar">
        <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} onClear={() => { setFrom(initial.start); setTo(initial.end); }} />
      </div>

      <PageState error={overview.error}>
        {data ? (
          <>
            <div className="ma-kpis">
              <Kpi label={t("الأحداث", "Events")} value={<span className="ma-num">{formatNumber(data.events)}</span>} icon="history" field="var(--coral)" />
              <Kpi label={t("الزوّار", "Visitors")} value={<span className="ma-num">{formatNumber(data.visitors)}</span>} icon="users" field="var(--yellow)" />
              <Kpi label={t("زوّار معروفون", "Known visitors")} value={<span className="ma-num">{formatNumber(data.known_visitors)}</span>} icon="user" field="var(--sky)" />
              <Kpi label={t("عملاء", "Customers")} value={<span className="ma-num">{formatNumber(data.customers)}</span>} icon="card" field="var(--teal)" />
            </div>

            <div className="ma-cols ma-cols--2 ma-section-gap">
              <Card title={t("أكثر الأحداث", "Top event types")}>
                <div className="ma-filter-bar">
                  <Field
                    id="event-type-search"
                    label={t("بحث", "Search")}
                    placeholder={t("بحث بنوع الحدث…", "Search event type…")}
                    value={eventSearch}
                    onChange={setEventSearch}
                  />
                </div>
                <DataTable rows={filteredEvents} columns={typeColumns} empty={t("لا أحداث.", "No events.")} />
              </Card>
              <Card title={t("أكثر المحتوى مشاهدة", "Top content")}>
                <div className="ma-filter-bar">
                  <Field
                    id="content-view-search"
                    label={t("بحث", "Search")}
                    placeholder={t("بحث باسم المحتوى…", "Search content title…")}
                    value={contentSearch}
                    onChange={setContentSearch}
                  />
                </div>
                <DataTable rows={filteredContent} columns={contentColumns} empty={t("لا مشاهدات.", "No views.")} />
              </Card>
            </div>
          </>
        ) : overview.isLoading ? (
          <Loading />
        ) : null}
      </PageState>

      <p className="ma-note ma-section-gap">
        <bdi>{t(`النطاق: ${from} → ${to}`, `Window: ${from} → ${to}`)}</bdi>
      </p>
    </>
  );
}
