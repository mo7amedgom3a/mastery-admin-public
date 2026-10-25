import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { listRefundCases, refundCaseKeys, refundCasesQueries, type RefundCase } from "@/lib/api";
import { formatDateTime, formatMinor, formatNumber } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n";
import { badgeLabel } from "@/lib/export/columns";
import { customerHref, refundCaseHref, shortRef } from "@/lib/refs";
import { initialsOf, REFUND_CASE_STATUSES, refundCaseStatusBadge } from "@/lib/status";
import { AppLink } from "@/components/ui/app-link";
import { Avatar, Badge, Button, Card, Empty, Kpi, PageHead } from "@/components/ui/kit";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { type Column } from "@/components/ui/data-table";
import { PagedList, type ListFilter } from "@/components/ui/paged-list";
import { PageState } from "@/components/ui/primitives";

const DAYS = 30;
/** Approved but not settled at the gateway yet. */
const IN_FLIGHT = ["processing", "pending", "requires_action", "needs_reconciliation"];

export default function RefundsPage() {
  const t = useT();
  const lang = useLang();
  const stats = useQuery(refundCasesQueries.stats(DAYS));
  const counts = stats.data?.status_counts ?? {};
  const points = useMemo(() => stats.data?.points ?? [], [stats.data]);

  const days = useMemo(() => {
    const byDay = new Map<string, { day: string; requests: number; refunded: number }>();
    for (const point of points) {
      const entry = byDay.get(point.day) ?? { day: point.day, requests: 0, refunded: 0 };
      entry.requests += point.cases;
      if (point.status === "succeeded") entry.refunded += point.cases;
      byDay.set(point.day, entry);
    }
    return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
  }, [points]);

  const refundedByCurrency = useMemo(() => {
    const totals = new Map<string, number>();
    for (const point of points) totals.set(point.currency_code, (totals.get(point.currency_code) ?? 0) + (point.refunded_minor ?? 0));
    return [...totals.entries()].filter(([, minor]) => minor > 0);
  }, [points]);

  const inWindow = (status: string) => points.filter((point) => point.status === status).reduce((sum, point) => sum + point.cases, 0);
  const chartConfig: ChartConfig = {
    requests: { label: t("طلبات جديدة", "New requests"), color: "var(--coral)" },
    refunded: { label: t("استردادات مكتملة", "Completed refunds"), color: "var(--teal)" },
  };

  const columns: Column<RefundCase>[] = [
    {
      key: "case",
      header: t("الطلب", "Request"),
      exportValue: (row) => shortRef(row.case_id),
      cell: (row) => (
        <AppLink className="ma-link ma-link--plain" to={refundCaseHref(row.case_id)}>
          <span className="ma-cell-main"><bdi>{shortRef(row.case_id)}</bdi></span>
          <span className="ma-cell-sub">{formatDateTime(row.created_at)}</span>
        </AppLink>
      ),
    },
    {
      key: "customer",
      header: t("العميل", "Customer"),
      exportValue: (row) => row.customer_email,
      cell: (row) => (
        <AppLink className="ma-cell-flex ma-link ma-link--plain" to={customerHref(`b2c:${row.customer_id}`)}>
          <Avatar initials={initialsOf(row.customer_email)} color="var(--sky)" />
          <span className="ma-cell-main"><bdi>{row.customer_email}</bdi></span>
        </AppLink>
      ),
    },
    {
      key: "product",
      header: t("المنتج", "Product"),
      exportValue: (row) => row.slug,
      cell: (row) => (
        <>
          <span className="ma-cell-main"><bdi>{row.slug}</bdi></span>
          <span className="ma-cell-sub">{row.product_type} · {row.provider}</span>
        </>
      ),
    },
    {
      key: "status",
      header: t("الحالة", "Status"),
      exportValue: (row) => badgeLabel(refundCaseStatusBadge(row.status), lang),
      cell: (row) => <Badge def={refundCaseStatusBadge(row.status)} />,
    },
    {
      key: "amount",
      header: t("المبلغ", "Amount"),
      align: "end",
      exportKind: "money",
      exportValue: (row) => (row.approved_minor ?? row.requested_minor) / 100,
      exportCurrency: (row) => row.currency_code,
      cell: (row) => (
        <>
          <span className="ma-num">{formatMinor(row.approved_minor ?? row.requested_minor, row.currency_code)}</span>
          {row.approved_minor != null && row.approved_minor !== row.requested_minor ? (
            <span className="ma-cell-sub">{t("المطلوب", "Requested")} {formatMinor(row.requested_minor, row.currency_code)}</span>
          ) : null}
        </>
      ),
    },
    { key: "open", header: "", align: "end", exportable: false, cell: (row) => <Button sm icon="eye" label={t("التفاصيل", "Details")} href={refundCaseHref(row.case_id)} /> },
  ];

  const filters: ListFilter[] = [
    {
      key: "status",
      label: t("كل الحالات", "All statuses"),
      options: REFUND_CASE_STATUSES.map((value) => ({ value, label: badgeLabel(refundCaseStatusBadge(value), lang) })),
    },
  ];

  return (
    <>
      <PageHead
        title={t("الاستردادات", "Refunds")}
        sub={t("راجع طلبات الاسترداد، وتحقق من الأهلية، وتابع تنفيذها لدى بوابات الدفع.", "Review refund requests, check eligibility, and follow them through the payment gateway.")}
      />

      <PageState error={stats.error}>
        <div className="ma-kpis">
          <Kpi
            label={t("بانتظار القرار", "Awaiting decision")}
            value={formatNumber(counts.requested ?? 0)}
            meta={t("كل الطلبات المفتوحة", "All open requests")}
            icon="inbox"
            field="var(--yellow)"
          />
          <Kpi
            label={t("قيد التنفيذ", "In progress")}
            value={formatNumber(IN_FLIGHT.reduce((sum, status) => sum + (counts[status] ?? 0), 0))}
            meta={t("تمت الموافقة ولم تكتمل لدى البوابة", "Approved, not settled at the gateway")}
            icon="refresh"
            field="var(--sky)"
          />
          <Kpi
            label={t(`مكتملة خلال ${DAYS} يومًا`, `Completed in ${DAYS} days`)}
            value={formatNumber(inWindow("succeeded"))}
            meta={refundedByCurrency.length ? refundedByCurrency.map(([currency, minor]) => formatMinor(minor, currency)).join(" · ") : t("لا مبالغ مستردة", "Nothing refunded")}
            icon="check"
            field="var(--teal)"
          />
          <Kpi
            label={t(`مرفوضة خلال ${DAYS} يومًا`, `Rejected in ${DAYS} days`)}
            value={formatNumber(inWindow("rejected"))}
            icon="x"
            field="var(--pink)"
          />
        </div>

        <Card className="ma-section-gap" title={t(`الطلبات والاستردادات المكتملة · آخر ${DAYS} يومًا`, `Requests and completed refunds · last ${DAYS} days`)}>
          {days.length ? (
            <ChartContainer config={chartConfig} className="h-[260px] w-full" dir="ltr">
              <BarChart data={days} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={20} tickFormatter={(value: string) => value.slice(5)} />
                <YAxis allowDecimals={false} width={32} tickLine={false} axisLine={false} />
                <ChartTooltip cursor={{ fill: "var(--fill-soft)" }} content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="requests" fill="var(--color-requests)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="refunded" fill="var(--color-refunded)" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ChartContainer>
          ) : (
            <Empty text={t("لا توجد طلبات خلال هذه الفترة.", "No requests in this period.")} />
          )}
        </Card>
      </PageState>

      <div className="ma-section-gap">
        <PagedList
          queryKeyBase={refundCaseKeys.list()}
          fetchPage={({ query, offset, limit, filters: selected }) =>
            listRefundCases({ q: query, status: selected.status || undefined, offset, limit })
          }
          columns={columns}
          filters={filters}
          searchPlaceholder={t("ابحث بالبريد أو المنتج أو رقم الطلب", "Search email, product or order id")}
          empty={t("لا توجد طلبات استرداد.", "No refund requests.")}
          exportConfig={{ filename: "refund-requests", title: t("طلبات الاسترداد", "Refund requests"), fetchSize: 100 }}
        />
      </div>
    </>
  );
}
