import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, XAxis, YAxis } from "recharts";

import {
  behaviorQueries,
  type PostHogConversionStep,
  type PostHogPageMetric,
} from "@/lib/api";
import { defaultRange, dayEndIso, dayStartIso } from "@/lib/dates";
import { formatCompact, formatDate, formatNumber, formatPercent, formatShortDay } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { PALETTE } from "@/lib/status";
import { Button, Bars, Card, DateRange, Empty, ErrorAlert, Kpi, Loading, PageHead } from "@/components/ui/kit";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageState } from "@/components/ui/primitives";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const GROUP_LABELS: Record<string, { ar: string; en: string }> = {
  home: { ar: "الرئيسية", en: "Home" },
  auth: { ar: "الدخول والتسجيل", en: "Auth" },
  checkout: { ar: "الدفع", en: "Checkout" },
  account: { ar: "حساب الطالب", en: "Account" },
  programs: { ar: "البرامج", en: "Programs" },
  catalog: { ar: "المحتوى", en: "Catalog" },
  other: { ar: "أخرى", en: "Other" },
};

const PAGE_LABELS: Record<string, { ar: string; en: string }> = {
  "/": { ar: "الرئيسية", en: "Home" },
  "/login": { ar: "تسجيل الدخول", en: "Login" },
  "/register": { ar: "إنشاء حساب", en: "Register" },
  "/cart": { ar: "السلة", en: "Cart" },
  "/checkout": { ar: "الدفع", en: "Checkout" },
  "/checkout/success": { ar: "نجاح الدفع", en: "Checkout success" },
  "/checkout/failed": { ar: "فشل الدفع", en: "Checkout failed" },
  "/checkout/cancelled": { ar: "إلغاء الدفع", en: "Checkout cancelled" },
  "/students": { ar: "لوحة الطالب", en: "Student home" },
  "/students/onboarding": { ar: "تعريف الطالب", en: "Onboarding" },
  "/search": { ar: "البحث", en: "Search" },
};

const STEP_LABELS: Record<string, { ar: string; en: string }> = {
  visit: { ar: "زيارة الموقع", en: "Visited site" },
  product_view: { ar: "مشاهدة منتج", en: "Viewed a product" },
  cart: { ar: "إضافة للسلة", en: "Added to cart" },
  checkout: { ar: "بدء الدفع", en: "Started checkout" },
  payment: { ar: "إتمام الدفع", en: "Completed payment" },
};

const BAND_LABELS: { ar: string; en: string }[] = [
  { ar: "يوم واحد", en: "1 day" },
  { ar: "٢–٣ أيام", en: "2–3 days" },
  { ar: "٤–٧ أيام", en: "4–7 days" },
  { ar: "٨+ أيام", en: "8+ days" },
];

