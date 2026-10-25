import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";

import { dashboardSummary, productSalesReport, salesReport } from "@/lib/api";
import { defaultRange, percentDelta, previousRange } from "@/lib/dates";
import { exportTabular } from "@/lib/export";
import { formatAmount, formatCompact, formatDate, formatMonth, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { chartRow } from "@/lib/chart-rows";
import { formatByCurrency, monthlyFromDays, netOf } from "@/lib/sales";
import { useReportCurrency } from "@/lib/report-currency";
import { CurrencySelect, FxNote } from "@/components/reports/currency";
import { ExportActions } from "@/components/reports/export-actions";
import { ComboTooltip } from "@/components/reports/combo-tooltip";
import { Card, DateRange, Empty, ErrorAlert, Kpi, Loading, PageHead } from "@/components/ui/kit";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { HintSwatch, InfoHint } from "@/components/ui/info-hint";
import { PageState } from "@/components/ui/primitives";

export default function SalesOverviewPage() {
  const t = useT();
  const initial = useMemo(() => defaultRange(), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Keep the range ordered so a reversed pick still works.
  const [start, end] = from <= to ? [from, to] : [to, from];
  const prev = useMemo(() => previousRange(start, end), [start, end]);

  const { currency, source } = useReportCurrency();
  // Dates are whole days (UTC): `end` covers the full last day.
  const params = { start, end, report_currency: currency, source };
  const prevParams = { start: prev.from, end: prev.to, report_currency: currency, source };
  const sales = useQuery({ queryKey: ["sales-overview", "sales", params], queryFn: () => salesReport(params) });
  const prevSales = useQuery({ queryKey: ["sales-overview", "sales-prev", prevParams], queryFn: () => salesReport(prevParams) });
  const products = useQuery({ queryKey: ["sales-overview", "products", params], queryFn: () => productSalesReport(params) });
  const summary = useQuery({
    queryKey: ["sales-overview", "summary", currency],
    queryFn: () => dashboardSummary({ report_currency: currency }),
  });

  const totals = sales.data?.totals;
  const revenue = totals?.net ?? 0;
  const orders = totals?.orders ?? 0;
  const aov = orders ? (totals?.gross ?? 0) / orders : 0;
  const prevRevenue = prevSales.data?.totals.net ?? 0;
  const prevOrders = prevSales.data?.totals.orders ?? 0;
  const prevAov = prevOrders ? (prevSales.data?.totals.gross ?? 0) / prevOrders : 0;
  const money = (value: number) => formatAmount(value, currency);

  const days = (sales.data?.days ?? []).map((point) => ({ date: point.day, amount: netOf(point), numberOfOrders: point.orders }));
  const months = monthlyFromDays(sales.data?.days ?? []);
  const topCourses = [...(products.data?.items ?? [])]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8)
    .map((row) => ({ ...chartRow(row), title: row.title ?? row.slug ?? "—" }));

  const comboConfig: ChartConfig = {
    amount: { label: t("الإيراد", "Revenue"), color: "var(--coral)" },
    numberOfOrders: { label: t("الطلبات", "Orders"), color: "var(--purple)" },
  };
  const monthlyConfig: ChartConfig = { amount: { label: t("مبيعات الشهر", "Monthly sales"), color: "var(--purple)" } };
  const coursesConfig: ChartConfig = { revenue: { label: t("الإيراد", "Revenue"), color: "var(--teal)" } };

  const error = sales.error ?? products.error ?? prevSales.error;

  const handleExportCsv = (format: "csv" | "xlsx" | "pdf" = "csv") => {
    const rawDays = sales.data?.days ?? [];
    const headers = [
      t("اليوم", "Date"),
      t("الطلبات المدفوعة", "Paid Orders"),
      t("إجمالي الإيراد", "Gross Revenue"),
      t("الاستردادات", "Refunds"),
      t("صافي الإيراد", "Net Revenue"),
      t("عملة التقرير", "Report Currency"),
      t("العملات الأصلية", "Original Currencies"),
    ];

    const rows = rawDays.map((d) => [
      d.day,
      d.orders,
      d.revenue,
      d.refunds ?? 0,
      netOf(d),
      currency,
      formatByCurrency(d.revenue_by_currency),
    ]);

    if (totals) {
      rows.push([
        t("الإجمالي", "Total"),
        totals.orders,
        totals.gross,
        totals.refunds,
        totals.net,
        currency,
        formatByCurrency(totals.net_by_currency),
      ]);
    }

    return exportTabular(format, `sales-overview-${start}-to-${end}.csv`, headers, rows);
  };

  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      await handleExportCsv("pdf");
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <>
      <PageHead
        title={t("نظرة عامة على المبيعات", "Sales overview")}
        sub={t("اختر نطاقًا زمنيًا لعرض المبيعات خلاله.", "Pick a date range to see the sales inside it.")}
        actions={
          <>
            <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
            <CurrencySelect />
            <ExportActions
              onExportCsv={() => handleExportCsv()}
              onExportExcel={() => handleExportCsv("xlsx")}
              onExportPdf={handleExportPdf}
              isExportingPdf={isExportingPdf}
              disabled={sales.isLoading}
            />
          </>
        }
      />

      <div id="sales-overview-content">
        {error ? <ErrorAlert error={error} title={t("تعذّر تحميل المبيعات", "Couldn't load sales")} /> : null}

        <div className="ma-cols ma-cols--3">
          <Kpi
            label={t("صافي الإيرادات", "Net revenue")}
            value={money(revenue)}
            delta={percentDelta(revenue, prevRevenue)}
            meta={t(`الإجمالي ${money(totals?.gross ?? 0)} − استرداد ${money(totals?.refunds ?? 0)}`, `gross ${money(totals?.gross ?? 0)} − refunds ${money(totals?.refunds ?? 0)}`)}
            field="var(--coral)"
          />
          <Kpi label={t("الطلبات المدفوعة", "Paid orders")} value={formatNumber(orders)} delta={percentDelta(orders, prevOrders)} meta={t(`+ ${formatNumber(totals?.free_orders ?? 0)} تسجيل مجاني`, `+ ${formatNumber(totals?.free_orders ?? 0)} free enrolments`)} />
          <Kpi label={t("متوسط قيمة الطلب", "Average order value")} value={money(aov)} delta={percentDelta(aov, prevAov)} meta={t("مقارنة بالفترة السابقة", "vs previous period")} />
        </div>
        <FxNote fx={sales.data?.fx} original={totals?.net_by_currency} />

      <div className="ma-section-gap">
        <Card
          title={
            <span className="ma-chart-title">
              {t("الإيراد والطلبات في النطاق", "Revenue & orders in range")}
              <InfoHint label={t("ما معنى هذا الرسم؟", "What does this chart show?")} title={t("الإيراد والطلبات", "Revenue & orders")}>
                <HintSwatch color="var(--coral)">{t("الأعمدة: صافي إيراد كل يوم (المبيعات − الاستردادات) في النطاق المحدد (المحور الأيسر).", "Columns: each day's net revenue (sales − refunds) in the selected range (left axis).")}</HintSwatch>
                <HintSwatch color="var(--purple)">{t("الخط: عدد الطلبات في اليوم نفسه (المحور الأيمن).", "Line: the number of orders that day (right axis).")}</HintSwatch>
                <span className="ma-hint__meta">
                  {t("النطاق:", "Range:")} {start} → {end}
                </span>
              </InfoHint>
            </span>
          }
        >
          <PageState error={sales.error}>
            {days.length ? (
              <ChartContainer config={comboConfig} className="h-[320px] w-full" dir="ltr">
                <ComposedChart data={days} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={20} tickFormatter={(value: string) => value.slice(5)} />
                  <YAxis yAxisId="revenue" width={56} domain={[0, "auto"]} tickLine={false} axisLine={false} tickFormatter={(value: number) => formatCompact(value)} />
                  <YAxis yAxisId="orders" orientation="right" width={40} domain={[0, "auto"]} tickLine={false} axisLine={false} allowDecimals={false} />
                  <ChartTooltip
                    cursor={{ fill: "var(--fill-soft)" }}
                    offset={8}
                    content={<ComboTooltip currency={currency} />}
                  />
                  <Bar yAxisId="revenue" dataKey="amount" fill="var(--color-amount)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Line yAxisId="orders" type="monotone" dataKey="numberOfOrders" stroke="var(--color-numberOfOrders)" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ChartContainer>
            ) : sales.isLoading ? (
              <Loading />
            ) : (
              <Empty text={t("لا مبيعات في هذا النطاق.", "No sales in this range.")} />
            )}
          </PageState>
        </Card>
      </div>

      <div className="ma-cols ma-cols--2 ma-section-gap">
        <Card
          title={
            <span className="ma-chart-title">
              {t("مبيعات الشهر", "Monthly sales")}
              <InfoHint label={t("ما معنى هذا الرسم؟", "What does this chart show?")} title={t("مبيعات الشهر", "Monthly sales")}>
                {t("كل عمود هو إجمالي إيراد شهر ميلادي داخل النطاق (نجمع أيام الشهر).", "Each column is one calendar month's total revenue inside the range (its days summed).")}
              </InfoHint>
            </span>
          }
        >
          <PageState error={sales.error}>
            {months.length ? (
              <ChartContainer config={monthlyConfig} className="h-[260px] w-full" dir="ltr">
                <BarChart data={months} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis width={52} domain={[0, "auto"]} tickLine={false} axisLine={false} tickFormatter={(value: number) => formatCompact(value)} />
                  <ChartTooltip cursor={{ fill: "var(--fill-soft)" }} offset={8} content={<ChartTooltipContent labelFormatter={(label) => formatMonth(String(label))} valueFormatter={(value) => money(Number(value))} />} />
                  <Bar dataKey="amount" fill="var(--color-amount)" radius={[6, 6, 0, 0]} maxBarSize={54} />
                </BarChart>
              </ChartContainer>
            ) : sales.isLoading ? (
              <Loading />
            ) : (
              <Empty text={t("لا مبيعات في هذا النطاق.", "No sales in this range.")} />
            )}
          </PageState>
        </Card>

        <Card
          title={
            <span className="ma-chart-title">
              {t("الدورات الأعلى إيرادًا", "Top courses by revenue")}
              <InfoHint label={t("ما معنى هذا الرسم؟", "What does this chart show?")} title={t("الدورات الأعلى إيرادًا", "Top courses by revenue")}>
                {t("كل عمود هو إيراد دورة داخل النطاق، مرتبة تنازليًا (أعلى 8).", "Each column is one course's revenue inside the range, sorted descending (top 8).")}
              </InfoHint>
            </span>
          }
        >
          <PageState error={products.error}>
            {topCourses.length ? (
              <ChartContainer config={coursesConfig} className="h-[260px] w-full" dir="ltr">
                <BarChart data={topCourses} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="title"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    interval={0}
                    tickFormatter={(value: string) => (value.length > 14 ? `${value.slice(0, 14)}…` : value)}
                  />
                  <YAxis width={52} domain={[0, "auto"]} tickLine={false} axisLine={false} tickFormatter={(value: number) => formatCompact(value)} />
                  <ChartTooltip cursor={{ fill: "var(--fill-soft)" }} offset={8} content={<ChartTooltipContent valueFormatter={(value) => money(Number(value))} />} />
                  <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            ) : products.isLoading ? (
              <Loading />
            ) : (
              <Empty text={t("لا مبيعات في هذا النطاق.", "No sales in this range.")} />
            )}
          </PageState>
        </Card>
      </div>

      <div className="ma-section-gap">
        <Card title={t("الأرقام التراكمية", "All-time figures")}>
          <div className="ma-cols ma-cols--4">
            <Kpi
              bare
              label={t("صافي الإيرادات", "Net revenue")}
              value={summary.data ? formatAmount(summary.data.revenue_total, summary.data.revenue_currency ?? currency) : "—"}
              meta={<bdi>{formatByCurrency(summary.data?.revenue_by_currency)}</bdi>}
            />
            <Kpi bare label={t("الطلبات المدفوعة", "Paid orders")} value={formatNumber(summary.data?.paid_orders ?? 0)} />
            <Kpi bare label={t("التسجيلات المجانية", "Free enrolments")} value={formatNumber(summary.data?.free_enrollments ?? 0)} />
            <Kpi bare label={t("الكوبونات المستخدمة", "Coupons used")} value={formatNumber(summary.data?.promotions_used ?? 0)} />
          </div>
        </Card>
      </div>
      </div>
    </>
  );
}

