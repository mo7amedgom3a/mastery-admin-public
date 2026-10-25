import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { consultationAdminQueries } from "@/lib/api";
import { formatAmount, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { AppLink } from "@/components/ui/app-link";
import { Bars, Card, Empty, Kpi, Loading, PageHead } from "@/components/ui/kit";
import { PageState } from "@/components/ui/primitives";
import { SelectField } from "@/components/ui/select";
import { BookingsTable } from "../components/bookings-table";

const DAY = 86_400_000;

export default function ConsultationsOverviewPage() {
  const t = useT();
  const [days, setDays] = useState("30");
  const [by, setBy] = useState<"services" | "experts">("services");
  // Fixed per period so the query key is stable between renders.
  const range = useMemo(() => {
    const end = new Date(Math.ceil(Date.now() / DAY) * DAY);
    return { start: new Date(end.getTime() - Number(days) * DAY).toISOString(), end: end.toISOString() };
  }, [days]);

  const overview = useQuery(consultationAdminQueries.overview(range));
  const top = useQuery(consultationAdminQueries.top({ ...range, by, limit: 10 }));
  const o = overview.data;

  return (
    <>
      <PageHead title={t("الاستشارات", "Consultations")}
        sub={t("نظرة على الحجوزات والخبراء وأفضل الاستشارات.", "Bookings, experts and top consultations.")}
        actions={
          <SelectField label={t("الفترة", "Period")} value={days} onChange={setDays}
            options={[
              { value: "7", label: t("آخر 7 أيام", "Last 7 days") },
              { value: "30", label: t("آخر 30 يومًا", "Last 30 days") },
              { value: "90", label: t("آخر 90 يومًا", "Last 90 days") },
            ]} />
        } />
      <PageState error={overview.error}>
        {o ? (
          <div className="ma-kpis">
            <Kpi label={t("الحجوزات", "Bookings")} value={formatNumber(o.bookings)} icon="calendar" />
            <Kpi label={t("بانتظار الموافقة", "Awaiting expert")} value={formatNumber(o.awaiting_approval)} icon="clock" />
            <Kpi label={t("قادمة", "Upcoming")} value={formatNumber(o.upcoming)} icon="video" />
            <Kpi label={t("مكتملة", "Completed")} value={formatNumber(o.completed)} icon="check" />
            <Kpi label={t("غياب", "No-shows")} value={formatNumber(o.no_shows)} icon="alert" />
            <Kpi label={t("بانتظار الاسترداد", "Refund pending")} value={formatNumber(o.refund_pending)} icon="refund" />
            <Kpi label={t("خبراء نشطون", "Active experts")} value={formatNumber(o.active_experts)} icon="users" />
          </div>
        ) : <Loading />}
      </PageState>

      <Card title={by === "services" ? t("أفضل الاستشارات", "Top consultations") : t("أفضل الخبراء", "Top experts")}
        actions={
          <SelectField label={t("حسب", "By")} value={by} onChange={setBy}
            options={[{ value: "services", label: t("الخدمات", "Services") }, { value: "experts", label: t("الخبراء", "Experts") }]} />
        }>
        <PageState error={top.error}>
          {top.isLoading ? <Loading /> : null}
          {top.data && !top.data.items.length ? <Empty text={t("لا بيانات في هذه الفترة.", "No data in this period.")} /> : null}
          {top.data?.items.length ? (
            <Bars
              rows={top.data.items.map((row) => ({
                label: (
                  <span>
                    {by === "experts"
                      ? <AppLink className="ma-link" to={`/consultations/experts/${row.ref}`}>{row.title ?? "—"}</AppLink>
                      : (row.title ?? "—")}
                    <span className="ma-cell-sub">
                      {row.completed} {t("مكتملة", "completed")} · {row.no_shows} {t("غياب", "no-shows")}
                      {row.revenue != null && row.currency_code ? ` · ${formatAmount(Number(row.revenue), row.currency_code)}` : ""}
                    </span>
                  </span>
                ),
                value: row.bookings,
              }))}
              fmt={(v) => `${formatNumber(v)} ${t("حجز", "bookings")}`}
            />
          ) : null}
        </PageState>
      </Card>

      <Card title={t("أحدث الحجوزات", "Recent bookings")} flush>
        <BookingsTable />
      </Card>
    </>
  );
}
