import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Empty, ErrorAlert, Loading } from "@/components/ui/kit";
import { Icon } from "@/components/ui/icon";
import { formatAmount, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import {
  productQueries,
  type ProductBehaviorPoint,
  type ProductBehaviorStats,
  type ProductSalesPoint,
  type ProductSalesSeries,
  type ProductTransactionPoint,
  type ProductTransactions,
} from "@/lib/api";

type PresetRange = "30" | "90" | "365" | "all";
type Bucket = "day" | "week" | "month";
type TFn = (ar: string, en: string) => string;

const SERIES = ["var(--series-1, #2563eb)", "var(--series-2, #10b981)", "var(--series-3, #f59e0b)", "var(--series-4, #ef4444)"];

/** Range + granularity for the panels. `bucket` defaults from the preset but the user can override it. */
function defaultBucket(preset: PresetRange): Bucket {
  if (preset === "30") return "day";
  if (preset === "90") return "week";
  return "month";
}

function computeRange(preset: PresetRange, bucket: Bucket): { start?: string; end?: string; bucket: Bucket } {
  const now = new Date();
  const toDay = (d: Date) => d.toISOString().slice(0, 10);
  const end = toDay(now);
  if (preset === "30") return { start: toDay(new Date(now.getTime() - 29 * 86_400_000)), end, bucket };
  if (preset === "90") return { start: toDay(new Date(now.getTime() - 89 * 86_400_000)), end, bucket };
  if (preset === "365") return { start: toDay(new Date(now.getTime() - 364 * 86_400_000)), end, bucket };
  return { bucket };
}

const CHART_STYLE = {
  grid: "var(--line)",
  axis: "var(--text-muted)",
  line: "var(--line)",
} as const;

export function ProductStatsPanels({ productRef }: { productRef: string }) {
  const t = useT();
  const [preset, setPreset] = useState<PresetRange>("365");
  const [bucket, setBucket] = useState<Bucket>(defaultBucket("365"));

  const onPreset = (next: PresetRange) => {
    setPreset(next);
    setBucket(defaultBucket(next));
  };

  const range = useMemo(() => computeRange(preset, bucket), [preset, bucket]);
  const baseParams = useMemo(
    () => ({ bucket: range.bucket, ...(range.start ? { start: range.start } : {}), ...(range.end ? { end: range.end } : {}) }),
    [range],
  );

  const salesQuery = useQuery(productQueries.sales(productRef, baseParams));
  const behaviorQuery = useQuery(productQueries.behavior(productRef, baseParams));
  const transactionsQuery = useQuery(productQueries.transactions(productRef, { ...baseParams, limit: 6, offset: 0 }));

  const sales = salesQuery.data;
  const behavior = behaviorQuery.data;
  const transactions = transactionsQuery.data;

  const rangeControls = (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
      <div className="cd-seg" role="group" aria-label={t("الفترة", "Period")}>
        {(["30", "90", "365", "all"] as const).map((value) => (
          <button key={value} type="button" aria-pressed={preset === value} onClick={() => onPreset(value)}>
            {value === "30" ? "30d" : value === "90" ? "90d" : value === "365" ? "12m" : t("الكل", "All")}
          </button>
        ))}
      </div>
      <div className="cd-seg" role="group" aria-label={t("التجميع", "Granularity")}>
        {(["day", "week", "month"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={bucket === value}
            style={{ width: "auto", paddingInline: 10 }}
            onClick={() => setBucket(value)}
          >
            {value === "day" ? t("يوم", "Day") : value === "week" ? t("أسبوع", "Week") : t("شهر", "Month")}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="cd-kpi-host">
        <div className="cd-kpi-grid">
          <MetricCard icon="eye" label={t("المشاهدات", "Views")} value={behavior?.views} loading={behaviorQuery.isLoading} />
          <MetricCard icon="users" label={t("زوار مميزون", "Unique viewers")} value={behavior?.unique_viewers} loading={behaviorQuery.isLoading} />
          <MetricCard icon="star" label={t("أُضيف للمفضلة", "Wishlist adds")} value={behavior?.wishlist_adds} loading={behaviorQuery.isLoading} />
          <MetricCard icon="cart" label={t("أُضيف للسلة", "Cart adds")} value={behavior?.cart_adds} loading={behaviorQuery.isLoading} />
          <MetricCard icon="receipt" label={t("طلبات مدفوعة", "Paid orders")} value={sales?.total_paid_orders} loading={salesQuery.isLoading} />
          <MetricCard icon="tag" label={t("الإيراد", "Revenue")} money={revenueOf(sales)} loading={salesQuery.isLoading} />
  </div>
      </div>

      <section className="cd-card">
        <div className="cd-card__h" style={{ flexWrap: "wrap", gap: 16, paddingBlockEnd: 12 }}>
          <h2>
            <Icon name="chart" className="cd-ic--sm" />
            {t("نظرة السلوك والأداء", "Behaviour & performance")}
          </h2>
          {rangeControls}
        </div>
        <div className="cd-card__b cd-chart-host">
          <div className="cd-chart-grid">
            <div>
              <PanelTitle t={t} titleAr="قمع التحويل" titleEn="Conversion funnel" info={PANEL_INFO.funnel} />
              <FunnelChart behavior={behavior} sales={sales} loading={behaviorQuery.isLoading || salesQuery.isLoading} error={behaviorQuery.error ?? salesQuery.error} t={t} />
            </div>
            <div>
              <PanelTitle t={t} titleAr="تاريخ الطلبات" titleEn="Orders history" info={PANEL_INFO.orders} />
              <OrdersHistoryChart sales={sales} loading={salesQuery.isLoading} error={salesQuery.error} t={t} />
            </div>
            <div>
              <PanelTitle t={t} titleAr="حركة المشاهدات والسلة" titleEn="Views, wishlist & cart" info={PANEL_INFO.behavior} />
              <BehaviorTrendChart behavior={behavior} loading={behaviorQuery.isLoading} error={behaviorQuery.error} t={t} />
            </div>
            <div>
              <PanelTitle t={t} titleAr="تاريخ المبيعات" titleEn="Sales history" info={PANEL_INFO.sales} />
              <SalesHistoryChart sales={sales} loading={salesQuery.isLoading} error={salesQuery.error} t={t} />
            </div>
            <div>
              <PanelTitle t={t} titleAr="الحركات الدفعية" titleEn="Payment transactions" info={PANEL_INFO.transactions} />
              <TransactionsChart transactions={transactions} loading={transactionsQuery.isLoading} error={transactionsQuery.error} t={t} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function revenueOf(sales: ProductSalesSeries | undefined): { amount: number; currency: string } | null {
  const revenue = sales?.revenue ?? {};
  const currency = Object.keys(revenue)[0];
  if (!currency) return null;
  return { amount: revenue[currency], currency };
}

function PanelTitle({
  t,
  titleAr,
  titleEn,
  info,
}: {
  t: TFn;
  titleAr: string;
  titleEn: string;
  info: { ar: string; en: string; axesAr: [string, string][]; axesEn: [string, string][]; noteAr?: string; noteEn?: string };
}) {
  return (
    <div className="cd-panel-title">
      <span>{t(titleAr, titleEn)}</span>
      <InfoTip
        intro={t(info.ar, info.en)}
        axes={info.axesAr.map((pair, index) => ({ axis: t(pair[0], info.axesEn[index][0]), meaning: t(pair[1], info.axesEn[index][1]) }))}
        note={info.noteAr ? t(info.noteAr, info.noteEn ?? "") : undefined}
      />
    </div>
  );
}

const PANEL_INFO = {
  funnel: {
    ar: "عدد الناس في كل خطوة من رحلة الشراء، من أول مشاهدة حتى طلب مدفوع.",
    en: "How many people reach each step of the buying journey, from first view to a paid order.",
    axesAr: [["المحور الأفقي", "العدد"], ["المحور الرأسي", "الخطوة: مشاهدة ← مفضلة ← سلة ← مدفوع"]] as [string, string][],
    axesEn: [["X axis", "Count"], ["Y axis", "Step: viewed → wishlist → cart → paid"]] as [string, string][],
  },
  orders: {
    ar: "تاريخ الطلبات على المنتج: كم طلبًا وكم منها مدفوع في كل فترة، مع تراكم الطلاب.",
    en: "Orders over time: how many orders and how many were paid per period, with cumulative students.",
    axesAr: [["المحور الأفقي", "الفترة (يوم / أسبوع / شهر)"], ["المحور الرأسي", "عدد الطلبات والطلاب التراكمي"]] as [string, string][],
    axesEn: [["X axis", "Period (day / week / month)"], ["Y axis", "Order count and cumulative students"]] as [string, string][],
  },
  behavior: {
    ar: "حركة المشاهدات وإضافة المنتج للمفضلة أو السلة عبر الزمن.",
    en: "Views and add-to-wishlist / add-to-cart actions over time.",
    axesAr: [["المحور الأفقي", "الفترة (يوم / أسبوع / شهر)"], ["المحور الرأسي", "عدد الأحداث"]] as [string, string][],
    axesEn: [["X axis", "Period (day / week / month)"], ["Y axis", "Event count"]] as [string, string][],
    noteAr: "الأعداد تقديرية لأنها تخضع لنسبة العيّنة في الخدمة.",
    noteEn: "Counts are sampled upstream, so treat them as estimates.",
  },
  sales: {
    ar: "الإيراد المحقّق من المنتج في كل فترة، لكل عملة على حدة.",
    en: "Revenue booked for the product per period, shown per currency.",
    axesAr: [["المحور الأفقي", "الفترة (يوم / أسبوع / شهر)"], ["المحور الرأسي", "الإيراد بالعملة"]] as [string, string][],
    axesEn: [["X axis", "Period (day / week / month)"], ["Y axis", "Revenue in currency"]] as [string, string][],
  },
  transactions: {
    ar: "حركات الدفع على طلبات المنتج: ناجحة وفاشلة، والمبلغ المُحصّل في كل فترة.",
    en: "Payment attempts on the product's orders: succeeded and failed, and money collected per period.",
    axesAr: [["المحور الأفقي", "الفترة (يوم / أسبوع / شهر)"], ["المحور الرأسي الأيسر", "عدد الحركات"], ["المحور الرأسي الأيمن", "المبلغ المُحصّل"]] as [string, string][],
    axesEn: [["X axis", "Period (day / week / month)"], ["Left Y axis", "Attempt count"], ["Right Y axis", "Amount collected"]] as [string, string][],
    noteAr: "المبلغ يحسب الحركات الناجحة فقط؛ لا تتوفر حركات الدفع لطلبات النظام القديم.",
    noteEn: "Amount covers succeeded attempts only; legacy orders have no payment attempts.",
  },
};

function MetricCard({
  icon,
  label,
  value,
  money,
  loading,
}: {
  icon: string;
  label: string;
  value?: number;
  money?: { amount: number; currency: string } | null;
  loading: boolean;
}) {
  return (
    <div className="cd-card cd-stat-kpi">
      <div className="cd-stat-kpi__label">
        <Icon name={icon} className="cd-ic--sm" />
        <span>{label}</span>
      </div>
      <div className="cd-num cd-stat-kpi__value">
        {loading ? "…" : money ? formatAmount(money.amount, money.currency) : formatNumber(value ?? 0)}
      </div>
    </div>
  );
}

/**
 * The "i" affordance beside a chart title. Hovering or keyboard-focusing it reveals what the chart
 * shows and what each axis means, so the numbers are readable without guessing.
 */
function InfoTip({
  intro,
  axes,
  note,
}: {
  intro: string;
  axes: { axis: string; meaning: string }[];
  note?: string;
}) {
  return (
    <span className="cd-info" tabIndex={0} role="button" aria-label={intro}>
      i
      <span className="cd-info__tip" role="tooltip">
        {intro}
        <dl>
          {axes.map((item) => (
            <div key={item.axis} style={{ display: "contents" }}>
              <dt>{item.axis}</dt>
              <dd>{item.meaning}</dd>
            </div>
          ))}
        </dl>
        {note ? <div style={{ marginBlockStart: 6 }}>{note}</div> : null}
      </span>
    </span>
  );
}

function ChartFrame({
  loading,
  error,
  empty,
  children,
  height = 220,
}: {
  loading: boolean;
  error?: unknown;
  empty: boolean;
  children: React.ReactNode;
  height?: number;
}) {
  if (loading && empty) {
    return (
      <div style={{ height, display: "grid", placeItems: "center" }}>
        <Loading />
      </div>
    );
  }
  if (error) return <ErrorAlert error={error} />;
  if (empty) {
    return (
      <div style={{ height, display: "flex" }}>
        <Empty icon="chart" text="—" />
      </div>
    );
  }
  return (
    <div style={{ height, width: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  );
}

const AXIS = { stroke: CHART_STYLE.axis, fontSize: 11, tickLine: false } as const;

function FunnelChart({
  behavior,
  sales,
  loading,
  error,
  t,
}: {
  behavior?: ProductBehaviorStats;
  sales?: ProductSalesSeries;
  loading: boolean;
  error: unknown;
  t: TFn;
}) {
  const data = [
    { label: t("مشاهدة", "Viewed"), value: behavior?.views ?? 0 },
    { label: t("مفضلة", "Wishlist"), value: behavior?.wishlist_adds ?? 0 },
    { label: t("سلة", "Cart"), value: behavior?.cart_adds ?? 0 },
    { label: t("مدفوع", "Paid"), value: sales?.total_paid_orders ?? 0 },
  ];
  const empty = data.every((d) => d.value === 0);
  return (
    <ChartFrame loading={loading} error={error} empty={empty}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
        <CartesianGrid stroke={CHART_STYLE.grid} strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" allowDecimals={false} {...AXIS} axisLine={{ stroke: CHART_STYLE.line }} />
        <YAxis type="category" dataKey="label" width={70} {...AXIS} axisLine={false} />
        <Tooltip content={<SimpleTooltip t={t} />} />
        <Bar dataKey="value" name={t("العدد", "Count")} fill={SERIES[0]} radius={[0, 4, 4, 0]} maxBarSize={26} />
      </BarChart>
    </ChartFrame>
  );
}

function OrdersHistoryChart({
  sales,
  loading,
  error,
  t,
}: {
  sales?: ProductSalesSeries;
  loading: boolean;
  error: unknown;
  t: TFn;
}) {
  const data = useMemo(() => {
    const points = sales?.points ?? [];
    const rows: Array<ProductSalesPoint & { cumulative_students: number }> = [];
    let running = sales?.students_before_start ?? 0;
    for (const point of points) {
      running += point.new_students || 0;
      rows.push({ ...point, cumulative_students: running });
    }
    return rows;
  }, [sales]);
  return (
    <ChartFrame loading={loading} error={error} empty={!data.length}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
        <CartesianGrid stroke={CHART_STYLE.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="period" {...AXIS} axisLine={{ stroke: CHART_STYLE.line }} />
        <YAxis allowDecimals={false} {...AXIS} axisLine={false} />
        <Tooltip content={<SalesTooltip t={t} />} />
        <Bar dataKey="orders" name={t("طلبات", "Orders")} fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="paid_orders" name={t("مدفوع", "Paid")} fill={SERIES[1]} radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Line type="monotone" dataKey="cumulative_students" name={t("طلاب تراكمي", "Cumulative students")} stroke={SERIES[2]} strokeWidth={2.5} dot={false} />
      </ComposedChart>
    </ChartFrame>
  );
}

function BehaviorTrendChart({
  behavior,
  loading,
  error,
  t,
}: {
  behavior?: ProductBehaviorStats;
  loading: boolean;
  error: unknown;
  t: TFn;
}) {
  const data = behavior?.points ?? [];
  return (
    <ChartFrame loading={loading} error={error} empty={!data.length}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
        <CartesianGrid stroke={CHART_STYLE.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="period" {...AXIS} axisLine={{ stroke: CHART_STYLE.line }} />
        <YAxis allowDecimals={false} {...AXIS} axisLine={false} />
        <Tooltip content={<BehaviorTooltip t={t} />} />
        <Line type="monotone" dataKey="views" name={t("مشاهدات", "Views")} stroke={SERIES[0]} strokeWidth={2.5} dot={false} />
        <Line type="monotone" dataKey="cart_adds" name={t("سلة", "Cart")} stroke={SERIES[1]} strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="wishlist_adds" name={t("مفضلة", "Wishlist")} stroke={SERIES[3]} strokeWidth={2} dot={false} />
      </ComposedChart>
    </ChartFrame>
  );
}

function SalesHistoryChart({
  sales,
  loading,
  error,
  t,
}: {
  sales?: ProductSalesSeries;
  loading: boolean;
  error: unknown;
  t: TFn;
}) {
  const { data, currencies } = useMemo(() => {
    const points = sales?.points ?? [];
    const found = new Set<string>();
    const rows = points.map((pt) => {
      const revenue = pt.revenue ?? {};
      const keys = Object.keys(revenue);
      keys.forEach((key) => found.add(key));
      return { period: pt.period, ...revenue };
    });
    return { data: rows, currencies: Array.from(found) };
  }, [sales]);
  return (
    <ChartFrame loading={loading} error={error} empty={!data.length}>
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
        <CartesianGrid stroke={CHART_STYLE.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="period" {...AXIS} axisLine={{ stroke: CHART_STYLE.line }} />
        <YAxis {...AXIS} axisLine={false} />
        <Tooltip content={<CurrencyTooltip t={t} />} />
        {currencies.map((currency, index) => (
          <Area
            key={currency}
            type="monotone"
            dataKey={currency}
            name={currency}
            stroke={SERIES[index % SERIES.length]}
            fill={SERIES[index % SERIES.length]}
            fillOpacity={0.18}
            strokeWidth={2}
          />
        ))}
      </AreaChart>
    </ChartFrame>
  );
}

function TransactionsChart({
  transactions,
  loading,
  error,
  t,
}: {
  transactions?: ProductTransactions;
  loading: boolean;
  error: unknown;
  t: TFn;
}) {
  const { data, currency } = useMemo(() => {
    const points = transactions?.points ?? [];
    const found = new Set<string>();
    const rows = points.map((pt: ProductTransactionPoint) => {
      const amount = pt.amount ?? {};
      Object.keys(amount).forEach((key) => found.add(key));
      const primary = Object.keys(amount)[0];
      return {
        period: pt.period,
        transactions: pt.transactions,
        paid: pt.paid,
        failed: pt.failed,
        amount: primary ? amount[primary] : 0,
      };
    });
    return { data: rows, currency: Array.from(found)[0] };
  }, [transactions]);
  return (
    <ChartFrame loading={loading} error={error} empty={!data.length}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
        <CartesianGrid stroke={CHART_STYLE.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="period" {...AXIS} axisLine={{ stroke: CHART_STYLE.line }} />
        <YAxis yAxisId="count" allowDecimals={false} {...AXIS} axisLine={false} />
        <YAxis yAxisId="amount" orientation="right" {...AXIS} axisLine={false} />
        <Tooltip content={<CurrencyTooltip t={t} moneyKey="amount" currency={currency} />} />
        <Bar yAxisId="count" dataKey="paid" name={t("ناجحة", "Succeeded")} stackId="tx" fill={SERIES[1]} radius={[0, 0, 0, 0]} maxBarSize={28} />
        <Bar yAxisId="count" dataKey="failed" name={t("فاشلة", "Failed")} stackId="tx" fill={SERIES[3]} radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Line yAxisId="amount" type="monotone" dataKey="amount" name={t("المبلغ", "Amount")} stroke={SERIES[0]} strokeWidth={2.5} dot={false} />
      </ComposedChart>
    </ChartFrame>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */

function tooltipShell(rows: React.ReactNode, heading: React.ReactNode) {
  return (
    <div
      style={{
        background: "var(--surface)",
        color: "var(--text)",
        border: "1px solid var(--line-strong)",
        borderRadius: "var(--radius-control)",
        padding: "10px 14px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        fontSize: 13,
        minWidth: 170,
      }}
    >
      <div style={{ fontWeight: 700, marginBlockEnd: 6, borderBottom: "1px solid var(--line)", paddingBottom: 4 }}>{heading}</div>
      {rows}
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBlock: 2 }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="cd-num" style={{ fontWeight: 600 }}>
        {value}
      </span>
    </div>
  );
}

function metricRows(t: TFn, data: any, keys: { key: string; ar: string; en: string }[]) {
  return keys.map((k) => <MetricRow key={k.key} label={t(k.ar, k.en)} value={formatNumber(data?.[k.key] ?? 0)} />);
}

function SimpleTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const rows = payload.map((entry: any, index: number) => (
    <MetricRow key={index} label={String(entry.name ?? "")} value={formatNumber(Number(entry.value ?? 0))} />
  ));
  return tooltipShell(rows, payload[0]?.payload?.label ?? "");
}

function SalesTooltip({ active, payload, t }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload as ProductSalesPoint & { cumulative_students?: number };
  const currencies = Object.keys(data.revenue ?? {});
  return tooltipShell(
    <>
      <MetricRow label={t("طلبات", "Orders")} value={formatNumber(data.orders)} />
      <MetricRow label={t("مدفوع", "Paid")} value={formatNumber(data.paid_orders)} />
      <MetricRow label={t("طلاب جدد", "New students")} value={formatNumber(data.new_students)} />
      <MetricRow label={t("طلاب تراكمي", "Cumulative")} value={formatNumber(data.cumulative_students ?? 0)} />
      {currencies.map((currency) => (
        <MetricRow key={currency} label={currency} value={formatAmount(Number(data.revenue?.[currency] ?? 0), currency)} />
      ))}
    </>,
    data.period,
  );
}

function BehaviorTooltip({ active, payload, t }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload as ProductBehaviorPoint;
  const rows = metricRows(t, data, [
    { key: "views", ar: "مشاهدات", en: "Views" },
    { key: "cart_adds", ar: "سلة", en: "Cart" },
    { key: "cart_removes", ar: "إزالة من السلة", en: "Cart removes" },
    { key: "wishlist_adds", ar: "مفضلة", en: "Wishlist" },
    { key: "wishlist_removes", ar: "إزالة من المفضلة", en: "Wishlist removes" },
  ]);
  return tooltipShell(rows, data.period);
}

function CurrencyTooltip({ active, payload, t, moneyKey, currency }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload as Record<string, number>;
  const rows = moneyKey ? (
    <>
      {payload
        .filter((entry: any) => entry.dataKey !== moneyKey)
        .map((entry: any, index: number) => (
          <MetricRow key={index} label={String(entry.name ?? "")} value={formatNumber(Number(entry.value ?? 0))} />
        ))}
      <MetricRow label={t("المبلغ", "Amount")} value={formatAmount(Number(data[moneyKey] ?? 0), currency ?? "USD")} />
    </>
  ) : (
    Object.keys(data)
      .filter((key) => key !== "period")
      .map((key) => <MetricRow key={key} label={key} value={formatAmount(Number(data[key] ?? 0), key)} />)
  );
  return tooltipShell(rows, data.period as unknown as string);
}
