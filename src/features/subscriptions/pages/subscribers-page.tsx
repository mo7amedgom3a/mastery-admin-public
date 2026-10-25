import { useQuery } from "@tanstack/react-query";

import { SUBSCRIBER_STATUSES, listSubscribers, subscriptionKeys, subscriptionQueries } from "@/lib/api";
import { useLang, useT } from "@/lib/i18n";
import { subscriberStatusBadge } from "@/lib/status";
import { PageHead } from "@/components/ui/kit";
import { PagedList } from "@/components/ui/paged-list";

import { useSubscriberColumns } from "../components/subscriber-columns";
import { AUDIENCE_LABELS, planTitle } from "../lib";

/** Every customer subscription across plans (`GET /admin/subscriptions/customer-subscriptions`). */
export default function SubscribersPage() {
  const t = useT();
  const lang = useLang();
  const columns = useSubscriberColumns();
  const plans = useQuery(subscriptionQueries.plans({ lang }));

  return (
    <>
      <PageHead title={t("المشتركون", "Subscribers")}
        sub={t("كل اشتراكات العملاء، بحالتها والسعر الذي يدفعه كل مشترك.", "Every customer subscription, its status and the price each subscriber pays.")} />
      <PagedList
        queryKeyBase={subscriptionKeys.subscribers()}
        fetchPage={({ query, offset, limit, filters }) =>
          listSubscribers({
            query,
            offset,
            limit,
            status: filters.status || undefined,
            plan_id: filters.plan_id || undefined,
            audience_type: (filters.audience_type || undefined) as "individual" | "company" | undefined,
          })
        }
        columns={columns}
        searchPlaceholder={t("ابحث بالبريد أو الاسم أو الشركة…", "Search email, name or company…")}
        filters={[
          {
            key: "status",
            label: t("كل الحالات", "All statuses"),
            options: SUBSCRIBER_STATUSES.map((s) => { const b = subscriberStatusBadge(s); return { value: s, label: b ? t(b.label.ar, b.label.en) : s }; }),
          },
          {
            key: "plan_id",
            label: t("كل الباقات", "All plans"),
            options: (plans.data ?? []).map((p) => ({ value: p.plan_id, label: planTitle(p, lang) })),
          },
          {
            key: "audience_type",
            label: t("كل الفئات", "All audiences"),
            options: Object.entries(AUDIENCE_LABELS).map(([value, l]) => ({ value, label: t(l.ar, l.en) })),
          },
        ]}
        empty={t("لا يوجد مشتركون.", "No subscribers.")}
        exportConfig={{ filename: "subscribers", title: t("المشتركون", "Subscribers"), pdf: true, fetchSize: 200 }}
      />
    </>
  );
}
