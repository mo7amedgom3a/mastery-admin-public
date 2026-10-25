import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  subscriptionQueries,
  type CompanyInsightStage,
  type CompanyInsightsTrendPoint,
} from "@/lib/api";
import { formatMonth, formatNumber, formatPercent } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n";
import { AppLink } from "@/components/ui/app-link";
import { Card, DateRange, Empty, Kpi, Loading, PageHead } from "@/components/ui/kit";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageState } from "@/components/ui/primitives";

import { useStatsWindow } from "../lib";

const STAGE_LABELS: Record<CompanyInsightStage["status"], { ar: string; en: string }> = {
  details: { ar: "أدخلوا البيانات", en: "Details submitted" },
  checkout_started: { ar: "وصلوا للدفع", en: "Checkout started" },
  converted: { ar: "دفعوا واشتركوا", en: "Paid & subscribed" },
};

const seatsLabel = (value: number | null | undefined, unit: string) =>
  value == null ? "—" : `${formatNumber(value)} ${unit}`;

/**
 * Company checkout funnel (`GET /admin/subscriptions/stats/company-insights`): companies that filled their
 * details versus those that reached Stripe and paid, with average team sizes — the strategic view of where
 * companies leave before completing checkout.
 */
export default function CompanyInsightsPage() {
  const t = useT();
  const lang = useLang();
  const { from, to, setFrom, setTo, window } = useStatsWindow(30);
  const insightsQuery = useQuery(subscriptionQueries.companyInsights(window));
  const insights = insightsQuery.data;
  const seats = (value: number | null | undefined) => seatsLabel(value, t("موظف", "employees"));

  const stageChartConfig: ChartConfig = {
    companies: { label: t("شركات", "Companies"), color: "var(--sky)" },
  };
  const seatsChartConfig: ChartConfig = {
    seats: { label: t("متوسط عدد الموظفين", "Average team size"), color: "var(--green)" },
  };
  const trendChartConfig: ChartConfig = {
    submitted: { label: t("طلبات الشركات", "Company requests"), color: "var(--sky)" },
    converted: { label: t("اشتركوا", "Subscribed"), color: "var(--green)" },
  };

  const stageChartData = (insights?.stages ?? []).map((stage) => ({
    stage: STAGE_LABELS[stage.status][lang],
    companies: stage.companies,
  }));

  const seatsChartData = insights
    ? [
        { label: t("عند إرسال البيانات", "On details"), seats: insights.avg_seats ?? 0 },
        { label: t("بعد الدفع", "After payment"), seats: insights.avg_seats_paid ?? 0 },
      ]
    : [];

  const stageColumns: Column<CompanyInsightStage>[] = [
    {
      key: "stage",
      header: t("المرحلة", "Stage"),
      exportValue: (row) => STAGE_LABELS[row.status][lang],
      cell: (row) => <span className="ma-cell-main">{STAGE_LABELS[row.status][lang]}</span>,
    },
    {
      key: "companies",
      header: t("الشركات", "Companies"),
      align: "end",
      exportKind: "number",
      sortValue: (row) => row.companies,
      exportValue: (row) => row.companies,
      cell: (row) => <span className="ma-num">{formatNumber(row.companies)}</span>,
    },
    {
      key: "avg",
      header: t("متوسط الفريق", "Avg. team"),
      align: "end",
      sortValue: (row) => row.avg_seats ?? -1,
      exportValue: (row) => row.avg_seats ?? "",
      cell: (row) => <span className="ma-num">{seats(row.avg_seats)}</span>,
    },
  ];

  const trendColumns: Column<CompanyInsightsTrendPoint>[] = [
    {
      key: "month",
      header: t("الشهر", "Month"),
      exportValue: (row) => row.month,
      cell: (row) => <span className="ma-cell-main">{formatMonth(row.month)}</span>,
    },
    {
      key: "submitted",
      header: t("طلبات", "Requests"),
      align: "end",
      exportKind: "number",
      exportValue: (row) => row.submitted,
      cell: (row) => <span className="ma-num">{formatNumber(row.submitted)}</span>,
    },
    {
      key: "converted",
      header: t("اشتركوا", "Subscribed"),
      align: "end",
      exportKind: "number",
      exportValue: (row) => row.converted,
      cell: (row) => <span className="ma-num">{formatNumber(row.converted)}</span>,
    },
    {
      key: "avg",
      header: t("متوسط الفريق", "Avg. team"),
      align: "end",
      exportValue: (row) => row.avg_seats ?? "",
      cell: (row) => <span className="ma-num">{seats(row.avg_seats)}</span>,
    },
  ];

  const conversion =
    insights?.conversion_rate == null ? "—" : formatPercent(insights.conversion_rate);

  return (
    <>
      <PageHead
        title={t("مؤشرات الشركات", "Company insights")}
        sub={t(
          "مقارنة الشركات التي أكملت بياناتها بالشركات التي أكملت الدفع فعلًا، وأحجام الفرق ومعدل التحويل.",
          "Companies that submitted their details versus those that completed payment, with team sizes and conversion.",
        )}
        actions={<DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />}
      />

      <PageState error={insightsQuery.error}>
        {insights ? (
          <div className="ma-kpis">
            <Kpi
              label={t("طلبات الشركات", "Company requests")}
              value={formatNumber(insights.submitted)}
              meta={t("أكملت بياناتها قبل الدفع", "submitted details before paying")}
              icon="users"
            />
            <Kpi
              label={t("اشتركت فعلًا", "Paid companies")}
              value={formatNumber(insights.converted)}
              meta={t(`${formatNumber(insights.paid_subscriptions)} اشتراك شركة`, `${formatNumber(insights.paid_subscriptions)} company subscriptions`)}
              icon="card"
            />
            <Kpi
              label={t("لم تكمل الدفع", "Left before paying")}
              value={formatNumber(insights.abandoned)}
              meta={t(`${formatNumber(insights.details_only)} بيانات فقط · ${formatNumber(insights.checkout_started)} بدأت الدفع`, `${formatNumber(insights.details_only)} details only · ${formatNumber(insights.checkout_started)} started checkout`)}
              icon="alert"
            />
            <Kpi
              label={t("معدل التحويل", "Conversion rate")}
              value={conversion}
              meta={t("من البيانات إلى الدفع", "details to payment")}
              icon="plus"
            />
            <Kpi
              label={t("متوسط الفريق المطلوب", "Average requested team")}
              value={seats(insights.avg_seats)}
              meta={t("عند إرسال البيانات", "on details submitted")}
              icon="users"
            />
            <Kpi
              label={t("متوسط المقاعد المدفوعة", "Average paid seats")}
              value={seats(insights.avg_seats_paid)}
              meta={t("في الاشتراكات المدفوعة", "in paid subscriptions")}
              icon="receipt"
            />
          </div>
        ) : (
          <Loading />
        )}
      </PageState>

      <div className="ma-cols ma-cols--main-side">
        <Card title={t("الشركات حسب مرحلة الدفع", "Companies by checkout stage")}>
          {insights && stageChartData.some((row) => row.companies > 0) ? (
            <ChartContainer config={stageChartConfig} className="h-[280px] w-full" dir="ltr">
              <BarChart data={stageChartData} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="stage" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis width={36} allowDecimals={false} tickLine={false} axisLine={false} />
                <ChartTooltip cursor={{ fill: "var(--fill-soft)" }} content={<ChartTooltipContent />} />
                <Bar dataKey="companies" fill="var(--color-companies)" radius={[4, 4, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ChartContainer>
          ) : insights ? (
            <Empty text={t("لا طلبات شركات في هذه الفترة.", "No company requests in this period.")} />
          ) : (
            <Loading />
          )}
        </Card>

        <Card title={t("متوسط حجم الفريق", "Average team size")}>
          {insights && seatsChartData.some((row) => row.seats > 0) ? (
            <ChartContainer config={seatsChartConfig} className="h-[280px] w-full" dir="ltr">
              <BarChart data={seatsChartData} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis width={36} allowDecimals={false} tickLine={false} axisLine={false} />
                <ChartTooltip cursor={{ fill: "var(--fill-soft)" }} content={<ChartTooltipContent />} />
                <Bar dataKey="seats" fill="var(--color-seats)" radius={[4, 4, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ChartContainer>
          ) : insights ? (
            <Empty text={t("لا توجد أحجام فرق مسجلة بعد.", "No team sizes recorded yet.")} />
          ) : (
            <Loading />
          )}
          <p className="ma-note">
            {t("الفرق بين الحجم المطلوب والمدفوع يوضح الشركات التي قلّصت فريقها قبل الدفع.", "The gap between requested and paid size shows companies that reduced their team before paying.")}
          </p>
        </Card>
      </div>

      <div className="ma-cols ma-cols--main-side">
        <Card title={t("طلبات الشركات مقابل الاشتراكات", "Company requests vs subscriptions")}>
          {insights && insights.trend.length ? (
            <ChartContainer config={trendChartConfig} className="h-[280px] w-full" dir="ltr">
              <BarChart data={insights.trend} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value: string) => formatMonth(value)} />
                <YAxis width={36} allowDecimals={false} tickLine={false} axisLine={false} />
                <ChartTooltip cursor={{ fill: "var(--fill-soft)" }} content={<ChartTooltipContent labelFormatter={(label) => formatMonth(String(label))} />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="submitted" fill="var(--color-submitted)" radius={[4, 4, 0, 0]} maxBarSize={24} />
                <Bar dataKey="converted" fill="var(--color-converted)" radius={[4, 4, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ChartContainer>
          ) : insights ? (
            <Empty text={t("لا بيانات شهرية في هذه الفترة.", "No monthly data in this period.")} />
          ) : (
            <Loading />
          )}
        </Card>

        <Card title={t("تابع الشركات", "Follow up")}>
          <p className="ma-note">
            {t(
              "الشركات التي أدخلت بياناتها ولم تدفع تظهر في طلبات الشركات مع حالة كل واحدة وعدد الموظفين.",
              "Companies that submitted details without paying appear in Company leads with each one's status and team size.",
            )}
          </p>
          <AppLink className="ma-btn ma-btn--primary ma-btn--sm" to="/companies/leads">
            {t("فتح طلبات الشركات", "Open company leads")}
          </AppLink>
        </Card>
      </div>

      <Card flush title={t("الشركات حسب المرحلة", "Companies by stage")}>
        <DataTable
          columns={stageColumns}
          rows={insights?.stages ?? []}
          loading={insightsQuery.isLoading}
          empty={t("لا توجد بيانات.", "No data.")}
          exportConfig={{ filename: "company-stages", title: t("الشركات حسب المرحلة", "Companies by stage") }}
        />
      </Card>

      <Card flush title={t("الاتجاه الشهري", "Monthly trend")}>
        <DataTable
          columns={trendColumns}
          rows={insights?.trend ?? []}
          loading={insightsQuery.isLoading}
          empty={t("لا توجد بيانات.", "No data.")}
          exportConfig={{ filename: "company-trend", title: t("الاتجاه الشهري", "Monthly trend") }}
        />
      </Card>
    </>
  );
}
