import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";

import {
  categoriesReport,
  customersReport,
  dashboardSummary,
  productSalesReport,
  promotionsReport,
  reportKeys,
  salesReport,
  type CategorySalesRow,
  type CustomerSalesRow,
  type FxInfo,
  type ProductSalesRow,
  type PromotionSalesRow,
  type SalesPoint,
} from "@/lib/api";
import { defaultRange, percentDelta, previousRange } from "@/lib/dates";
import { exportTabular } from "@/lib/export";
import { formatAmount, formatCompact, formatDate, formatDateTime, formatMonth, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { chartRow } from "@/lib/chart-rows";
import { useReportCurrency } from "@/lib/report-currency";
import { formatByCurrency, monthlyFromDays, netOf } from "@/lib/sales";
import { Card, DateRange, Empty, ErrorAlert, Field, Kpi, Loading, PageHead } from "@/components/ui/kit";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { HintSwatch, InfoHint } from "@/components/ui/info-hint";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageState } from "@/components/ui/primitives";
import { CurrencySelect, FxNote } from "@/components/reports/currency";
import { ExportActions } from "@/components/reports/export-actions";
import { ComboTooltip } from "@/components/reports/combo-tooltip";

// ---------------------------------------------------------------- sales report

export default function AnalyticsSalesPage() {
  const t = useT();
  const initial = useMemo(() => defaultRange(90), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [search, setSearch] = useState("");
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Keep the range ordered
  const [start, end] = from <= to ? [from, to] : [to, from];
  const prev = useMemo(() => previousRange(start, end), [start, end]);

  const { currency, source } = useReportCurrency();
  const params = { start, end, report_currency: currency, source };
  const prevParams = { start: prev.from, end: prev.to, report_currency: currency, source };

  const report = useQuery({ queryKey: reportKeys.sales(params), queryFn: () => salesReport(params) });
  const prevReport = useQuery({ queryKey: reportKeys.sales(prevParams), queryFn: () => salesReport(prevParams) });
  const products = useQuery({ queryKey: reportKeys.products(params), queryFn: () => productSalesReport(params) });
  const summary = useQuery({
    queryKey: ["analytics-sales", "summary", currency],
    queryFn: () => dashboardSummary({ report_currency: currency }),
  });

  const totals = report.data?.totals;
  const revenue = totals?.net ?? 0;
  const orders = totals?.orders ?? 0;
  const aov = orders ? (totals?.gross ?? 0) / orders : 0;
  const prevRevenue = prevReport.data?.totals.net ?? 0;
  const prevOrders = prevReport.data?.totals.orders ?? 0;
  const prevAov = prevOrders ? (prevReport.data?.totals.gross ?? 0) / prevOrders : 0;
  const money = (value: number) => formatAmount(value, currency);

  const rawDays = useMemo(() => report.data?.days ?? [], [report.data?.days]);
  const days = useMemo(
    () =>
      rawDays.map((point) => ({
        ...point,
        date: point.day,
        amount: netOf(point),
        numberOfOrders: point.orders,
      })),
    [rawDays]
  );
  const months = useMemo(() => monthlyFromDays(rawDays), [rawDays]);
  const topCourses = [...(products.data?.items ?? [])]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8)
    .map((row) => ({ ...chartRow(row), title: row.title ?? row.slug ?? "—" }));

  const comboConfig: ChartConfig = {
    amount: { label: t("الإيراد", "Revenue"), color: "var(--coral)" },
    numberOfOrders: { label: t("الطلبات", "Orders"), color: "var(--purple)" },
  };
  const monthlyConfig: ChartConfig = {
    amount: { label: t("مبيعات الشهر", "Monthly sales"), color: "var(--purple)" },
  };
  const coursesConfig: ChartConfig = {
    revenue: { label: t("الإيراد", "Revenue"), color: "var(--teal)" },
  };

  const columns: Column<SalesPoint>[] = [
    { key: "day", header: t("اليوم", "Day"), sortable: true, cell: (row) => formatDate(row.day) },
    {
      key: "orders",
      header: t("الطلبات المدفوعة", "Paid orders"),
      align: "end",
      sortable: true,
      sortValue: (row) => row.orders,
      cell: (row) => <span className="ma-num">{formatNumber(row.orders)}</span>,
    },
    {
      key: "gross",
      header: t("الإجمالي", "Gross"),
      align: "end",
      sortable: true,
      sortValue: (row) => row.revenue,
      cell: (row) => money(row.revenue),
    },
    {
      key: "refunds",
      header: t("الاستردادات", "Refunds"),
      align: "end",
      sortable: true,
      sortValue: (row) => row.refunds ?? 0,
      cell: (row) => money(row.refunds ?? 0),
    },
    {
      key: "net",
      header: t("الصافي", "Net"),
      align: "end",
      sortable: true,
      sortValue: (row) => netOf(row),
      cell: (row) => money(netOf(row)),
    },
    {
      key: "original",
      header: t("بالعملة الأصلية", "Original currency"),
      cell: (row) => <bdi className="ma-cell-sub">{formatByCurrency(row.revenue_by_currency)}</bdi>,
    },
  ];

  const filteredDays = useMemo(() => {
    if (!search.trim()) return rawDays;
    const q = search.trim().toLowerCase();
    return rawDays.filter((d) => d.day.toLowerCase().includes(q));
  }, [rawDays, search]);

  const error = report.error ?? prevReport.error ?? products.error;

  const handleExportCsv = (format: "csv" | "xlsx" | "pdf" = "csv") => {
    const headers = [
      t("اليوم", "Date"),
      t("الطلبات المدفوعة", "Paid Orders"),
      t("إجمالي الإيراد", "Gross Revenue"),
      t("الاستردادات", "Refunds"),
      t("صافي الإيراد", "Net Revenue"),
      t("عملة التقرير", "Report Currency"),
      t("العملات الأصلية", "Original Currencies"),
    ];

    const rows = filteredDays.map((d) => [
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

    return exportTabular(format, `sales-report-${start}-to-${end}.csv`, headers, rows);
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
        title={t("تقرير المبيعات", "Sales report")}
        sub={t("مبيعات B2C اليومية والتحليلات البيانية والمقارنة بالفترة السابقة.", "Daily B2C sales, visual analytics, and comparison to previous period.")}
        actions={
          <>
            <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
            <CurrencySelect />
            <ExportActions
              onExportCsv={() => handleExportCsv()}
              onExportExcel={() => handleExportCsv("xlsx")}
              onExportPdf={handleExportPdf}
              isExportingPdf={isExportingPdf}
              disabled={report.isLoading}
            />
          </>
        }
      />

      <div id="analytics-sales-content">
        {error ? <ErrorAlert error={error} title={t("تعذّر تحميل تقرير المبيعات", "Couldn't load sales report")} /> : null}

        <div className="ma-cols ma-cols--3">
          <Kpi
            label={t("صافي الإيراد", "Net sales")}
            value={money(revenue)}
            delta={percentDelta(revenue, prevRevenue)}
            meta={t(
              `الإجمالي ${money(totals?.gross ?? 0)} − استرداد ${money(totals?.refunds ?? 0)}`,
              `gross ${money(totals?.gross ?? 0)} − refunds ${money(totals?.refunds ?? 0)}`
            )}
            icon="chart"
            field="var(--coral)"
          />
          <Kpi
            label={t("الطلبات المدفوعة", "Paid orders")}
            value={formatNumber(orders)}
            delta={percentDelta(orders, prevOrders)}
            meta={t(
              `+ ${formatNumber(totals?.free_orders ?? 0)} تسجيل مجاني`,
              `+ ${formatNumber(totals?.free_orders ?? 0)} free enrolments`
            )}
            icon="cart"
            field="var(--yellow)"
          />
          <Kpi
            label={t("متوسط قيمة الطلب", "Average order value")}
            value={money(aov)}
            delta={percentDelta(aov, prevAov)}
            meta={t("مقارنة بالفترة السابقة", "vs previous period")}
            icon="receipt"
            field="var(--purple)"
          />
        </div>

        <div className="ma-section-gap">
          <FxNote fx={report.data?.fx} original={totals?.net_by_currency} />
        </div>

        <div className="ma-section-gap">
          <Card
            title={
              <span className="ma-chart-title">
                {t("الإيراد والطلبات اليومية في النطاق", "Daily revenue & orders in range")}
                <InfoHint label={t("ما معنى هذا الرسم؟", "What does this chart show?")} title={t("الإيراد والطلبات", "Revenue & orders")}>
                  <HintSwatch color="var(--coral)">
                    {t(
                      "الأعمدة: صافي إيراد كل يوم (المبيعات − الاستردادات) في النطاق المحدد (المحور الأيسر).",
                      "Columns: each day's net revenue (sales − refunds) in the selected range (left axis)."
                    )}
                  </HintSwatch>
                  <HintSwatch color="var(--purple)">
                    {t("الخط: عدد الطلبات في اليوم نفسه (المحور الأيمن).", "Line: the number of orders that day (right axis).")}
                  </HintSwatch>
                  <span className="ma-hint__meta">
                    {t("النطاق:", "Range:")} {start} → {end}
                  </span>
                </InfoHint>
              </span>
            }
          >
            <PageState error={report.error}>
              {days.length ? (
                <ChartContainer config={comboConfig} className="h-[320px] w-full" dir="ltr">
                  <ComposedChart data={days} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      minTickGap={20}
                      tickFormatter={(value: string) => value.slice(5)}
                    />
                    <YAxis
                      yAxisId="revenue"
                      width={56}
                      domain={[0, "auto"]}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value: number) => formatCompact(value)}
                    />
                    <YAxis
                      yAxisId="orders"
                      orientation="right"
                      width={40}
                      domain={[0, "auto"]}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <ChartTooltip
                      cursor={{ fill: "var(--fill-soft)" }}
                      offset={8}
                      content={<ComboTooltip currency={currency} />}
                    />
                    <Bar
                      yAxisId="revenue"
                      dataKey="amount"
                      fill="var(--color-amount)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={28}
                    />
                    <Line
                      yAxisId="orders"
                      type="monotone"
                      dataKey="numberOfOrders"
                      stroke="var(--color-numberOfOrders)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ChartContainer>
              ) : report.isLoading ? (
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
                  {t(
                    "كل عمود هو إجمالي إيراد شهر ميلادي داخل النطاق (نجمع أيام الشهر).",
                    "Each column is one calendar month's total revenue inside the range (its days summed)."
                  )}
                </InfoHint>
              </span>
            }
          >
            <PageState error={report.error}>
              {months.length ? (
                <ChartContainer config={monthlyConfig} className="h-[260px] w-full" dir="ltr">
                  <BarChart data={months} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis
                      width={52}
                      domain={[0, "auto"]}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value: number) => formatCompact(value)}
                    />
                    <ChartTooltip
                      cursor={{ fill: "var(--fill-soft)" }}
                      offset={8}
                      content={
                        <ChartTooltipContent
                          labelFormatter={(label) => formatMonth(String(label))}
                          valueFormatter={(value) => money(Number(value))}
                        />
                      }
                    />
                    <Bar dataKey="amount" fill="var(--color-amount)" radius={[6, 6, 0, 0]} maxBarSize={54} />
                  </BarChart>
                </ChartContainer>
              ) : report.isLoading ? (
                <Loading />
              ) : (
                <Empty text={t("لا مبيعات في هذا النطاق.", "No sales in this range.")} />
              )}
            </PageState>
          </Card>

          <Card
            title={
              <span className="ma-chart-title">
                {t("المنتجات الأعلى إيرادًا", "Top products by revenue")}
                <InfoHint label={t("ما معنى هذا الرسم؟", "What does this chart show?")} title={t("المنتجات الأعلى إيرادًا", "Top products by revenue")}>
                  {t(
                    "كل عمود هو إيراد منتج داخل النطاق، مرتبة تنازليًا (أعلى 8).",
                    "Each column is one product's revenue inside the range, sorted descending (top 8)."
                  )}
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
                    <YAxis
                      width={52}
                      domain={[0, "auto"]}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value: number) => formatCompact(value)}
                    />
                    <ChartTooltip
                      cursor={{ fill: "var(--fill-soft)" }}
                      offset={8}
                      content={<ChartTooltipContent valueFormatter={(value) => money(Number(value))} />}
                    />
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
                value={
                  summary.data
                    ? formatAmount(summary.data.revenue_total, summary.data.revenue_currency ?? currency)
                    : "—"
                }
                meta={<bdi>{formatByCurrency(summary.data?.revenue_by_currency)}</bdi>}
              />
              <Kpi
                bare
                label={t("الطلبات المدفوعة", "Paid orders")}
                value={formatNumber(summary.data?.paid_orders ?? 0)}
              />
              <Kpi
                bare
                label={t("التسجيلات المجانية", "Free enrolments")}
                value={formatNumber(summary.data?.free_enrollments ?? 0)}
              />
              <Kpi
                bare
                label={t("الكوبونات المستخدمة", "Coupons used")}
                value={formatNumber(summary.data?.promotions_used ?? 0)}
              />
            </div>
          </Card>
        </div>

        <div className="ma-section-gap">
          <Card flush title={t("التفصيل اليومي", "Daily breakdown")}>
            <div className="ma-filter-bar" data-no-print>
              <Field
                id="report-day-search"
                label={t("بحث", "Search")}
                placeholder={t("بحث بالتاريخ (YYYY-MM-DD)…", "Search by date (YYYY-MM-DD)…")}
                value={search}
                onChange={setSearch}
              />
            </div>
            <DataTable
              columns={columns}
              rows={filteredDays}
              loading={report.isLoading}
              error={report.error}
              empty={t("لا بيانات في هذا النطاق.", "No data in this range.")}
            />
          </Card>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- products report

