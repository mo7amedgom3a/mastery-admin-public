import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { cancelSubscriber, subscriptionKeys, subscriptionQueries, type SubscriberDetail } from "@/lib/api";
import { formatAmount, formatDate, formatDateTime } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { subscriberStatusBadge } from "@/lib/status";
import { AppLink } from "@/components/ui/app-link";
import { Badge, Button, Card, Dl, ErrorAlert, Loading, PageHead } from "@/components/ui/kit";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { PageState } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";

import { paidPrice } from "../components/subscriber-columns";
import { INTERVAL_LABELS, PLAN_TYPE_LABELS, labelOf, toNumber } from "../lib";

type Selection = NonNullable<SubscriberDetail["selections"]>[number];
type Seat = NonNullable<SubscriberDetail["seats"]>[number];

/** One customer subscription: terms they bought (snapshot), Choose-X selections, seats, and admin cancel. */
export default function SubscriberDetailPage() {
  const t = useT();
  const queryClient = useQueryClient();
  const { id = "" } = useParams<{ id: string }>();
  const detail = useQuery(subscriptionQueries.subscriber(id));
  const s = detail.data;
  const [cancelMode, setCancelMode] = useState<"period_end" | "immediate" | null>(null);

  const cancel = useMutation({
    mutationFn: (immediate: boolean) => cancelSubscriber(id, immediate),
    onSuccess: () => {
      setCancelMode(null);
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
      toast.success(t("تم إلغاء الاشتراك", "Subscription canceled"));
    },
  });

  const selectionColumns: Column<Selection>[] = [
    { key: "course", header: t("الدورة", "Course"), cell: (r) => r.product_title ?? r.product_slug ?? r.product_id },
    { key: "status", header: t("الحالة", "Status"), cell: (r) => r.status },
    { key: "started", header: t("بدأ التعلم", "Learning started"), cell: (r) => (r.learning_started ? t("نعم", "Yes") : t("لا", "No")) },
    { key: "period", header: t("الفترة", "Period"), cell: (r) => `${formatDate(r.period_start)} → ${formatDate(r.period_end)}` },
  ];
  const seatColumns: Column<Seat>[] = [
    { key: "email", header: t("البريد", "Email"), cell: (r) => <bdi>{r.assigned_email}</bdi> },
    { key: "status", header: t("الحالة", "Status"), cell: (r) => r.status },
    { key: "assigned", header: t("أُسند", "Assigned"), cell: (r) => formatDateTime(r.assigned_at) },
  ];

  const snapshot = (s?.plan_snapshot ?? {}) as Record<string, unknown>;
  const discount = snapshot.discount as { label?: string | null; discount_type?: string; value?: string } | null | undefined;
  const live = s && (s.status === "active" || s.status === "past_due");

  return (
    <>
      <PageHead
        back={{ href: "/subscriptions/subscribers", label: t("المشتركون", "Subscribers") }}
        title={s ? s.customer_name || s.customer_email || t("مشترك", "Subscriber") : t("مشترك", "Subscriber")}
        status={s ? <Badge def={subscriberStatusBadge(s.status)} /> : null}
        sub={s?.customer_email ? <bdi>{s.customer_email}</bdi> : undefined}
        actions={live && can("subscribersManage.manage") ? (
          <>
            {!s.cancel_at_period_end ? <Button sm kind="soft" label={t("إلغاء بنهاية الفترة", "Cancel at period end")} onClick={() => setCancelMode("period_end")} /> : null}
            <Button sm kind="danger" label={t("إلغاء فوري", "Cancel now")} onClick={() => setCancelMode("immediate")} />
          </>
        ) : null}
      />
      <ErrorAlert error={cancel.error} title={t("تعذّر الإلغاء", "Couldn't cancel")} />
      <PageState error={detail.error}>
        {detail.isLoading ? <Loading /> : null}
        {s ? (
          <>
            <div className="ma-cols ma-cols--2">
              <Card title={t("الاشتراك", "Subscription")}>
                <Dl rows={[
                  [t("الباقة", "Plan"), <AppLink key="p" className="ma-link" to={`/subscriptions/plans/${s.plan_id}`}>{s.plan_title ?? s.plan_slug}</AppLink>],
                  [t("العميل", "Customer"), <AppLink key="c" className="ma-link" to={`/customers/${s.customer_id}`}><bdi>{s.customer_email ?? s.customer_id}</bdi></AppLink>],
                  ...(s.company_name ? ([[t("الشركة", "Company"), s.company_name]] as [string, string][]) : []),
                  [t("الفترة الحالية", "Current period"), `${formatDate(s.current_period_start)} → ${formatDate(s.current_period_end)}`],
                  [t("التجديد التلقائي", "Auto-renew"), s.auto_renew && !s.cancel_at_period_end ? t("نعم", "Yes") : t("لا", "No")],
                  ...(s.canceled_at ? ([[t("أُلغي في", "Canceled at"), formatDateTime(s.canceled_at)]] as [string, string][]) : []),
                  [t("اشترك في", "Subscribed"), formatDateTime(s.created_at)],
                  [t("Stripe", "Stripe"), <bdi key="st">{s.stripe_subscription_id ?? "—"}</bdi>],
                ]} />
              </Card>
              <Card title={t("الشروط التي اشترك بها", "Terms they subscribed on")}>
                <Dl rows={[
                  [t("الإصدار", "Version"), `v${s.plan_version}`],
                  [t("النوع", "Type"), t(labelOf(PLAN_TYPE_LABELS, s.plan_type).ar, labelOf(PLAN_TYPE_LABELS, s.plan_type).en)],
                  [t("الفوترة", "Billing"), t(labelOf(INTERVAL_LABELS, s.billing_interval).ar, labelOf(INTERVAL_LABELS, s.billing_interval).en)],
                  [t("السعر الذي يدفعه", "Price they pay"), <strong key="pp">{formatAmount(paidPrice(s), s.currency_code ?? "USD")}</strong>],
                  [t("السعر الأساسي وقتها", "List price then"), formatAmount(toNumber(snapshot.price as string | undefined), s.currency_code ?? "USD")],
                  ...(discount ? ([[t("الخصم", "Discount"), `${discount.label ?? ""} ${discount.discount_type === "percent" ? `${toNumber(discount.value)}%` : formatAmount(toNumber(discount.value), s.currency_code ?? "USD")}`.trim()]] as [string, string][]) : []),
                  ...(snapshot.selection_allowance != null ? ([[t("عدد الدورات المسموح", "Courses allowed"), String(snapshot.selection_allowance)]] as [string, string][]) : []),
                  [t("المقاعد", "Seats"), String(s.seat_limit)],
                ]} />
              </Card>
            </div>
            {s.selections?.length ? (
              <Card flush title={t("الدورات المختارة", "Selected courses")}>
                <DataTable columns={selectionColumns} rows={s.selections} />
              </Card>
            ) : null}
            {s.seats?.length ? (
              <Card flush title={t("المقاعد", "Seats")}>
                <DataTable columns={seatColumns} rows={s.seats} />
              </Card>
            ) : null}
          </>
        ) : null}
      </PageState>
      <ConfirmModal
        open={cancelMode !== null}
        onOpenChange={(open) => !open && setCancelMode(null)}
        title={cancelMode === "immediate" ? t("إلغاء الاشتراك فورًا؟", "Cancel the subscription now?") : t("إلغاء بنهاية الفترة؟", "Cancel at the end of the period?")}
        message={
          cancelMode === "immediate"
            ? t("يفقد المشترك الوصول لكل موارد الباقة الآن ويتوقف التجديد.", "The subscriber loses access to every plan resource now and renewal stops.")
            : t("يبقى الوصول حتى نهاية الفترة الحالية ثم يتوقف التجديد.", "Access continues until the current period ends, then renewal stops.")
        }
        confirmLabel={t("تأكيد الإلغاء", "Confirm cancel")}
        loading={cancel.isPending}
        onConfirm={() => cancel.mutate(cancelMode === "immediate")}
      />
    </>
  );
}
