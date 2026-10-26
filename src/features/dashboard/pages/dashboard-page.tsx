import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CartesianGrid, Bar, BarChart, Line, LineChart, XAxis, YAxis } from "recharts";

import {
  affiliatesQueries,
  behaviorQueries,
  dashboardSummary,
  listOrders,
  listReferralPayouts,
  listSupportTickets,
  productSalesReport,
  salesReport,
  type AdminOrder,
  type DashboardSummary,
  type ProductSalesRow,
  type SalesPoint,
} from "@/lib/api";
import { formatAmount, formatCompact, formatDate, formatDayMonth, formatMonth, formatNumber, formatPercent, formatShortDay } from "@/lib/format";
import { buildWindows, percentDelta } from "@/lib/dates";
import { formatByCurrency, monthlyFromDays, netOf } from "@/lib/sales";
import { useReportCurrency } from "@/lib/report-currency";
import { useT } from "@/lib/i18n";
import { orderHref, shortRef } from "@/lib/refs";
import { useTimeGreeting } from "@/lib/greeting";
import { orderStatusBadge, PALETTE, initialsOf } from "@/lib/status";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { HintSwatch, InfoHint } from "@/components/ui/info-hint";
import { CountUp } from "@/components/motion/count-up";
import { WavingHand } from "@/components/motion/waving-hand";
import { ViewAllLink } from "@/components/ui/view-all-link";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Avatar, Badge, Bars, Button, Card, Dl, Empty, ErrorAlert, Field, Kpi, Loading } from "@/components/ui/kit";
import { SelectField } from "@/components/ui/select";
import { Icon } from "@/components/ui/icon";
import { CurrencySelect, FxNote } from "@/components/reports/currency";

const RANGES: { days: number; ar: string; en: string }[] = [
  { days: 7, ar: "آخر 7 أيام", en: "Last 7 days" },
  { days: 30, ar: "آخر 30 يومًا", en: "Last 30 days" },
  { days: 90, ar: "آخر 90 يومًا", en: "Last 90 days" },
];

