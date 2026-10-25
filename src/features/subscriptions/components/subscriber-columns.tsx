import type { SubscriberRow } from "@/lib/api";
import { formatAmount, formatDate } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { subscriberStatusBadge } from "@/lib/status";
import { AppLink } from "@/components/ui/app-link";
import { Badge } from "@/components/ui/kit";
import type { Column } from "@/components/ui/data-table";

import { INTERVAL_LABELS, labelOf, toNumber } from "../lib";

/** The price this subscriber pays (snapshot effective price, else the snapshot list price). */
export const paidPrice = (row: SubscriberRow): number =>
  toNumber((row.plan_snapshot?.effective_price as string | undefined) ?? (row.plan_snapshot?.price as string | undefined) ?? row.price);

/** Columns for subscriber tables; `hidePlan` on a single plan's page. */
export function useSubscriberColumns({ hidePlan = false }: { hidePlan?: boolean } = {}): Column<SubscriberRow>[] {
  const t = useT();
  const columns: Column<SubscriberRow>[] = [
    {
      key: "customer",
      header: t("المشترك", "Subscriber"),
      exportValue: (r) => r.customer_email ?? r.customer_id,
      cell: (r) => (
        <AppLink className="ma-link ma-link--plain" to={`/subscriptions/subscribers/${r.subscription_id}`}>
          <span className="ma-cell-main">{r.customer_name || r.company_name || r.customer_email || "—"}</span>
          <span className="ma-cell-sub"><bdi>{r.customer_email ?? r.customer_id}</bdi></span>
        </AppLink>
      ),
    },
    {
      key: "plan",
      header: t("الباقة", "Plan"),
      exportValue: (r) => r.plan_title ?? r.plan_slug ?? "",
      cell: (r) => (
        <AppLink className="ma-link ma-link--plain" to={`/subscriptions/plans/${r.plan_id}`}>
          <span className="ma-cell-main">{r.plan_title ?? r.plan_slug}</span>
          <span className="ma-cell-sub">v{r.plan_version} · {t(labelOf(INTERVAL_LABELS, r.billing_interval).ar, labelOf(INTERVAL_LABELS, r.billing_interval).en)}</span>
        </AppLink>
      ),
    },
    { key: "status", header: t("الحالة", "Status"), exportValue: (r) => r.status, cell: (r) => (
      <span className="ma-cell-flex">
        <Badge def={subscriberStatusBadge(r.status)} />
        {r.cancel_at_period_end && r.status === "active" ? <span className="ma-cell-sub">{t("يُلغى بنهاية الفترة", "cancels at period end")}</span> : null}
      </span>
    ) },
    {
      key: "price", header: t("يدفع", "Pays"), align: "end", exportKind: "money", exportValue: paidPrice,
      cell: (r) => <span className="ma-num">{formatAmount(paidPrice(r), r.currency_code ?? "USD")}</span>,
    },
    { key: "seats", header: t("المقاعد", "Seats"), align: "end", exportKind: "number", exportValue: (r) => r.seat_limit, cell: (r) => <span className="ma-num">{r.seat_limit}</span> },
    { key: "started", header: t("بدأ", "Started"), exportKind: "date", exportValue: (r) => r.created_at ?? null, cell: (r) => formatDate(r.created_at) },
    { key: "period_end", header: t("نهاية الفترة", "Period ends"), exportKind: "date", exportValue: (r) => r.current_period_end, cell: (r) => formatDate(r.current_period_end) },
  ];
  return hidePlan ? columns.filter((c) => c.key !== "plan") : columns;
}
