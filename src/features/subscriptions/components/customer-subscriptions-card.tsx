import { useQuery } from "@tanstack/react-query";

import { listSubscribers, subscriptionKeys } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Card, Empty, ErrorAlert, Loading } from "@/components/ui/kit";
import { DataTable } from "@/components/ui/data-table";

import { useSubscriberColumns } from "./subscriber-columns";

/** A customer's subscriptions on their profile; each row opens the subscription to manage it. */
export function CustomerSubscriptionsCard({ customerId }: { customerId: string }) {
  const t = useT();
  const columns = useSubscriberColumns();
  const params = { customer_id: customerId, limit: 50 };
  const subscriptions = useQuery({
    queryKey: subscriptionKeys.subscribers(params),
    queryFn: () => listSubscribers(params),
  });

  return (
    <div className="ma-section-gap">
      <Card flush title={t("الاشتراكات", "Subscriptions")}>
        <ErrorAlert error={subscriptions.error} />
        {subscriptions.isLoading ? (
          <Loading />
        ) : subscriptions.data?.items.length ? (
          <DataTable columns={columns} rows={subscriptions.data.items} />
        ) : (
          <Empty icon="refresh" text={t("لا توجد اشتراكات لهذا العميل.", "This customer has no subscriptions.")} />
        )}
      </Card>
    </div>
  );
}