export function ProductsReportPage() {
  const t = useT();
  const initial = useMemo(() => defaultRange(90), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("all");
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const [start, end] = from <= to ? [from, to] : [to, from];
  const prev = useMemo(() => previousRange(start, end), [start, end]);

  const { currency, source } = useReportCurrency();
  const params = { start, end, report_currency: currency, source };
  const prevParams = { start: prev.from, end: prev.to, report_currency: currency, source };

  const money = (value: number) => formatAmount(value, currency);

  const result = useQuery({ queryKey: reportKeys.products(params), queryFn: () => productSalesReport(params) });
  const prevResult = useQuery({ queryKey: reportKeys.products(prevParams), queryFn: () => productSalesReport(prevParams) });

  const items = useMemo(() => result.data?.items ?? [], [result.data?.items]);
  const prevItems = useMemo(() => prevResult.data?.items ?? [], [prevResult.data?.items]);

  const totalRevenue = useMemo(() => items.reduce((sum, p) => sum + p.revenue, 0), [items]);
  const prevTotalRevenue = useMemo(() => prevItems.reduce((sum, p) => sum + p.revenue, 0), [prevItems]);

  const totalOrders = useMemo(() => items.reduce((sum, p) => sum + p.orders, 0), [items]);
  const prevTotalOrders = useMemo(() => prevItems.reduce((sum, p) => sum + p.orders, 0), [prevItems]);

  const totalUnits = useMemo(() => items.reduce((sum, p) => sum + (p.units ?? 0), 0), [items]);
  const prevTotalUnits = useMemo(() => prevItems.reduce((sum, p) => sum + (p.units ?? 0), 0), [prevItems]);

  const topProductsChart = useMemo(
    () =>
      [...items]
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 8)
        .map((row) => ({ ...chartRow(row), title: row.title ?? row.slug ?? "—" })),
    [items]
  );

  const chartConfig: ChartConfig = {
    revenue: { label: t("الإيراد", "Revenue"), color: "var(--teal)" },
  };

  const columns: Column<ProductSalesRow>[] = [
    {
      key: "title",
      header: t("المنتج", "Product"),
      sortable: true,
      sortValue: (row) => row.title ?? "",
      cell: (row) => <span className="ma-cell-main">{row.title ?? row.slug}</span>,
    },
    {
      key: "kind",
      header: t("النوع", "Kind"),
      sortable: true,
      sortValue: (row) => row.product_kind,
      cell: (row) => <span className="ma-badge ma-badge--neutral">{row.product_kind}</span>,
    },
    {
      key: "orders",
      header: t("الطلبات", "Orders"),
      align: "end",
      sortable: true,
      sortValue: (row) => row.orders,
      cell: (row) => <span className="ma-num">{formatNumber(row.orders)}</span>,
    },
    {
      key: "units",
      header: t("الوحدات", "Units"),
      align: "end",
      sortable: true,
      sortValue: (row) => row.units ?? 0,
      cell: (row) => <span className="ma-num">{formatNumber(row.units ?? 0)}</span>,
    },
    {
      key: "revenue",
      header: t("الإيراد", "Revenue"),
      align: "end",
      sortable: true,
      sortValue: (row) => row.revenue,
      cell: (row) => money(row.revenue),
    },
    {
      key: "original",
      header: t("بالعملة الأصلية", "Original currency"),
      cell: (row) => <bdi className="ma-cell-sub">{formatByCurrency(row.revenue_by_currency)}</bdi>,
    },
    {
      key: "promos",
      header: t("الكوبونات", "Promotions"),
      align: "end",
      sortable: true,
      sortValue: (row) => row.promotion_uses,
      cell: (row) => <span className="ma-num">{formatNumber(row.promotion_uses)}</span>,
    },
  ];

  const filteredItems = useMemo(() => {
    return items.filter((p) => {
      const matchKind = kindFilter === "all" || p.product_kind === kindFilter;
      if (!matchKind) return false;
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return (
        p.title?.toLowerCase().includes(q) ||
        (p.slug ? p.slug.toLowerCase().includes(q) : false) ||
        p.product_kind?.toLowerCase().includes(q)
      );
    });
  }, [items, search, kindFilter]);

  const uniqueKinds = useMemo(() => {
    const set = new Set(items.map((i) => i.product_kind).filter(Boolean));
    return Array.from(set);
  }, [items]);

  const handleExportCsv = (format: "csv" | "xlsx" | "pdf" = "csv") => {
    const headers = [
      t("المنتج", "Product"),
      t("النوع", "Kind"),
      t("الطلبات", "Orders"),
      t("الوحدات", "Units Sold"),
      t("الإيراد", "Revenue"),
      t("عملة التقرير", "Report Currency"),
      t("العملات الأصلية", "Original Currencies"),
      t("مرات استخدام الكوبونات", "Promotion Uses"),
    ];

    const rows = filteredItems.map((p) => [
      p.title ?? p.slug ?? "—",
      p.product_kind,
      p.orders,
      p.units ?? 0,
      p.revenue,
      currency,
      formatByCurrency(p.revenue_by_currency),
      p.promotion_uses,
    ]);

    rows.push([
      t("الإجمالي", "Total"),
      "—",
      totalOrders,
      totalUnits,
      totalRevenue,
      currency,
      "—",
      "—",
    ]);

    return exportTabular(format, `products-report-${start}-to-${end}.csv`, headers, rows);
  };

  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      await handleExportCsv("pdf");
    } finally {
      setIsExportingPdf(false);
    }
  };

  const error = result.error ?? prevResult.error;

  return (
    <>
      <PageHead
        title={t("تقرير المنتجات", "Products report")}
        sub={t("مبيعات منتجات B2C وتحليل الإيرادات والكميات المباعة ومقارنتها.", "B2C product sales, units sold, and revenue performance.")}
        actions={
          <>
            <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
            <CurrencySelect />
            <ExportActions
              onExportCsv={() => handleExportCsv()}
              onExportExcel={() => handleExportCsv("xlsx")}
              onExportPdf={handleExportPdf}
              isExportingPdf={isExportingPdf}
              disabled={result.isLoading}
            />
          </>
        }
      />

      <div id="analytics-products-content">
        {error ? <ErrorAlert error={error} title={t("تعذّر تحميل تقرير المنتجات", "Couldn't load products report")} /> : null}

        <div className="ma-cols ma-cols--4">
          <Kpi
            label={t("إجمالي إيراد المنتجات", "Total product revenue")}
            value={money(totalRevenue)}
            delta={percentDelta(totalRevenue, prevTotalRevenue)}
            icon="chart"
            field="var(--teal)"
          />
          <Kpi
            label={t("الوحدات المباعة", "Units sold")}
            value={formatNumber(totalUnits)}
            delta={percentDelta(totalUnits, prevTotalUnits)}
            icon="book"
            field="var(--coral)"
          />
          <Kpi
            label={t("الطلبات", "Orders")}
            value={formatNumber(totalOrders)}
            delta={percentDelta(totalOrders, prevTotalOrders)}
            icon="cart"
            field="var(--yellow)"
          />
          <Kpi
            label={t("المنتجات المباعة", "Products sold")}
            value={formatNumber(items.length)}
            icon="tag"
            field="var(--purple)"
          />
        </div>

        <div className="ma-section-gap">
          <FxNote fx={result.data?.fx} />
        </div>

        <div className="ma-section-gap">
          <Card
            title={
              <span className="ma-chart-title">
                {t("المنتجات الأكثر مبيعًا حسب الإيراد", "Top products by revenue")}
                <InfoHint label={t("ما معنى هذا الرسم؟", "What does this chart show?")} title={t("المنتجات الأكثر مبيعًا", "Top products")}>
                  {t(
                    "أعلى 8 منتجات تحقيقًا للإيرادات في النطاق الزمني المحدد.",
                    "Top 8 products by revenue within the selected date range."
                  )}
                </InfoHint>
              </span>
            }
          >
            <PageState error={result.error}>
              {topProductsChart.length ? (
                <ChartContainer config={chartConfig} className="h-[280px] w-full" dir="ltr">
                  <BarChart data={topProductsChart} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="title"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      interval={0}
                      tickFormatter={(value: string) => (value.length > 18 ? `${value.slice(0, 18)}…` : value)}
                    />
                    <YAxis
                      width={56}
                      domain={[0, "auto"]}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value: number) => formatCompact(value)}
                    />
                    <ChartTooltip
                      cursor={{ fill: "var(--fill-soft)" }}
                      offset={8}
                      content={<ChartTooltipContent valueFormatter={(value) => money(Number(value))} />}
                    />
                    <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} maxBarSize={48} />
                  </BarChart>
                </ChartContainer>
              ) : result.isLoading ? (
                <Loading />
              ) : (
                <Empty text={t("لا مبيعات منتجات في هذا النطاق.", "No product sales in this range.")} />
              )}
            </PageState>
          </Card>
        </div>

        <div className="ma-section-gap">
          <Card flush title={t("تفاصيل مبيعات المنتجات", "Product sales breakdown")}>
            <div className="ma-filter-bar" data-no-print>
              <Field
                id="product-report-search"
                label={t("بحث", "Search")}
                placeholder={t("بحث باسم المنتج أو المعرّف…", "Search product name or slug…")}
                value={search}
                onChange={setSearch}
              />
              {uniqueKinds.length > 1 ? (
                <Field
                  id="product-kind-filter"
                  label={t("النوع", "Kind")}
                  options={[
                    ["all", t("كل الأنواع", "All kinds")],
                    ...uniqueKinds.map((k) => [k, k] as [string, string]),
                  ]}
                  value={kindFilter}
                  onChange={setKindFilter}
                />
              ) : null}
            </div>
            <DataTable
              columns={columns}
              rows={filteredItems}
              loading={result.isLoading}
              error={result.error}
              initialSort={{ key: "revenue", dir: "desc" }}
              empty={t("لا مبيعات مطابقة في هذا النطاق.", "No matching product sales in this range.")}
            />
          </Card>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- generic report frame