export default function DashboardPage() {
  const t = useT();
  const greeting = useTimeGreeting();
  const [days, setDays] = useState(30);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatus, setOrderStatus] = useState("all");

  const { currency, source } = useReportCurrency();
  const windows = useMemo(() => buildWindows(days), [days]);
  const current = { ...windows.current, report_currency: currency, source };
  const previous = { ...windows.previous, report_currency: currency, source };

  const summary = useQuery({
    queryKey: ["dashboard", "summary", currency],
    queryFn: () => dashboardSummary({ report_currency: currency }),
  });
  const sales = useQuery({ queryKey: ["dashboard", "sales", current], queryFn: () => salesReport(current) });
  const prevSales = useQuery({ queryKey: ["dashboard", "sales-prev", previous], queryFn: () => salesReport(previous) });
  const products = useQuery({ queryKey: ["dashboard", "products", current], queryFn: () => productSalesReport(current) });
  const orders = useQuery({ queryKey: ["dashboard", "orders"], queryFn: () => listOrders({ limit: 20 }) });
  const posthog = useQuery(
    behaviorQueries.posthogOverview({ start: windows.current.start, end: windows.current.end, top_n: 5 }),
  );

  const chartData = alignSeries(sales.data?.days, prevSales.data?.days);
  const months = monthlyFromDays(sales.data?.days ?? []);
  const totals = sales.data?.totals;
  const prevTotals = prevSales.data?.totals;
  const revenue = totals?.net ?? 0;
  const prevRevenue = prevTotals?.net ?? 0;
  const orderCount = totals?.orders ?? 0;
  const prevOrderCount = prevTotals?.orders ?? 0;
  const aov = orderCount ? (totals?.gross ?? 0) / orderCount : 0;
  const prevAov = prevOrderCount ? (prevTotals?.gross ?? 0) / prevOrderCount : 0;
  const money = (value: number) => formatAmount(value, currency);

  const revenueConfig: ChartConfig = {
    current: { label: t("الفترة الحالية", "This period"), color: "var(--coral)" },
    previous: { label: t("الفترة السابقة", "Previous period"), color: "var(--purple)" },
  };

  const monthlyConfig: ChartConfig = {
    amount: { label: t("مبيعات الشهر", "Monthly sales"), color: "var(--purple)" },
  };

  const top = (products.data?.items ?? []).slice(0, 6);
  const loadError = summary.error ?? sales.error ?? prevSales.error ?? products.error ?? orders.error;

  const orderColumns: Column<AdminOrder>[] = [
    {
      key: "order",
      header: t("الطلب", "Order"),
      cell: (row) => (
        <Link to={orderHref(row.ref)} className="ma-link ma-link--plain">
          <span className="ma-cell-main"><bdi>{shortRef(row.ref)}</bdi></span>
          <span className="ma-cell-sub">{formatDayMonth(row.created_at ?? undefined)}</span>
        </Link>
      ),
    },
    {
      key: "customer",
      header: t("العميل", "Customer"),
      cell: (row) => (
        <span className="ma-cell-flex">
          <Avatar initials={initialsOf(row.customer_email)} color="var(--sky)" />
          <span className="ma-cell-main"><bdi>{row.customer_email}</bdi></span>
        </span>
      ),
    },
    { key: "total", header: t("الإجمالي", "Total"), align: "end", cell: (row) => formatAmount(row.amount_minor / 100, row.currency_code) },
    { key: "status", header: t("الحالة", "Status"), cell: (row) => <Badge def={orderStatusBadge(row.status)} /> },
  ];

  const filteredOrders = useMemo(() => {
    let items = orders.data?.items ?? [];
    if (orderSearch.trim()) {
      const q = orderSearch.trim().toLowerCase();
      items = items.filter(
        (o) =>
          o.ref.toLowerCase().includes(q) ||
          o.customer_email?.toLowerCase().includes(q),
      );
    }
    if (orderStatus !== "all") {
      items = items.filter((o) => o.status === orderStatus);
    }
    return items;
  }, [orders.data?.items, orderSearch, orderStatus]);

  return (
    <>
      <header className="ma-page-head">
        <div className="ma-page-head__text">
          <h1>
            <span>{t(greeting.ar, greeting.en)}</span>
            <WavingHand />
          </h1>
          <p className="ma-page-head__sub">{t("ملخص أداء المنصة وما ينتظرك اليوم.", "How the academy is doing, and what needs you today.")}</p>
        </div>
        <div className="ma-page-head__actions">
          <SelectField
            label={t("الفترة", "Period")}
            value={String(days)}
            onChange={(value) => setDays(Number(value))}
            options={RANGES.map((range) => ({ value: String(range.days), label: t(range.ar, range.en) }))}
          />
          <CurrencySelect />
          <Button label={t("إنشاء دورة", "Create course")} icon="plus" kind="primary" href="/learning/courses/new" />
        </div>
      </header>

      {loadError ? <ErrorAlert error={loadError} title={t("تعذّر تحميل بعض البيانات", "Some data couldn't be loaded")} /> : null}

      <div className="ma-cols ma-cols--3">
        <Kpi
          label={t("صافي الإيرادات", "Net revenue")}
          value={money(revenue)}
          delta={percentDelta(revenue, prevRevenue)}
          meta={t(`الإجمالي ${money(totals?.gross ?? 0)} − استرداد ${money(totals?.refunds ?? 0)}`, `gross ${money(totals?.gross ?? 0)} − refunds ${money(totals?.refunds ?? 0)}`)}
          field="var(--coral)"
        />
        <Kpi label={t("الطلبات المدفوعة", "Paid orders")} value={<CountUp value={orderCount} />} delta={percentDelta(orderCount, prevOrderCount)} meta={t(`+ ${formatNumber(totals?.free_orders ?? 0)} تسجيل مجاني`, `+ ${formatNumber(totals?.free_orders ?? 0)} free enrolments`)} />
        <Kpi label={t("متوسط قيمة الطلب", "Average order value")} value={money(aov)} delta={percentDelta(aov, prevAov)} meta={t("مقارنة بالفترة السابقة", "vs previous period")} />
      </div>

      <div className="ma-section-gap">
        <Card
          title={
            <span className="ma-chart-title">
              {t("حركة المتجر", "Storefront traffic")}
              <InfoHint label={t("ما معنى هذه الأرقام؟", "What do these numbers mean?")} title={t("حركة المتجر (PostHog)", "Storefront traffic (PostHog)")}>
                {t(
                  "الزوّار والجلسات ومشاهدات الصفحات من مشروع PostHog لمتجر الواجهة خلال الفترة المحددة.",
                  "Visitors, sessions and pageviews from the storefront's PostHog project for the selected period.",
                )}
              </InfoHint>
            </span>
          }
          actions={<ViewAllLink to="/analytics/posthog" label={t("تحليلات PostHog", "PostHog analytics")} />}
        >
          {posthog.data && !posthog.data.available ? (
            <ErrorAlert error={posthog.data.error ?? t("PostHog غير متاح حاليًا.", "PostHog is unavailable right now.")} />
          ) : posthog.data ? (
            <div className="ma-kpis">
              <Kpi label={t("الزوّار", "Visitors")} value={<span className="ma-num">{formatNumber(posthog.data.visitors)}</span>} icon="users" field="var(--coral)" />
              <Kpi label={t("مشاهدات الصفحات", "Pageviews")} value={<span className="ma-num">{formatNumber(posthog.data.pageviews)}</span>} icon="history" field="var(--yellow)" />
              <Kpi label={t("الجلسات", "Sessions")} value={<span className="ma-num">{formatNumber(posthog.data.sessions)}</span>} icon="clock" field="var(--sky)" />
              <Kpi label={t("زوّار عائدون", "Returning visitors")} value={<span className="ma-num">{formatPercent(posthog.data.returning_rate)}</span>} icon="refresh" field="var(--teal)" />
            </div>
          ) : posthog.isLoading ? (
            <Loading />
          ) : (
            <Empty text={t("لا بيانات.", "No data.")} />
          )}
        </Card>
      </div>
      <FxNote fx={sales.data?.fx} original={totals?.net_by_currency} />

      <div className="ma-cols ma-cols--main-side ma-section-gap">
        <Card
          title={
            <span className="ma-chart-title">
              {t("الإيرادات اليومية", "Daily revenue")}
              <InfoHint label={t("ما معنى الخطوط؟", "What do the lines mean?")} title={t("الإيرادات اليومية", "Daily revenue")}>
                <HintSwatch color="var(--coral)">{t("الفترة الحالية: صافي إيراد كل يوم (المبيعات − الاستردادات) في النطاق المحدد.", "This period: each day's net revenue (sales − refunds) in the selected range.")}</HintSwatch>
                <HintSwatch color="var(--purple)">{t("الفترة السابقة: نفس عدد الأيام قبل النطاق الحالي، للمقارنة.", "Previous period: the same number of days immediately before the range, for comparison.")}</HintSwatch>
                <span className="ma-hint__meta">
                  {t("النطاق الحالي:", "Current range:")} {t(`${days} يومًا`, `last ${days} days`)}
                </span>
              </InfoHint>
            </span>
          }
          actions={<ViewAllLink to="/analytics/sales" label={t("تقرير المبيعات", "Sales report")} />}
        >
          <div className="ma-legend">
            <span style={{ "--c": "var(--coral)" } as React.CSSProperties}>{t("الفترة الحالية", "This period")}</span>
            <span style={{ "--c": "var(--purple)" } as React.CSSProperties}>{t("الفترة السابقة", "Previous period")}</span>
          </div>
          {chartData.length ? (
            <ChartContainer config={revenueConfig} className="h-[280px] w-full" dir="ltr">
              <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} tickFormatter={(value: string) => formatShortDay(value)} />
                <YAxis width={52} domain={[0, "auto"]} tickLine={false} axisLine={false} tickFormatter={(value: number) => formatCompact(value)} />
                <ChartTooltip
                  cursor={{ stroke: "var(--line)" }}
                  offset={8}
                  content={<ChartTooltipContent labelFormatter={(label) => formatDate(String(label))} valueFormatter={(value) => money(Number(value))} />}
                />
                <Line type="monotone" dataKey="previous" stroke="var(--color-previous)" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                <Line type="monotone" dataKey="current" stroke="var(--color-current)" strokeWidth={3} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ChartContainer>
          ) : sales.isLoading ? (
            <Loading />
          ) : (
            <Empty text={t("لا بيانات في هذه الفترة.", "No data in this period.")} />
          )}
        </Card>

        <Card title={t("بانتظارك", "Needs you")} actions={<ViewAllLink to="/dashboard/inbox" label={t("صندوق المهام", "Ops inbox")} />}>
          <InboxList />
        </Card>
      </div>

      <div className="ma-section-gap">
        <Card
          title={
            <span className="ma-chart-title">
              {t("مبيعات الشهر", "Monthly sales")}
              <InfoHint label={t("ما معنى هذا الرسم؟", "What does this chart show?")} title={t("مبيعات الشهر", "Monthly sales")}>
                {t("كل عمود هو إجمالي إيراد شهر ميلادي داخل النطاق المحدد (نجمع أيام الشهر). مرّر على العمود لرؤية عدد الطلبات.", "Each column is one calendar month's total revenue inside the selected range (its days summed). Hover a column to see the order count.")}
              </InfoHint>
            </span>
          }
          actions={<ViewAllLink to="/analytics/sales" label={t("تقرير المبيعات", "Sales report")} />}
        >
          {months.length ? (
            <ChartContainer config={monthlyConfig} className="h-[260px] w-full" dir="ltr">
              <BarChart data={months} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis width={52} domain={[0, "auto"]} tickLine={false} axisLine={false} tickFormatter={(value: number) => formatCompact(value)} />
                <ChartTooltip
                  cursor={{ fill: "var(--fill-soft)" }}
                  offset={8}
                  content={<ChartTooltipContent labelFormatter={(label) => formatMonth(String(label))} valueFormatter={(value) => money(Number(value))} />}
                />
                <Bar dataKey="amount" fill="var(--color-amount)" radius={[6, 6, 0, 0]} maxBarSize={64} />
              </BarChart>
            </ChartContainer>
          ) : sales.isLoading ? (
            <Loading />
          ) : (
            <Empty text={t("لا بيانات في هذه الفترة.", "No data in this period.")} />
          )}
        </Card>
      </div>

      <div className="ma-cols ma-cols--3 ma-section-gap">
        <Kpi label={t("المتدربون", "Trainees")} value={<CountUp value={summary.data?.learners_total ?? 0} />} meta={t("إجمالي المتدربين", "all time")} icon="users" field="var(--yellow)" />
        <Kpi label={t("الشهادات الممنوحة", "Certificates granted")} value={<CountUp value={summary.data?.certificates_issued ?? 0} />} meta={t("منذ الإطلاق", "all time")} icon="award" />
        <Kpi label={t("الدورات المنشورة", "Published courses")} value={<CountUp value={summary.data?.products_published ?? 0} />} meta={t(`${formatNumber(summary.data?.products_unpublished ?? 0)} غير منشورة`, `${formatNumber(summary.data?.products_unpublished ?? 0)} unpublished`)} icon="book" />
      </div>

      <div className="ma-cols ma-cols--2 ma-section-gap">
        <Card title={t("الدورات الأعلى إيرادًا", "Top courses by revenue")} actions={<ViewAllLink to="/learning/courses" label={t("كل الدورات", "All courses")} />}>
          {top.length ? (
            <Bars rows={top.map((row: ProductSalesRow, index) => ({ label: row.title ?? row.slug, value: row.revenue, color: PALETTE[index % PALETTE.length] }))} fmt={(v) => money(v)} />
          ) : products.isLoading ? (
            <Loading />
          ) : (
            <Empty text={t("لا مبيعات في هذه الفترة.", "No sales in this period.")} />
          )}
        </Card>
        <Card title={t("المنصة بالأرقام", "Platform at a glance")}>
          <PlatformNumbers summary={summary.data} />
        </Card>
      </div>

      <div className="ma-section-gap">
        <Card
          flush
          title={t("أحدث الطلبات", "Latest orders")}
          actions={<ViewAllLink to="/sales/orders" label={t("كل الطلبات", "All orders")} />}
        >
          <div className="ma-filter-bar">
            <Field
              id="dash-order-search"
              label={t("بحث", "Search")}
              placeholder={t("بحث برقم الطلب أو البريد…", "Search order # or email…")}
              value={orderSearch}
              onChange={setOrderSearch}
            />
            <SelectField
              label={t("الحالة", "Status")}
              value={orderStatus}
              onChange={setOrderStatus}
              options={[
                { value: "all", label: t("كل الحالات", "All statuses") },
                { value: "paid", label: t("مدفوع", "Paid") },
                { value: "pending", label: t("معلق", "Pending") },
                { value: "failed", label: t("فشل", "Failed") },
                { value: "refunded", label: t("مسترد", "Refunded") },
                { value: "cancelled", label: t("ملغي", "Cancelled") },
              ]}
            />
          </div>
          <DataTable columns={orderColumns} rows={filteredOrders} loading={orders.isLoading} empty={t("لا طلبات بعد.", "No orders yet.")} />
        </Card>
      </div>

      <p className="ma-note">
        {t("أرقام المبيعات والطلبات والمدفوعات من جداول B2C (مصدر الحقيقة)، والشهادات والفيديوهات من نظام التعلّم القديم.", "Sales, orders and payments come from the B2C tables (the source of truth); certificates and videos from the legacy learning platform.")}
      </p>
    </>
  );
}

