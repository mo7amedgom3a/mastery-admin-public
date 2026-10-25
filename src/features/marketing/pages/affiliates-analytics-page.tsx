import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { affiliatesQueries } from "@/lib/api";
import { formatMinor, formatNumber, formatPercent } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { AppLink } from "@/components/ui/app-link";
import { Alert, Bars, Card, DateRange, Kpi, Loading, PageHead } from "@/components/ui/kit";
import { PageState } from "@/components/ui/primitives";

const n = (v: unknown) => Number(v ?? 0);
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

export default function AffiliatesAnalyticsPage() {
  const t = useT();
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(daysAgo(0));
  const analytics = useQuery(affiliatesQueries.analytics({ start: from || undefined, end: to || undefined }));
  const d = analytics.data;
  const totals = (d?.totals ?? {}) as Record<string, unknown>;
  const conversion = n(totals.signups) ? (n(totals.new_paying) / n(totals.signups)) * 100 : null;
  return (
    <>
      <PageHead
        title={t("أداء المسوقين والإحالات", "Affiliates & referrals")}
        sub={t("العملاء المنسوبون، المبيعات، العمولات ومكافآت الطلاب.", "Attributed customers, sales, commissions and student rewards.")}
        actions={<DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />}
      />
      <PageState error={analytics.error}>
        {analytics.isLoading || !d ? <Loading /> : (
          <>
            {n(totals.sync_failures) ? (
              <Alert kind="warning" title={t(`${n(totals.sync_failures)} عنصر لم يُرسل لـ Tolt`, `${n(totals.sync_failures)} items not synced to Tolt`)}>
                <AppLink className="ma-link" to="/marketing/commissions">{t("مزامنة الآن", "Sync now")}</AppLink>
              </Alert>
            ) : null}
            <div className="ma-kpis">
              <Kpi label={t("مسوقون نشطون", "Active marketers")} value={formatNumber(n(totals.active_marketers))} meta={t(`${n(totals.pending_partners)} بانتظار الموافقة`, `${n(totals.pending_partners)} pending`)} icon="users" />
              <Kpi label={t("طلاب يُحيلون", "Student referrers")} value={formatNumber(n(totals.active_students))} icon="award" />
              <Kpi label={t("عملاء منسوبون", "Attributed signups")} value={formatNumber(n(totals.signups))} icon="link" />
              <Kpi label={t("معدل التحويل", "Conversion rate")} value={conversion == null ? "—" : formatPercent(conversion)} meta={t(`${n(totals.new_paying)} أول شراء`, `${n(totals.new_paying)} first purchases`)} icon="chart" />
              <Kpi label={t("المبيعات", "Revenue")} value={formatMinor(n(totals.revenue))} meta={t(`${n(totals.conversions)} طلب`, `${n(totals.conversions)} orders`)} icon="receipt" />
            </div>
            <div className="ma-kpis">
              <Kpi label={t("عمولات معلّقة", "Pending commission")} value={formatMinor(n(totals.c_pending))} icon="clock" />
              <Kpi label={t("عمولات معتمدة", "Approved commission")} value={formatMinor(n(totals.c_approved))} icon="check" />
              <Kpi label={t("عمولات مدفوعة", "Paid commission")} value={formatMinor(n(totals.c_paid))} icon="card" />
              <Kpi label={t("مكافآت الطلاب", "Student rewards")} value={formatNumber(n(totals.rewards))} meta={t(`${formatMinor(n(totals.rewards_value))} مُنحت`, `${formatMinor(n(totals.rewards_value))} granted`)} icon="tag" />
            </div>
            <div className="ma-kpis">
              <Kpi
                label={t("طلبات صرف مفتوحة", "Open payout requests")}
                value={formatNumber(n(totals.payouts_open))}
                meta={<AppLink className="ma-link" to="/marketing/payouts">{formatMinor(n(totals.payouts_open_value))}</AppLink>}
                icon="clock"
              />
              <Kpi label={t("صُرف للمسوقين في الفترة", "Paid to marketers")} value={formatMinor(n(totals.payouts_paid))} icon="card" />
            </div>
            <div className="ma-cols ma-cols--main-side">
              <Card title={t("المبيعات اليومية", "Daily sales")}>
                {d.daily.length ? (
                  <Bars rows={d.daily.map((row) => ({ label: String(row.day), value: n(row.revenue) }))} fmt={(v) => formatMinor(v)} />
                ) : <p className="ma-help">{t("لا مبيعات في الفترة.", "No sales in this period.")}</p>}
              </Card>
              <Card title={t("أفضل الشركاء", "Top partners")}>
                {d.top.length ? (
                  <Bars rows={d.top.map((row) => ({ label: (
                    <AppLink className="ma-link" style={{ display: "inline-block", maxWidth: "11rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "bottom" }} title={String(row.email)} to={`/marketing/affiliates/${row.partner_id}`}>
                      {String(row.full_name || row.email)}
                    </AppLink>
                  ), value: n(row.revenue) }))} fmt={(v) => formatMinor(v)} />
                ) : <p className="ma-help">{t("لا بيانات.", "No data.")}</p>}
              </Card>
            </div>
          </>
        )}
      </PageState>
    </>
  );
}