function ReportFrame({
  title,
  sub,
  fx,
  dateRange,
  onExportCsv,
  onExportExcel,
  onExportPdf,
  isExportingPdf,
  contentId,
  children,
}: {
  title: string;
  sub: string;
  fx?: FxInfo;
  dateRange?: { from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void };
  onExportCsv?: () => void;
  onExportExcel?: () => void;
  onExportPdf?: () => Promise<void>;
  isExportingPdf?: boolean;
  contentId?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <PageHead
        title={title}
        sub={sub}
        actions={
          <>
            {dateRange && (
              <DateRange
                from={dateRange.from}
                to={dateRange.to}
                onFrom={dateRange.onFrom}
                onTo={dateRange.onTo}
              />
            )}
            <CurrencySelect />
            {(onExportCsv || onExportPdf) && (
              <ExportActions
                onExportCsv={onExportCsv}
                onExportExcel={onExportExcel}
                onExportPdf={onExportPdf}
                isExportingPdf={isExportingPdf}
              />
            )}
          </>
        }
      />
      <div id={contentId}>
        <FxNote fx={fx} />
        <Card flush>{children}</Card>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- promotions report

export function CouponsReportPage() {
  const t = useT();
  const initial = useMemo(() => defaultRange(90), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [search, setSearch] = useState("");
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const [start, end] = from <= to ? [from, to] : [to, from];
  const { currency, source } = useReportCurrency();
  const params = { start, end, report_currency: currency, source };
  const money = (value: number) => formatAmount(value, currency);

  const result = useQuery({ queryKey: reportKeys.promotions(params), queryFn: () => promotionsReport(params) });

  const columns: Column<PromotionSalesRow>[] = [
    { key: "code", header: t("الكود", "Code"), sortable: true, sortValue: (row) => row.code ?? "", cell: (row) => <bdi className="ma-cell-main">{row.code ?? "—"}</bdi> },
    { key: "type", header: t("النوع", "Type"), cell: (row) => row.promotion_type ?? "—" },
    { key: "uses", header: t("مرات الاستخدام", "Uses"), align: "end", sortable: true, sortValue: (row) => row.uses, cell: (row) => <span className="ma-num">{formatNumber(row.uses)}</span> },
    { key: "discount", header: t("الخصم", "Discount"), align: "end", sortable: true, sortValue: (row) => row.discount, cell: (row) => money(row.discount) },
    { key: "revenue", header: t("الإيراد", "Revenue"), align: "end", sortable: true, sortValue: (row) => row.revenue, cell: (row) => money(row.revenue) },
  ];

  const items = useMemo(() => result.data?.items ?? [], [result.data?.items]);
  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.trim().toLowerCase();
    return items.filter((p) => p.code?.toLowerCase().includes(q));
  }, [items, search]);

  const handleExportCsv = (format: "csv" | "xlsx" | "pdf" = "csv") => {
    const headers = [
      t("الكود", "Code"),
      t("النوع", "Type"),
      t("مرات الاستخدام", "Uses"),
      t("الخصم", "Discount"),
      t("الإيراد", "Revenue"),
    ];
    const rows = filteredItems.map((p) => [
      p.code ?? "—",
      p.promotion_type ?? "—",
      p.uses,
      p.discount,
      p.revenue,
    ]);
    return exportTabular(format, `coupons-report-${start}-to-${end}.csv`, headers, rows);
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
    <ReportFrame
      title={t("تقرير الكوبونات", "Coupons report")}
      sub={t("أداء أكواد الخصم على طلبات B2C المدفوعة.", "Promotion codes applied to paid B2C orders.")}
      fx={result.data?.fx}
      dateRange={{ from, to, onFrom: setFrom, onTo: setTo }}
      onExportCsv={() => handleExportCsv()}
              onExportExcel={() => handleExportCsv("xlsx")}
      onExportPdf={handleExportPdf}
      isExportingPdf={isExportingPdf}
      contentId="analytics-coupons-content"
    >
      <div className="ma-filter-bar" data-no-print>
        <Field
          id="coupon-report-search"
          label={t("بحث", "Search")}
          placeholder={t("بحث بكود الخصم…", "Search promo code…")}
          value={search}
          onChange={setSearch}
        />
      </div>
      <DataTable
        columns={columns}
        rows={filteredItems}
        loading={result.isLoading}
        error={result.error}
        initialSort={{ key: "uses", dir: "desc" }}
        empty={t("لم تُستخدم أكواد خصم في هذه الفترة.", "No promotion codes used in this period.")}
      />
    </ReportFrame>
  );
}

// ---------------------------------------------------------------- customers report

export function CustomersReportPage() {
  const t = useT();
  const initial = useMemo(() => defaultRange(90), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [search, setSearch] = useState("");
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const [start, end] = from <= to ? [from, to] : [to, from];
  const { currency, source } = useReportCurrency();
  const params = { start, end, report_currency: currency, source, limit: 100 };
  const money = (value: number) => formatAmount(value, currency);

  const result = useQuery({ queryKey: reportKeys.customers(params), queryFn: () => customersReport(params) });

  const columns: Column<CustomerSalesRow>[] = [
    {
      key: "customer",
      header: t("العميل", "Customer"),
      sortable: true,
      sortValue: (row) => row.email ?? "",
      cell: (row) => (
        <>
          <span className="ma-cell-main"><bdi>{row.full_name ?? row.email}</bdi></span>
          <span className="ma-cell-sub"><bdi>{row.email}</bdi></span>
        </>
      ),
    },
    { key: "orders", header: t("الطلبات", "Orders"), align: "end", sortable: true, sortValue: (row) => row.orders, cell: (row) => <span className="ma-num">{formatNumber(row.orders)}</span> },
    { key: "revenue", header: t("الإيراد", "Revenue"), align: "end", sortable: true, sortValue: (row) => row.revenue, cell: (row) => money(row.revenue) },
    { key: "original", header: t("بالعملة الأصلية", "Original currency"), cell: (row) => <bdi className="ma-cell-sub">{formatByCurrency(row.revenue_by_currency)}</bdi> },
    { key: "last", header: t("آخر شراء", "Last purchase"), sortable: true, sortValue: (row) => row.last_purchase_at ?? "", cell: (row) => formatDateTime(row.last_purchase_at) },
  ];

  const items = useMemo(() => result.data?.items ?? [], [result.data?.items]);
  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.trim().toLowerCase();
    return items.filter((c) => c.email?.toLowerCase().includes(q) || c.full_name?.toLowerCase().includes(q));
  }, [items, search]);

  const handleExportCsv = (format: "csv" | "xlsx" | "pdf" = "csv") => {
    const headers = [
      t("اسم العميل", "Customer Name"),
      t("البريد الإلكتروني", "Email"),
      t("الطلبات", "Orders"),
      t("الإيراد", "Revenue"),
      t("آخر شراء", "Last Purchase"),
    ];
    const rows = filteredItems.map((c) => [
      c.full_name ?? "",
      c.email ?? "",
      c.orders,
      c.revenue,
      c.last_purchase_at ?? "",
    ]);
    return exportTabular(format, `customers-report-${start}-to-${end}.csv`, headers, rows);
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
    <ReportFrame
      title={t("تقرير العملاء", "Customers report")}
      sub={t("أعلى 100 عميل إنفاقًا خلال الفترة المحددة.", "Top 100 customers by spend in the selected date range.")}
      fx={result.data?.fx}
      dateRange={{ from, to, onFrom: setFrom, onTo: setTo }}
      onExportCsv={() => handleExportCsv()}
              onExportExcel={() => handleExportCsv("xlsx")}
      onExportPdf={handleExportPdf}
      isExportingPdf={isExportingPdf}
      contentId="analytics-customers-content"
    >
      <div className="ma-filter-bar" data-no-print>
        <Field
          id="customer-report-search"
          label={t("بحث", "Search")}
          placeholder={t("بحث بالبريد أو الاسم…", "Search email or name…")}
          value={search}
          onChange={setSearch}
        />
      </div>
      <DataTable
        columns={columns}
        rows={filteredItems}
        loading={result.isLoading}
        error={result.error}
        initialSort={{ key: "revenue", dir: "desc" }}
        empty={t("لا مشتريات في هذه الفترة.", "No purchases in this period.")}
      />
    </ReportFrame>
  );
}

