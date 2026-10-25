import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  SUBSCRIBER_STATUSES,
  listSubscribers,
  subscriptionKeys,
  subscriptionQueries,
  type AbandonedCheckout,
  type SubscriptionPlan,
} from "@/lib/api";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { orderStatusBadge, subscriberStatusBadge } from "@/lib/status";
import { AppLink } from "@/components/ui/app-link";
import { Badge, Card, Empty } from "@/components/ui/kit";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PagedList } from "@/components/ui/paged-list";
import { PageState, Pagination } from "@/components/ui/primitives";

import { useSubscriberColumns } from "./subscriber-columns";

const PAGE = 20;

/** Who bought this plan, and who started checkout but never subscribed (viewed vs bought). */
export function PlanSubscribersTab({ plan }: { plan: SubscriptionPlan }) {
  const t = useT();
  const columns = useSubscriberColumns({ hidePlan: true });
  const [offset, setOffset] = useState(0);
  const canSeeSubscribers = can("subscribers.read");
  const abandoned = useQuery({ ...subscriptionQueries.abandoned(plan.plan_id, { limit: PAGE, offset }), enabled: canSeeSubscribers });

  const abandonedColumns: Column<AbandonedCheckout>[] = [
    {
      key: "customer", header: t("العميل", "Customer"), exportValue: (r) => r.email ?? r.customer_id,
      cell: (r) => (
        <AppLink className="ma-link ma-link--plain" to={`/customers/${r.customer_id}`}>
          <span className="ma-cell-main">{r.full_name || r.email || "—"}</span>
          <span className="ma-cell-sub"><bdi>{r.email ?? r.customer_id}</bdi></span>
        </AppLink>
      ),
    },
    { key: "attempts", header: t("محاولات الدفع", "Checkout attempts"), align: "end", exportKind: "number", exportValue: (r) => r.attempts, cell: (r) => <span className="ma-num">{formatNumber(r.attempts)}</span> },
    { key: "last_status", header: t("آخر حالة طلب", "Last order status"), exportValue: (r) => r.last_order_status ?? "", cell: (r) => <Badge def={orderStatusBadge(r.last_order_status)} /> },
    { key: "last", header: t("آخر محاولة", "Last attempt"), exportKind: "datetime", exportValue: (r) => r.last_attempt_at ?? null, cell: (r) => formatDateTime(r.last_attempt_at) },
  ];

  if (!canSeeSubscribers) {
    return <Card><Empty icon="lock" text={t("تحتاج صلاحية عرض الاشتراكات.", "You need the entitlements read permission.")} /></Card>;
  }

  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      <PagedList
        queryKeyBase={subscriptionKeys.subscribers({ plan_id: plan.plan_id })}
        fetchPage={({ query, offset: o, limit, filters }) => listSubscribers({ plan_id: plan.plan_id, query, offset: o, limit, status: filters.status || undefined })}
        columns={columns}
        searchPlaceholder={t("ابحث بالبريد أو الاسم…", "Search email or name…")}
        filters={[{
          key: "status",
          label: t("كل الحالات", "All statuses"),
          options: SUBSCRIBER_STATUSES.map((s) => { const b = subscriberStatusBadge(s); return { value: s, label: b ? t(b.label.ar, b.label.en) : s }; }),
        }]}
        empty={t("لا يوجد مشتركون في هذه الباقة بعد.", "No subscribers on this plan yet.")}
        exportConfig={{ filename: `subscribers-${plan.slug}`, title: t("المشتركون", "Subscribers"), fetchSize: 200 }}
      />

      <Card flush title={t("بدأوا الدفع ولم يشتركوا", "Started checkout but didn't subscribe")}>
        <PageState error={abandoned.error}>
          <DataTable
            columns={abandonedColumns}
            rows={abandoned.data?.items ?? []}
            loading={abandoned.isLoading}
            empty={t("لا توجد محاولات دفع غير مكتملة.", "No unfinished checkouts.")}
            exportConfig={{ filename: `abandoned-${plan.slug}`, title: t("محاولات دفع غير مكتملة", "Unfinished checkouts") }}
          />
          {(abandoned.data?.total ?? 0) > PAGE ? (
            <Pagination total={abandoned.data?.total ?? 0} limit={PAGE} offset={offset} onPage={setOffset} />
          ) : null}
        </PageState>
      </Card>
    </div>
  );
}