function InboxList() {
  const t = useT();
  const tickets = useQuery({ queryKey: ["dashboard", "tickets"], queryFn: () => listSupportTickets({ limit: 1 }) });
  const payouts = useQuery({ queryKey: ["dashboard", "payouts"], queryFn: () => listReferralPayouts({ limit: 100 }) });
  const affiliatePayouts = useQuery(affiliatesQueries.payoutsSummary());
  const pendingPayouts =
    (payouts.data?.items ?? []).filter((row) => row.status === 1).length +
    (affiliatePayouts.data ? affiliatePayouts.data.requested_count + affiliatePayouts.data.approved_count : 0);

  const items: { n: number; icon: string; label: string; href: string }[] = [
    { n: tickets.data?.total ?? 0, icon: "ticket", label: t("تذاكر دعم", "Support tickets"), href: "/customers/tickets" },
    { n: pendingPayouts, icon: "card", label: t("طلبات صرف عمولات", "Payout requests"), href: "/marketing/payouts" },
  ];

  return (
    <ul className="ma-list">
      {items.map((item) => (
        <li key={item.href}>
          <Icon name={item.icon} />
          <div className="ma-list__main">
            <Link className="ma-list__title" to={item.href}>
              {item.label}
            </Link>
          </div>
          <strong className="ma-num">{formatNumber(item.n)}</strong>
          <Icon name="chevronEnd" className="ma-icon-dir" />
        </li>
      ))}
    </ul>
  );
}

