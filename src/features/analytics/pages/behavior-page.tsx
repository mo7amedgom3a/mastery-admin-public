import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

import { behaviorQueries, type ContentView, type EventTypeCount } from "@/lib/api";
import { defaultRange, dayEndIso, dayStartIso } from "@/lib/dates";
import { formatCompact, formatDate, formatNumber, formatPercent, formatShortDay } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { PALETTE } from "@/lib/status";
import { AppLink } from "@/components/ui/app-link";
import { Button, Card, DateRange, Empty, Field, Kpi, Loading, PageHead } from "@/components/ui/kit";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageState } from "@/components/ui/primitives";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

export default function BehaviorOverviewPage() {
  const t = useT();
  const initial = useMemo(() => defaultRange(30), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [eventSearch, setEventSearch] = useState("");
  const [contentSearch, setContentSearch] = useState("");

  const params = { start: dayStartIso(from), end: dayEndIso(to) };
  const overview = useQuery(behaviorQueries.overview(params));
  const trends = useQuery(behaviorQueries.timeseries(params));
  const data = overview.data;

  const activityConfig = {
    events: { label: t("الأحداث", "Events"), color: "var(--coral)" },
    visitors: { label: t("الزوّار", "Visitors"), color: "var(--purple)" },
  } satisfies ChartConfig;

  const contentConfig = {
    views: { label: t("المشاهدات", "Views"), color: "var(--sky)" },
  } satisfies ChartConfig;

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

  const trendPoints = trends.data?.points ?? [];
  const topTypes = useMemo(() => (data?.top_event_types ?? []).slice(0, 8), [data?.top_event_types]);
  const typeTotal = useMemo(() => topTypes.reduce((sum, row) => sum + row.count, 0), [topTypes]);
  const topContent = useMemo(
    () =>
      (data?.top_content ?? []).slice(0, 10).map((row) => ({
        ...row,
        label: row.title ?? row.slug ?? row.product_id?.slice(0, 8) ?? "—",
      })),
    [data?.top_content],
  );

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
      <PageHead title={t("سلوك المستخدمين", "User behavior")} sub={t("حركة الزوّار وأكثر المحتوى مشاهدة خلال النطاق المحدد.", "Visitor traffic and top content for the selected window.")} actions={<Button sm icon="refresh" label={t("تحديث", "Refresh")} onClick={() => { overview.refetch(); trends.refetch(); }} />} />

      <div className="ma-toolbar">
        <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} onClear={() => { setFrom(initial.from); setTo(initial.to); }} />
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

            <Card title={t("النشاط اليومي", "Daily activity")} className="ma-section-gap">
              {trends.isLoading ? (
                <Loading />
              ) : trendPoints.length ? (
                <ChartContainer config={activityConfig} className="h-[280px] w-full" dir="ltr">
                  <ComposedChart data={trendPoints} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} tickFormatter={(value: string) => formatShortDay(value)} />
                    <YAxis yAxisId="events" width={52} tickLine={false} axisLine={false} tickFormatter={(value: number) => formatCompact(value)} />
                    <YAxis yAxisId="visitors" orientation="right" width={44} tickLine={false} axisLine={false} tickFormatter={(value: number) => formatCompact(value)} />
                    <ChartTooltip
                      cursor={{ stroke: "var(--line)" }}
                      offset={8}
                      content={<ChartTooltipContent labelFormatter={(label) => formatDate(String(label))} valueFormatter={(value) => formatNumber(Number(value))} />}
                    />
                    <Area yAxisId="events" type="monotone" dataKey="events" stroke="var(--color-events)" fill="var(--color-events)" fillOpacity={0.16} strokeWidth={2.5} />
                    <Line yAxisId="visitors" type="monotone" dataKey="visitors" stroke="var(--color-visitors)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                  </ComposedChart>
                </ChartContainer>
              ) : (
                <Empty text={t("لا بيانات في هذه الفترة.", "No data in this period.")} />
              )}
            </Card>

            <div className="ma-cols ma-cols--2 ma-section-gap">
              <Card title={t("توزيع الأحداث", "Event mix")}>
                {topTypes.length ? (
                  <div>
                    <ChartContainer config={{}} className="h-[200px] w-full" dir="ltr">
                      <PieChart>
                        <Pie data={topTypes} dataKey="count" nameKey="event_type" innerRadius={54} outerRadius={86} paddingAngle={2} strokeWidth={0}>
                          {topTypes.map((row, index) => (
                            <Cell key={row.event_type} fill={PALETTE[index % PALETTE.length]} />
                          ))}
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent valueFormatter={(value) => formatNumber(Number(value))} />} />
                      </PieChart>
                    </ChartContainer>
                    <ul className="ma-list" style={{ margin: 0 }}>
                      {topTypes.map((row, index) => (
                        <li key={row.event_type}>
                          <span className="ma-legend__dot" style={{ background: PALETTE[index % PALETTE.length] }} />
                          <span className="ma-cell-main" style={{ flex: 1 }}><bdi>{row.event_type}</bdi></span>
                          <span className="ma-num">{formatNumber(row.count)}</span>
                          <span className="ma-cell-sub" style={{ minWidth: 52, textAlign: "end" }}>
                            {typeTotal ? formatPercent((row.count / typeTotal) * 100) : "—"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <Empty text={t("لا أحداث.", "No events.")} />
                )}
              </Card>

              <Card title={t("أكثر المحتوى مشاهدة", "Top content by views")}>
                {topContent.length ? (
                  <ChartContainer config={contentConfig} className="h-[240px] w-full" dir="ltr">
                    <BarChart data={topContent} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
                      <CartesianGrid horizontal={false} />
                      <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(value: number) => formatCompact(value)} />
                      <YAxis type="category" dataKey="label" width={150} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                      <ChartTooltip cursor={{ fill: "var(--line)", fillOpacity: 0.25 }} content={<ChartTooltipContent valueFormatter={(value) => formatNumber(Number(value))} />} />
                      <Bar dataKey="views" fill="var(--color-views)" radius={[0, 6, 6, 0]} barSize={14} />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <Empty text={t("لا مشاهدات.", "No views.")} />
                )}
              </Card>
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