export default function PostHogAnalyticsPage() {
  const t = useT();
  const initial = useMemo(() => defaultRange(30), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);

  const params = { start: dayStartIso(from), end: dayEndIso(to) };
  const overview = useQuery(behaviorQueries.posthogOverview({ ...params, top_n: 5 }));
  const trends = useQuery(behaviorQueries.posthogTrends(params));
  const pages = useQuery(behaviorQueries.posthogPages({ ...params, limit: 8 }));
  const audience = useQuery(behaviorQueries.posthogAudience(params));
  const conversion = useQuery(behaviorQueries.posthogConversion(params));

  const data = overview.data;
  const audienceData = audience.data;
  const conversionData = conversion.data;
  const pagesData = pages.data;
  const points = trends.data?.points ?? [];
  const steps = conversionData?.steps ?? [];
  const signupPoints = audienceData?.signup_points ?? [];
  const topPages = pagesData?.top_pages ?? [];
  const landingPages = pagesData?.landing_pages ?? [];
  const keyPages = pagesData?.key_pages ?? [];
  const bands = audienceData?.bands ?? [];
  const signupCountries = audienceData?.signups_by_country ?? [];

  const available = data?.available ?? true;
  const errorMessage =
    data?.error ??
    audienceData?.error ??
    conversionData?.error ??
    pagesData?.error ??
    trends.data?.error ??
    null;
  const partialError = [audienceData, pagesData, conversionData].find((entry) => entry && !entry.available)?.error ?? null;

  const trendConfig = {
    pageviews: { label: t("مشاهدات الصفحات", "Pageviews"), color: "var(--coral)" },
    product_views: { label: t("مشاهدات المنتجات", "Product views"), color: "var(--purple)" },
    searches: { label: t("عمليات البحث", "Searches"), color: "var(--sky)" },
    checkouts: { label: t("بدء الدفع", "Checkouts"), color: "var(--yellow)" },
    payments: { label: t("مدفوعات", "Payments"), color: "var(--green)" },
  } satisfies ChartConfig;

  const signupConfig = {
    signups: { label: t("حسابات جديدة", "New accounts"), color: "var(--coral)" },
  } satisfies ChartConfig;

  const stepConfig = {
    visitors: { label: t("الزوّار", "Visitors"), color: "var(--coral)" },
  } satisfies ChartConfig;

  const pageGroup = (group: string) => {
    const label = GROUP_LABELS[group];
    return label ? t(label.ar, label.en) : group;
  };

  const pageLabel = (path: string) => {
    const label = PAGE_LABELS[path];
    return label ? `${t(label.ar, label.en)} · ${path}` : path;
  };

  const stepLabel = (step: PostHogConversionStep) => {
    const label = STEP_LABELS[step.key];
    return label ? t(label.ar, label.en) : step.label;
  };

  const pageColumns: Column<PostHogPageMetric>[] = [
    {
      key: "path",
      header: t("الصفحة", "Page"),
      cell: (row) => (
        <span className="ma-cell-flex">
          <bdi className="ma-cell-main">{pageLabel(row.path)}</bdi>
          <span className="ma-badge">{pageGroup(row.group)}</span>
        </span>
      ),
    },
    { key: "views", header: t("المشاهدات", "Pageviews"), align: "end", cell: (row) => <span className="ma-num">{formatNumber(row.pageviews)}</span> },
    { key: "visitors", header: t("زوّار", "Visitors"), align: "end", cell: (row) => <span className="ma-num">{formatNumber(row.visitors)}</span> },
  ];

  const signupBasis =
    audienceData?.signup_basis === "signed_up"
      ? t("حدث التسجيل (signed_up)", "signup event (signed_up)")
      : t("حدث التعريف ($identify) — يُستخدم مؤقتًا حتى يُفعّل حدث التسجيل", "$identify — used until the signup event is instrumented");

  return (
    <>
      <PageHead
        title={t("تحليلات PostHog", "PostHog analytics")}
        sub={t(
          "أداء متجر الواجهة: الزوّار النشطون، الصفحات، مصادر التسجيل والدول، والتحويل والتسرّب في كل خطوة.",
          "Storefront performance: active users, pages, signup sources and countries, plus conversion and drop-off by step.",
        )}
        actions={
          <Button
            sm
            icon="refresh"
            label={t("تحديث", "Refresh")}
            onClick={() => {
              overview.refetch();
              trends.refetch();
              pages.refetch();
              audience.refetch();
              conversion.refetch();
            }}
          />
        }
      />

      <div className="ma-toolbar">
        <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} onClear={() => { setFrom(initial.from); setTo(initial.to); }} />
      </div>

      {partialError ? <ErrorAlert error={partialError} title={t("تعذّر تحميل بعض مؤشرات PostHog", "Some PostHog metrics couldn't be loaded")} /> : null}

      {!available ? (
        <Card title={t("PostHog", "PostHog")}>
          <ErrorAlert error={errorMessage ?? t("PostHog غير متاح حاليًا.", "PostHog is unavailable right now.")} />
        </Card>
      ) : (
        <PageState error={overview.error}>
          {data ? (
            <>
              <div className="ma-kpis">
                <Kpi label={t("الزوّار", "Visitors")} value={<span className="ma-num">{formatNumber(data.visitors)}</span>} icon="users" field="var(--coral)" />
                <Kpi label={t("مشاهدات الصفحات", "Pageviews")} value={<span className="ma-num">{formatNumber(data.pageviews)}</span>} icon="history" field="var(--yellow)" />
                <Kpi label={t("الجلسات", "Sessions")} value={<span className="ma-num">{formatNumber(data.sessions)}</span>} icon="clock" field="var(--sky)" />
                <Kpi label={t("زوّار عائدون", "Returning visitors")} value={<span className="ma-num">{formatPercent(data.returning_rate)}</span>} icon="refresh" field="var(--teal)" />
              </div>

              <div className="ma-kpis ma-section-gap">
                <Kpi
                  label={t("نشطون يوميًا (DAU)", "Daily active (DAU)")}
                  value={<span className="ma-num">{formatNumber(audienceData?.daily_active ?? 0)}</span>}
                  icon="zap"
                  field="var(--coral)"
                  meta={t("آخر يوم في النطاق", "last day of the window")}
                />
                <Kpi
                  label={t("نشطون أسبوعيًا (WAU)", "Weekly active (WAU)")}
                  value={<span className="ma-num">{formatNumber(audienceData?.weekly_active ?? 0)}</span>}
                  icon="calendar"
                  field="var(--purple)"
                  meta={t("آخر ٧ أيام", "last 7 days")}
                />
                <Kpi
                  label={t("نشطون شهريًا (MAU)", "Monthly active (MAU)")}
                  value={<span className="ma-num">{formatNumber(audienceData?.monthly_active ?? 0)}</span>}
                  icon="users"
                  field="var(--sky)"
                  meta={t("آخر ٣٠ يومًا", "last 30 days")}
                />
                <Kpi
                  label={t("الالتصاق (DAU/MAU)", "Stickiness (DAU/MAU)")}
                  value={<span className="ma-num">{formatPercent(audienceData?.stickiness ?? 0)}</span>}
                  icon="chart"
                  field="var(--teal)"
                  meta={t(`${formatNumber(audienceData?.recurring_users ?? 0)} مستخدمًا عائدًا`, `${formatNumber(audienceData?.recurring_users ?? 0)} recurring users`)}
                />
              </div>

              <Card title={t("حركة المتجر يوميًا", "Storefront activity")} className="ma-section-gap">
                {trends.isLoading ? (
                  <Loading />
                ) : points.length ? (
                  <ChartContainer config={trendConfig} className="h-[320px] w-full" dir="ltr">
                    <LineChart data={points} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} tickFormatter={(value: string) => formatShortDay(value)} />
                      <YAxis width={52} tickLine={false} axisLine={false} tickFormatter={(value: number) => formatCompact(value)} />
                      <ChartTooltip
                        cursor={{ stroke: "var(--line)" }}
                        offset={8}
                        content={<ChartTooltipContent labelFormatter={(label) => formatDate(String(label))} valueFormatter={(value) => formatNumber(Number(value))} />}
                      />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Line type="monotone" dataKey="pageviews" stroke="var(--color-pageviews)" strokeWidth={2.5} dot={false} />
                      <Line type="monotone" dataKey="product_views" stroke="var(--color-product_views)" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="searches" stroke="var(--color-searches)" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="checkouts" stroke="var(--color-checkouts)" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="payments" stroke="var(--color-payments)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ChartContainer>
                ) : (
                  <Empty text={t("لا بيانات في هذه الفترة.", "No data in this period.")} />
                )}
              </Card>

              <Card title={t("التحويل والتسرّب", "Conversion & drop-off")} className="ma-section-gap">
                {conversionData ? (
                  <>
                    <div className="ma-kpis" style={{ marginBottom: 12 }}>
                      <Kpi label={t("تحويل الدفع", "Checkout conversion")} value={<span className="ma-num">{formatPercent(conversionData.checkout_conversion)}</span>} icon="cart" field="var(--coral)" />
                      <Kpi label={t("التحويل الكلي", "Overall conversion")} value={<span className="ma-num">{formatPercent(conversionData.overall_conversion)}</span>} icon="chart" field="var(--purple)" />
                      <Kpi label={t("فشل الدفع", "Payment failure")} value={<span className="ma-num">{formatPercent(conversionData.payment_failure_rate)}</span>} icon="alert" field="var(--pink)" meta={t(`${formatNumber(conversionData.payment_failed)} محاولة فاشلة`, `${formatNumber(conversionData.payment_failed)} failed attempts`)} />
                      <Kpi label={t("أتمّوا الدفع", "Payments")} value={<span className="ma-num">{formatNumber(conversionData.payments)}</span>} icon="check" field="var(--green)" />
                    </div>

                    {steps.length ? (
                      <ChartContainer config={stepConfig} className="h-[240px] w-full" dir="ltr">
                        <BarChart data={steps.map((step) => ({ ...step, label: stepLabel(step) }))} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
                          <CartesianGrid horizontal={false} />
                          <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(value: number) => formatCompact(value)} />
                          <YAxis type="category" dataKey="label" width={150} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                          <ChartTooltip cursor={{ fill: "var(--line)", fillOpacity: 0.25 }} content={<ChartTooltipContent valueFormatter={(value) => formatNumber(Number(value))} />} />
                          <Bar dataKey="visitors" radius={[0, 6, 6, 0]} barSize={18}>
                            {steps.map((_, index) => (
                              <Cell key={index} fill={PALETTE[index % PALETTE.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ChartContainer>
                    ) : null}

                    <ul className="ma-list" style={{ marginTop: 8 }}>
                      {steps.map((step) => (
                        <li key={step.key}>
                          <span className="ma-cell-main" style={{ flex: 1 }}>{stepLabel(step)}</span>
                          <span className="ma-num">{formatNumber(step.visitors)}</span>
                          <span className="ma-cell-sub" style={{ minWidth: 130, textAlign: "end" }}>
                            {formatPercent(Math.min(step.conversion_from_previous, 100))} · {t("تسرّب", "drop")} {formatNumber(step.dropout)} ({formatPercent(step.dropout_rate)})
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="ma-note ma-section-gap">
                      {t(
                        "قد يبدأ بعض الزوّار الدفع دون تسجيل «إضافة للسلة»، لذلك قد تتجاوز نسبة خطوة الدفع ١٠٠٪.",
                        "Some visitors start checkout without a tracked “add to cart”, so a step’s conversion can exceed 100%.",
                      )}
                    </p>
                  </>
                ) : conversion.isLoading ? (
                  <Loading />
                ) : (
                  <Empty text={t("لا بيانات.", "No data.")} />
                )}
              </Card>

              <div className="ma-cols ma-cols--2 ma-section-gap">
                <Card title={t("أكثر صفحات الموقع زيارة", "Top website pages")}>
                  {topPages.length ? (
                    <DataTable rows={topPages} columns={pageColumns} empty={t("لا بيانات.", "No data.")} exportConfig={false} />
                  ) : pages.isLoading ? (
                    <Loading />
                  ) : (
                    <Empty text={t("لا بيانات.", "No data.")} />
                  )}
                </Card>

                <Card title={t("أكثر صفحات الهبوط", "Most popular landing pages")}>
                  {landingPages.length ? (
                    <Bars
                      rows={landingPages.map((row, index) => ({
                        label: <bdi>{pageLabel(row.path)}</bdi>,
                        value: row.sessions,
                        color: PALETTE[index % PALETTE.length],
                      }))}
                      fmt={(value) => `${formatNumber(value)} ${t("جلسة", "sessions")}`}
                    />
                  ) : pages.isLoading ? (
                    <Loading />
                  ) : (
                    <Empty text={t("لا بيانات.", "No data.")} />
                  )}
                </Card>
              </div>

              <div className="ma-cols ma-cols--2 ma-section-gap">
                <Card title={t("صفحات التحويل الرئيسية", "Key conversion pages")}>
                  {keyPages.length ? (
                    <DataTable rows={keyPages} columns={pageColumns} empty={t("لا بيانات.", "No data.")} exportConfig={false} />
                  ) : pages.isLoading ? (
                    <Loading />
                  ) : (
                    <Empty text={t("لا بيانات.", "No data.")} />
                  )}
                </Card>

                <Card title={t("المستخدمون العائدون", "Recurring active users")}>
                  {audienceData ? (
                    <>
                      <div className="ma-kpis" style={{ marginBottom: 12 }}>
                        <Kpi label={t("مستخدمون عائدون", "Recurring users")} value={<span className="ma-num">{formatNumber(audienceData.recurring_users)}</span>} icon="refresh" field="var(--teal)" />
                        <Kpi label={t("نسبة العودة", "Recurring rate")} value={<span className="ma-num">{formatPercent(audienceData.recurring_rate)}</span>} icon="chart" field="var(--purple)" meta={t(`من ${formatNumber(audienceData.total_active_users)} زائرًا`, `of ${formatNumber(audienceData.total_active_users)} visitors`)} />
                      </div>
                      <Bars
                        rows={bands.map((band, index) => ({
                          label: t(BAND_LABELS[index]?.ar ?? band.label, BAND_LABELS[index]?.en ?? band.label),
                          value: band.users,
                          color: PALETTE[index % PALETTE.length],
                        }))}
                        fmt={(value) => formatNumber(value)}
                      />
                    </>
                  ) : audience.isLoading ? (
                    <Loading />
                  ) : (
                    <Empty text={t("لا بيانات.", "No data.")} />
                  )}
                </Card>
              </div>

              <div className="ma-cols ma-cols--2 ma-section-gap">
                <Card
                  title={t("نمو الحسابات", "Account growth")}
                  actions={<span className="ma-cell-sub">{t(`${formatNumber(audienceData?.signups ?? 0)} حسابًا جديدًا`, `${formatNumber(audienceData?.signups ?? 0)} new accounts`)}</span>}
                >
                  {signupPoints.length ? (
                    <ChartContainer config={signupConfig} className="h-[220px] w-full" dir="ltr">
                      <BarChart data={signupPoints} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} tickFormatter={(value: string) => formatShortDay(value)} />
                        <YAxis width={40} tickLine={false} axisLine={false} allowDecimals={false} />
                        <ChartTooltip cursor={{ fill: "var(--line)", fillOpacity: 0.25 }} content={<ChartTooltipContent labelFormatter={(label) => formatDate(String(label))} valueFormatter={(value) => formatNumber(Number(value))} />} />
                        <Bar dataKey="signups" fill="var(--color-signups)" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ChartContainer>
                  ) : audience.isLoading ? (
                    <Loading />
                  ) : (
                    <Empty text={t("لا حسابات جديدة في هذه الفترة.", "No new accounts in this period.")} />
                  )}
                  <p className="ma-note" style={{ marginTop: 8 }}>
                    {t(`مصدر الاحتساب: ${signupBasis}`, `Account basis: ${signupBasis}`)}
                  </p>
                </Card>

                <Card title={t("الحسابات الجديدة حسب الدولة", "New accounts by country")}>
                  {signupCountries.length ? (
                    <Bars
                      rows={signupCountries.map((row, index) => ({
                        label: <bdi>{row.key}</bdi>,
                        value: row.count,
                        color: PALETTE[index % PALETTE.length],
                      }))}
                      fmt={(value) => formatNumber(value)}
                    />
                  ) : audience.isLoading ? (
                    <Loading />
                  ) : (
                    <Empty text={t("لا بيانات.", "No data.")} />
                  )}
                </Card>
              </div>
            </>
          ) : overview.isLoading ? (
            <Loading />
          ) : null}
        </PageState>
      )}
    </>
  );
}