function PlatformNumbers({ summary }: { summary?: DashboardSummary }) {
  const t = useT();
  return (
    <Dl
      rows={[
        [t("صافي الإيرادات (منذ الإطلاق)", "Net revenue (all time)"), <span className="ma-num" key="r">{summary ? formatAmount(summary.revenue_total, summary.revenue_currency ?? "USD") : "—"} <span className="ma-muted"><bdi>({formatByCurrency(summary?.revenue_by_currency)})</bdi></span></span>],
        [t("الطلبات المدفوعة (منذ الإطلاق)", "Paid orders (all time)"), <span className="ma-num" key="o">{formatNumber(summary?.paid_orders ?? 0)}</span>],
        [t("العملاء النشطون", "Active customers"), <span className="ma-num" key="c">{formatNumber(summary?.customers_confirmed ?? 0)} <span className="ma-muted">/ {formatNumber((summary?.customers_total ?? 0) - (summary?.customers_confirmed ?? 0))}</span></span>],
        [t("نشط اليوم", "Active today"), <span className="ma-num" key="a">{formatNumber(summary?.customers_active_today ?? 0)}</span>],
        [t("التسجيلات المجانية", "Free enrolments"), <span className="ma-num" key="f">{formatNumber(summary?.free_enrollments ?? 0)}</span>],
        [t("الكوبونات المستخدمة", "Coupons used"), <span className="ma-num" key="p">{formatNumber(summary?.promotions_used ?? 0)}</span>],
        [t("المسوقون المعتمدون", "Approved affiliates"), <span className="ma-num" key="af">{formatNumber(summary?.referral_partners_approved ?? 0)}</span>],
      ]}
    />
  );
}

type ChartRow = { day: string; current: number; previous: number | null };

function alignSeries(current: SalesPoint[] | undefined, previous: SalesPoint[] | undefined): ChartRow[] {
  if (!current) return [];
  const prev = previous ?? [];
  return current.map((point, index) => ({
    day: point.day,
    current: netOf(point),
    previous: prev[index] ? netOf(prev[index]) : null,
  }));
}
