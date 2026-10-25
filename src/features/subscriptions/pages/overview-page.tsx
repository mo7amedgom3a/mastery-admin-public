import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { subscriptionQueries, type SubscriptionFunnelRow, type SubscriptionPlanStats } from "@/lib/api";
import { formatAmount, formatNumber, formatPercent, formatDayMonth } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n";
import { productStatusBadge } from "@/lib/status";
import { AppLink } from "@/components/ui/app-link";
import { Badge, Card, DateRange, Empty, Kpi, Loading, PageHead } from "@/components/ui/kit";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageState } from "@/components/ui/primitives";

import { PlanFunnel } from "../components/funnel";
import { INTERVAL_LABELS, labelOf, toNumber, useStatsWindow } from "../lib";

const money = (list: { currency_code: string; amount: string | number }[] | undefined) =>
  list && list.length ? list.map((m) => formatAmount(toNumber(m.amount), m.currency_code)).join(" · ") : formatAmount(0, "USD");
// Above 100% only happens when checkouts predate view tracking; show no rate rather than a misleading one.
const pct = (value: number | null | undefined) => (value == null || value > 100 ? "—" : formatPercent(value));

export default function SubscriptionsOverviewPage() {
  const t = useT();
  const lang = useLang();
  const { from, to, setFrom, setTo, window } = useStatsWindow(30);
  const overview = useQuery(subscriptionQueries.overview({ ...window, lang }));
  const funnel = useQuery(subscriptionQueries.funnel({ ...window, lang }));
  const o = overview.data;
  const funnelRows = funnel.data?.plans ?? [];
  const totals = funnelRows.reduce((acc, r) => ({ viewed: acc.viewed + r.viewed, checkout_started: acc.checkout_started + r.checkout_started, paid: acc.paid + r.paid }), { viewed: 0, checkout_started: 0, paid: 0 });

  const trendConfig: ChartConfig = {
    new: { label: t("مشتركون جدد", "New subscribers"), color: "var(--green)" },
    churned: { label: t("ألغوا / انتهوا", "Canceled / expired"), color: "var(--pink)" },
  };

  const planColumns: Column<SubscriptionPlanStats>[] = [
    {
      key: "plan", header: t("الباقة", "Plan"), exportValue: (r) => r.title ?? r.slug,
      cell: (r) => (
        <AppLink className="ma-link ma-link--plain" to={`/subscriptions/plans/${r.plan_id}`}>
          <span className="ma-cell-main">{r.title ?? r.slug}</span>
          <span className="ma-cell-sub">{t(labelOf(INTERVAL_LABELS, r.billing_interval).ar, labelOf(INTERVAL_LABELS, r.billing_interval).en)}</span>
        </AppLink>
      ),
    },
    { key: "status", header: t("الحالة", "Status"), exportValue: (r) => r.plan_status, cell: (r) => <Badge def={productStatusBadge(r.plan_status)} /> },
    { key: "active", header: t("نشطون", "Active"), align: "end", exportKind: "number", sortValue: (r) => r.active, exportValue: (r) => r.active, cell: (r) => <span className="ma-num">{formatNumber(r.active)}</span> },
    { key: "new", header: t("جدد في الفترة", "New in period"), align: "end", exportKind: "number", sortValue: (r) => r.new_in_range, exportValue: (r) => r.new_in_range, cell: (r) => <span className="ma-num">{formatNumber(r.new_in_range)}</span> },
    { key: "churned", header: t("ألغوا في الفترة", "Churned in period"), align: "end", exportKind: "number", sortValue: (r) => r.churned_in_range, exportValue: (r) => r.churned_in_range, cell: (r) => <span className="ma-num">{formatNumber(r.churned_in_range)}</span> },
    { key: "past_due", header: t("متأخرون", "Past due"), align: "end", exportKind: "number", exportValue: (r) => r.past_due, cell: (r) => <span className="ma-num">{formatNumber(r.past_due)}</span> },
    { key: "total", header: t("الإجمالي", "All-time"), align: "end", exportKind: "number", sortValue: (r) => r.total, exportValue: (r) => r.total, cell: (r) => <span className="ma-num">{formatNumber(r.total)}</span> },
    { key: "mrr", header: "MRR", align: "end", exportKind: "money", sortValue: (r) => toNumber(r.mrr), exportValue: (r) => toNumber(r.mrr), cell: (r) => <span className="ma-num">{formatAmount(toNumber(r.mrr), r.currency_code)}</span> },
    { key: "revenue", header: t("إيراد الاشتراك الأول", "First-payment revenue"), align: "end", exportKind: "money", sortValue: (r) => toNumber(r.revenue_in_range), exportValue: (r) => toNumber(r.revenue_in_range), cell: (r) => <span className="ma-num">{formatAmount(toNumber(r.revenue_in_range), r.currency_code)}</span> },
  ];

  const funnelColumns: Column<SubscriptionFunnelRow>[] = [
    {
      key: "plan", header: t("الباقة", "Plan"), exportValue: (r) => r.title ?? r.slug,
      cell: (r) => <AppLink className="ma-link ma-link--plain" to={`/subscriptions/plans/${r.plan_id}`}><span className="ma-cell-main">{r.title ?? r.slug}</span></AppLink>,
    },
    { key: "viewed", header: t("شاهدوا", "Viewed"), align: "end", exportKind: "number", sortValue: (r) => r.viewed, exportValue: (r) => r.viewed, cell: (r) => <span className="ma-num">{formatNumber(r.viewed)}</span> },
    { key: "checkout", header: t("بدأوا الدفع", "Started checkout"), align: "end", exportKind: "number", sortValue: (r) => r.checkout_started, exportValue: (r) => r.checkout_started, cell: (r) => <span className="ma-num">{formatNumber(r.checkout_started)}</span> },
    { key: "paid", header: t("اشتركوا", "Subscribed"), align: "end", exportKind: "number", sortValue: (r) => r.paid, exportValue: (r) => r.paid, cell: (r) => <span className="ma-num">{formatNumber(r.paid)}</span> },
    { key: "v2c", header: t("مشاهدة ← دفع", "View → checkout"), align: "end", sortValue: (r) => r.view_to_checkout_rate ?? -1, exportValue: (r) => r.view_to_checkout_rate ?? null, cell: (r) => <span className="ma-num">{pct(r.view_to_checkout_rate)}</span> },
    { key: "c2p", header: t("دفع ← اشتراك", "Checkout → paid"), align: "end", sortValue: (r) => r.checkout_to_paid_rate ?? -1, exportValue: (r) => r.checkout_to_paid_rate ?? null, cell: (r) => <span className="ma-num">{pct(r.checkout_to_paid_rate)}</span> },
    { key: "v2p", header: t("مشاهدة ← اشتراك", "View → paid"), align: "end", sortValue: (r) => r.view_to_paid_rate ?? -1, exportValue: (r) => r.view_to_paid_rate ?? null, cell: (r) => <span className="ma-num">{pct(r.view_to_paid_rate)}</span> },
  ];

  return (
    <>
      <PageHead
        title={t("الاشتراكات", "Subscriptions")}
        sub={t("المشتركون والإيراد المتكرر ومقارنة من شاهد الباقة بمن اشترك فعلًا.", "Subscribers, recurring revenue, and who viewed each plan versus who actually subscribed.")}
        actions={<DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />}
      />
      <PageState error={overview.error}>
        {o ? (
          <div className="ma-kpis">
            <Kpi label={t("مشتركون نشطون", "Active subscribers")} value={formatNumber(o.active)} meta={t(`${formatNumber(o.total_customers)} عميل اشتركوا يومًا`, `${formatNumber(o.total_customers)} customers ever subscribed`)} icon="users" />
            <Kpi label="MRR" value={money(o.mrr)} meta={`ARR ${money(o.arr)}`} icon="card" />
            <Kpi label={t("جدد في الفترة", "New in period")} value={formatNumber(o.new_in_range)} icon="plus" />
            <Kpi label={t("معدل الإلغاء", "Churn rate")} value={pct(o.churn_rate)} meta={t(`${formatNumber(o.churned_in_range)} ألغوا أو انتهوا`, `${formatNumber(o.churned_in_range)} canceled or expired`)} icon="refund" />
            <Kpi label={t("متأخرون في السداد", "Past due")} value={formatNumber(o.past_due)} icon="alert" />
            <Kpi label={t("إيراد الاشتراك الأول", "First-payment revenue")} value={money(o.revenue_in_range)} icon="receipt" />
          </div>
        ) : <Loading />}
      </PageState>

      <div className="ma-cols ma-cols--main-side">
        <Card title={t("المشتركون الجدد مقابل الإلغاءات", "New vs churned subscribers")}>
          {o && o.trend.length ? (
            <ChartContainer config={trendConfig} className="h-[280px] w-full" dir="ltr">
              <BarChart data={o.trend} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={20} tickFormatter={(value: string) => formatDayMonth(value)} />
                <YAxis width={36} allowDecimals={false} tickLine={false} axisLine={false} />
                <ChartTooltip cursor={{ fill: "var(--fill-soft)" }} content={<ChartTooltipContent labelFormatter={(label) => formatDayMonth(String(label))} />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="new" fill="var(--color-new)" radius={[4, 4, 0, 0]} maxBarSize={24} />
                <Bar dataKey="churned" fill="var(--color-churned)" radius={[4, 4, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ChartContainer>
          ) : o ? <Empty text={t("لا اشتراكات جديدة أو إلغاءات في هذه الفترة.", "No new or churned subscriptions in this period.")} /> : <Loading />}
        </Card>
        <Card title={t("شاهدوا مقابل اشتروا (كل الباقات)", "Viewed vs purchased (all plans)")}>
          <PageState error={funnel.error}>{funnel.isLoading ? <Loading /> : <PlanFunnel row={totals} />}</PageState>
        </Card>
      </div>

      <Card flush title={t("حسب الباقة", "By plan")}>
        <DataTable columns={planColumns} rows={o?.plans ?? []} loading={overview.isLoading}
          empty={t("لا توجد باقات.", "No plans.")}
          exportConfig={{ filename: "subscription-plans-stats", title: t("الاشتراكات حسب الباقة", "Subscriptions by plan") }} />
      </Card>

      <Card flush title={t("مقارنة التحويل بين الباقات", "Conversion by plan")}>
        <DataTable columns={funnelColumns} rows={funnelRows} loading={funnel.isLoading}
          empty={t("لا توجد بيانات.", "No data.")}
          exportConfig={{ filename: "subscription-funnel", title: t("مقارنة التحويل بين الباقات", "Conversion by plan") }} />
      </Card>
    </>
  );
}