// ---------------------------------------------------------------- categories report

export function CategoriesReportPage() {
  const t = useT();
  const initial = useMemo(() => defaultRange(90), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [search, setSearch] = useState("");
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const [start, end] = from <= to ? [from, to] : [to, from];
  const { currency, source } = useReportCurrency();
  const params = { start, end, report_currency: currency, source };
  const money = (value: number) => formatAmount(value, currency);

  const result = useQuery({ queryKey: reportKeys.categories(params), queryFn: () => categoriesReport(params) });

  const columns: Column<CategorySalesRow>[] = [
    { key: "name", header: t("التصنيف", "Category"), sortable: true, sortValue: (row) => row.name ?? "", cell: (row) => <span className="ma-cell-main">{row.name ?? row.slug}</span> },
    { key: "orders", header: t("الطلبات", "Orders"), align: "end", sortable: true, sortValue: (row) => row.orders, cell: (row) => <span className="ma-num">{formatNumber(row.orders)}</span> },
    { key: "units", header: t("الوحدات", "Units"), align: "end", sortable: true, sortValue: (row) => row.units, cell: (row) => <span className="ma-num">{formatNumber(row.units)}</span> },
    { key: "revenue", header: t("الإيراد", "Revenue"), align: "end", sortable: true, sortValue: (row) => row.revenue, cell: (row) => money(row.revenue) },
    { key: "original", header: t("بالعملة الأصلية", "Original currency"), cell: (row) => <bdi className="ma-cell-sub">{formatByCurrency(row.revenue_by_currency)}</bdi> },
  ];

  const items = useMemo(() => result.data?.items ?? [], [result.data?.items]);
  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.trim().toLowerCase();
    return items.filter((c) => c.name?.toLowerCase().includes(q) || (c.slug ? c.slug.toLowerCase().includes(q) : false));
  }, [items, search]);

  const handleExportCsv = (format: "csv" | "xlsx" | "pdf" = "csv") => {
    const headers = [
      t("التصنيف", "Category"),
      t("الطلبات", "Orders"),
      t("الوحدات", "Units"),
      t("الإيراد", "Revenue"),
    ];
    const rows = filteredItems.map((c) => [
      c.name ?? c.slug ?? "—",
      c.orders,
      c.units,
      c.revenue,
    ]);
    return exportTabular(format, `categories-report-${start}-to-${end}.csv`, headers, rows);
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
    <ReportFrame
      title={t("تقرير التصنيفات", "Categories report")}
      sub={t("مبيعات B2C لكل تصنيف (المنتج في عدة تصنيفات يُحسب في كلٍّ منها).", "B2C sales per category (a product in several categories counts in each).")}
      fx={result.data?.fx}
      dateRange={{ from, to, onFrom: setFrom, onTo: setTo }}
      onExportCsv={() => handleExportCsv()}
              onExportExcel={() => handleExportCsv("xlsx")}
      onExportPdf={handleExportPdf}
      isExportingPdf={isExportingPdf}
      contentId="analytics-categories-content"
    >
      <div className="ma-filter-bar" data-no-print>
        <Field
          id="cat-report-search"
          label={t("بحث", "Search")}
          placeholder={t("بحث باسم التصنيف…", "Search category name…")}
          value={search}
          onChange={setSearch}
        />
      </div>
      <DataTable
        columns={columns}
        rows={filteredItems}
        loading={result.isLoading}
        error={result.error}
        initialSort={{ key: "revenue", dir: "desc" }}
        empty={t("لا مبيعات في هذه الفترة.", "No sales in this period.")}
      />
    </ReportFrame>
  );
}
