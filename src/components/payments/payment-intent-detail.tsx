import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { paymentsKeys, paymentsQueries, reconcilePaymentIntent } from "@/lib/api";
import { formatDateTime, formatMinor } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { orderStatusBadge, paymentStatusBadge } from "@/lib/status";
import { AppLink } from "@/components/ui/app-link";
import { Badge, Button, Dl, ErrorAlert, Loading } from "@/components/ui/kit";
import { DataTable } from "@/components/ui/data-table";
import { PageState } from "@/components/ui/primitives";
import { SourceBadge } from "@/components/ui/source-badge";
import { customerHref, isLegacy, orderHref, shortRef } from "@/lib/refs";

/**
 * The body of a payment intent: amount, FX rate, every gateway attempt and its refunds. Shared by
 * the payments list drawer and the standalone payment detail route.
 */
/** `paymentIntentId` is a payment ref (`b2c:<payment_intent_id>` or `legacy:order:<id>`). */
export function PaymentIntentDetail({ paymentIntentId }: { paymentIntentId: string }) {
  const t = useT();
  const queryClient = useQueryClient();
  const intent = useQuery(paymentsQueries.intent(paymentIntentId));
  const reconcile = useMutation({
    mutationFn: () => reconcilePaymentIntent(paymentIntentId),
    onSuccess: (data) => {
      queryClient.setQueryData(paymentsKeys.intent(paymentIntentId), data);
      return queryClient.invalidateQueries({ queryKey: paymentsKeys.all });
    },
  });

  const data = intent.data;
  const attempts = data?.attempts ?? [];
  const refunds = data?.refunds ?? [];

  return (
    <PageState error={intent.error ?? reconcile.error}>
      {data ? (
        <>
          <Dl
            rows={[
              [t("المبلغ", "Amount"), <span className="ma-num" key="a">{formatMinor(data.amount_minor, data.currency_code)}</span>],
              [t("المسترد", "Refunded"), <span className="ma-num" key="r">{formatMinor(data.refunded_minor ?? 0, data.currency_code)}</span>],
              [t("البوابة", "Gateway"), data.provider],
              [t("حالة الدفع", "Payment status"), <Badge key="s" def={paymentStatusBadge(data.status)} />],
              [t("حالة الطلب", "Order status"), <Badge key="o" def={orderStatusBadge(data.order_status)} />],
              [t("النظام", "System"), <SourceBadge key="src" source={data.source} />],
              [
                t("العميل", "Customer"),
                data.customer_id || data.legacy_user_id ? (
                  <AppLink
                    key="c"
                    className="ma-link"
                    to={customerHref(data.customer_id ? `b2c:${data.customer_id}` : `legacy:user:${data.legacy_user_id}`)}
                  >
                    {data.customer_email ?? data.customer_id ?? `#${data.legacy_user_id}`}
                  </AppLink>
                ) : (
                  data.customer_email ?? "—"
                ),
              ],
              [
                t("الطلب", "Order"),
                data.order_ref ? (
                  <AppLink key="id" className="ma-link" to={orderHref(data.order_ref)}>
                    <bdi className="ma-num">{shortRef(data.order_ref)}</bdi>
                  </AppLink>
                ) : (
                  "—"
                ),
              ],
              [t("مرجع البوابة", "Gateway reference"), <bdi key="ref">{data.provider_reference ?? "—"}</bdi>],
              [
                t("سعر الصرف", "FX rate"),
                data.fx_rate ? <bdi key="fx">1 {data.fx_base_currency} = {data.fx_rate} {data.currency_code}</bdi> : t("بدون تحويل", "not converted"),
              ],
              [t("أُنشئ", "Created"), formatDateTime(data.created_at)],
              [t("آخر تحديث", "Updated"), formatDateTime(data.updated_at)],
            ]}
          />

          <h3 className="ma-subhead">{t("محاولات الدفع", "Gateway attempts")}</h3>
          <DataTable
            rows={attempts}
            exportConfig={false}
            empty={t("لا محاولات.", "No attempts.")}
            columns={[
              { key: "when", header: t("التاريخ", "When"), cell: (row) => formatDateTime(row.created_at) },
              { key: "status", header: t("الحالة", "Status"), cell: (row) => <Badge def={paymentStatusBadge(row.status)} /> },
              {
                key: "ref",
                header: t("المرجع", "Reference"),
                cell: (row) => (
                  <>
                    <bdi className="ma-cell-sub">{row.provider_payment_id ?? row.provider_session_id ?? "—"}</bdi>
                    {row.failure_message || row.failure_code ? <span className="ma-cell-sub">{row.failure_message ?? row.failure_code}</span> : null}
                  </>
                ),
              },
            ]}
          />

          {refunds.length ? (
            <>
              <h3 className="ma-subhead">{t("الاستردادات", "Refunds")}</h3>
              <DataTable
                rows={refunds}
                exportConfig={false}
                columns={[
                  { key: "when", header: t("التاريخ", "When"), cell: (row) => formatDateTime(row.created_at) },
                  { key: "amount", header: t("المبلغ", "Amount"), align: "end", cell: (row) => formatMinor(row.amount_minor, row.currency_code) },
                  { key: "status", header: t("الحالة", "Status"), cell: (row) => row.status },
                ]}
              />
            </>
          ) : null}

          {isLegacy(data) ? (
            <p className="ma-note ma-section-gap">
              {t("دفعة من النظام القديم: للعرض فقط.", "Legacy platform payment: read-only.")}
            </p>
          ) : (
          <div className="ma-section-gap">
            <ErrorAlert error={reconcile.error} />
            <Button
              kind="primary"
              label={t("مزامنة مع البوابة", "Re-check with gateway")}
              icon="refresh"
              disabled={reconcile.isPending}
              className={reconcile.isPending ? "is-loading" : undefined}
              onClick={() => reconcile.mutate()}
            />
          </div>
          )}
        </>
      ) : (
        <Loading />
      )}
    </PageState>
  );
}
