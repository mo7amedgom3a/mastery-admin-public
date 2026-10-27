import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { decideRefundCase, reconcileRefundCase, refundCaseKeys, refundCasesQueries, type RefundCaseDetail, type RefundCaseEvent, type RefundDecisionAction } from "@/lib/api";
import { formatDateTime, formatMinor } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { customerHref, orderHref, productHref, refParam, shortRef } from "@/lib/refs";
import { refundCaseStatusBadge, refundEventLabel, refundReasonLabel } from "@/lib/status";
import { AppLink } from "@/components/ui/app-link";
import { Alert, Badge, Button, Card, Dl, ErrorAlert, Field, FormActions, Loading, PageHead } from "@/components/ui/kit";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { PageState } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { useCan } from "@/lib/permissions";

const IN_FLIGHT = ["processing", "pending", "requires_action", "needs_reconciliation"];
const MIN_REASON = 5;

function eventNote(event: RefundCaseEvent): string | null {
  try {
    const detail = JSON.parse(event.detail_json) as Record<string, unknown>;
    if (typeof detail.reason === "string") return detail.reason;
    if (typeof detail.status === "string") return [detail.status, detail.provider_refund_id].filter(Boolean).join(" · ");
    if (typeof detail.error === "string") return detail.error;
    return null;
  } catch {
    return null;
  }
}

function DecisionCard({ data }: { data: RefundCaseDetail }) {
  const t = useT();
  const client = useQueryClient();
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [confirming, setConfirming] = useState<RefundDecisionAction | null>(null);
  const canDecide = useCan("refunds.write");
  const eligibility = data.current_eligibility;
  const max = Math.min(data.requested_minor, eligibility.remaining_minor ?? data.requested_minor);
  const amountMinor = amount === "" ? undefined : Math.round(Number(amount) * 100);
  const amountInvalid = amountMinor !== undefined && (!(amountMinor > 0) || amountMinor > max);
  const reasonReady = reason.trim().length >= MIN_REASON;

  const refresh = () => client.invalidateQueries({ queryKey: refundCaseKeys.all });
  const decision = useMutation({
    mutationFn: (action: RefundDecisionAction) => decideRefundCase(data.case_id, action, reason.trim(), action === "approve" ? amountMinor : undefined),
    onSuccess: async (result, action) => {
      setConfirming(null);
      toast.success(
        action === "reject"
          ? t("تم رفض الطلب وإبلاغ العميل.", "Request rejected and the customer notified.")
          : t(`تمت الموافقة. حالة الاسترداد: ${result.status}`, `Approved. Refund status: ${result.status}`),
      );
      await refresh();
    },
    onError: () => setConfirming(null),
  });
  const reconcile = useMutation({
    mutationFn: () => reconcileRefundCase(data.case_id),
    onSuccess: async (result) => {
      toast.success(t(`تمت المطابقة. الحالة: ${result.status}`, `Reconciled. Status: ${result.status}`));
      await refresh();
    },
  });

  if (!canDecide && (IN_FLIGHT.includes(data.status) || data.status === "requested")) {
    return (
      <Card title={t("القرار", "Decision")}>
        <p className="ma-note">
          {t("قرارات الاسترداد تتطلب صلاحية الاسترداد.", "Refund decisions need the refund permission.")}
        </p>
      </Card>
    );
  }

  if (IN_FLIGHT.includes(data.status)) {
    return (
      <Card title={t("التنفيذ لدى البوابة", "Gateway settlement")}>
        <p className="ma-note">
          {t("تمت الموافقة على الطلب وننتظر تأكيد البوابة. يمكنك إعادة المطابقة إذا تأخر التحديث.", "The request is approved and awaiting gateway confirmation. Re-check if the update is late.")}
        </p>
        <ErrorAlert error={reconcile.error} />
        <FormActions>
          <Button
            kind="secondary"
            icon="refresh"
            label={t("مطابقة مع البوابة", "Re-check with gateway")}
            disabled={reconcile.isPending}
            className={reconcile.isPending ? "is-loading" : undefined}
            onClick={() => reconcile.mutate()}
          />
        </FormActions>
      </Card>
    );
  }

  if (data.status !== "requested") {
    return (
      <Card title={t("القرار", "Decision")}>
        <Dl
          rows={[
            [t("الحالة", "Status"), <Badge key="s" def={refundCaseStatusBadge(data.status)} />],
            [t("تاريخ القرار", "Decided"), data.decided_at ? formatDateTime(data.decided_at) : "—"],
            [t("سبب القرار", "Reason"), data.decision_reason ?? "—"],
            [t("المبلغ المعتمد", "Approved amount"), data.approved_minor != null ? <span key="a" className="ma-num">{formatMinor(data.approved_minor, data.currency_code)}</span> : "—"],
          ]}
        />
      </Card>
    );
  }

  const open = (action: RefundDecisionAction) => (event?: FormEvent) => {
    event?.preventDefault();
    if (reasonReady && !amountInvalid) setConfirming(action);
  };
  const confirmAmount = formatMinor(amountMinor ?? data.requested_minor, data.currency_code);
  return (
    <Card title={t("القرار", "Decision")}>
      {!eligibility.eligible ? (
        <Alert kind="warning" title={t("غير مؤهل حاليًا", "Not eligible right now")}>
          {t("لا يمكن الموافقة على الطلب، ويمكنك رفضه مع توضيح السبب للعميل.", "It can't be approved; you can reject it and explain why to the customer.")}
        </Alert>
      ) : null}
      <form className="ma-form" onSubmit={open("approve")} noValidate>
        <Field
          id="refund-decision-reason"
          type="textarea"
          label={t("سبب القرار", "Decision reason")}
          hint={t(`${MIN_REASON} أحرف على الأقل. يظهر للعميل عند الرفض.`, `At least ${MIN_REASON} characters. Shown to the customer when rejected.`)}
          value={reason}
          onChange={setReason}
          required
          rows={4}
          maxLength={2000}
        />
        <Field
          id="refund-decision-amount"
          type="number"
          label={t(`المبلغ المعتمد (${data.currency_code})`, `Approved amount (${data.currency_code})`)}
          hint={
            amountInvalid
              ? t(`أدخل مبلغًا بين 0.01 و ${max / 100}.`, `Enter an amount between 0.01 and ${max / 100}.`)
              : t(`اتركه فارغًا لاعتماد المبلغ المطلوب (${formatMinor(data.requested_minor, data.currency_code)}).`, `Leave blank to approve the requested ${formatMinor(data.requested_minor, data.currency_code)}.`)
          }
          value={amount}
          onChange={setAmount}
          min="0.01"
          step="0.01"
          max={max / 100}
          dir="ltr"
          aria-invalid={amountInvalid || undefined}
        />
        <ErrorAlert error={decision.error} />
        <FormActions>
          <Button
            type="submit"
            kind="primary"
            icon="check"
            label={t("موافقة واسترداد", "Approve & refund")}
            disabled={decision.isPending || !reasonReady || amountInvalid || !eligibility.eligible}
          />
          <Button kind="danger" icon="x" label={t("رفض", "Reject")} disabled={decision.isPending || !reasonReady} onClick={() => open("reject")()} />
        </FormActions>
      </form>

      <ConfirmModal
        open={confirming === "approve"}
        onOpenChange={(next) => !next && setConfirming(null)}
        tone="primary"
        title={t("تأكيد الاسترداد", "Confirm refund")}
        message={t(`سيُعاد ${confirmAmount} إلى وسيلة الدفع الأصلية عبر ${data.provider}، ويُلغى وصول العميل إلى المنتج.`, `${confirmAmount} will be returned to the original payment method via ${data.provider}, and the customer's access to the product removed.`)}
        confirmLabel={t("تنفيذ الاسترداد", "Refund now")}
        loading={decision.isPending}
        onConfirm={() => decision.mutate("approve")}
      />
      <ConfirmModal
        open={confirming === "reject"}
        onOpenChange={(next) => !next && setConfirming(null)}
        tone="danger"
        title={t("رفض الطلب", "Reject request")}
        message={t("سيُبلَّغ العميل بالرفض وبالسبب الذي كتبته. لا يمكن التراجع عن القرار.", "The customer will be told it was rejected, with your reason. This can't be undone.")}
        confirmLabel={t("رفض الطلب", "Reject")}
        loading={decision.isPending}
        onConfirm={() => decision.mutate("reject")}
      />
    </Card>
  );
}

export default function RefundCaseDetailPage() {
  const t = useT();
  const { id: rawId } = useParams<{ id: string }>();
  const id = refParam(rawId);
  const detail = useQuery(refundCasesQueries.detail(id));
  const data = detail.data;
  const eligibility = data?.current_eligibility;

  return (
    <>
      <PageHead
        back={{ href: "/sales/refunds", label: t("الاستردادات", "Refunds") }}
        title={t("طلب استرداد", "Refund request")}
        status={data ? <Badge def={refundCaseStatusBadge(data.status)} /> : undefined}
        sub={<bdi className="ma-num">{shortRef(id)}</bdi>}
      />
      <PageState error={detail.error}>
        {data && eligibility ? (
          <div className="ma-cols ma-cols--main-side">
            <div className="ma-stack">
              <Card title={t("الطلب", "Request")}>
                <Dl
                  rows={[
                    [t("العميل", "Customer"), <AppLink key="c" className="ma-link" to={customerHref(`b2c:${data.customer_id}`)}><bdi>{data.customer_email}</bdi></AppLink>],
                    [t("الطلب", "Order"), <AppLink key="o" className="ma-link" to={orderHref(`b2c:${data.order_id}`)}><bdi className="ma-num">{shortRef(data.order_id)}</bdi></AppLink>],
                    [t("المنتج", "Product"), <AppLink key="p" className="ma-link" to={productHref(`b2c:${data.product_id}`)}><bdi>{data.slug}</bdi> · {data.product_type}</AppLink>],
                    [t("المبلغ المطلوب", "Requested"), <span key="r" className="ma-num">{formatMinor(data.requested_minor, data.currency_code)}</span>],
                    [t("تاريخ الطلب", "Requested on"), formatDateTime(data.created_at)],
                    [t("سبب العميل", "Customer reason"), data.customer_reason],
                  ]}
                />
              </Card>

              <Card title={t("الأهلية الآن", "Eligibility now")}>
                <Dl
                  rows={[
                    [
                      t("النتيجة", "Result"),
                      <Badge
                        key="e"
                        def={eligibility.eligible ? { label: { ar: "مؤهل", en: "Eligible" }, tone: "success" } : { label: { ar: "غير مؤهل", en: "Not eligible" }, tone: "danger" }}
                      />,
                    ],
                    [
                      t("الأسباب", "Reasons"),
                      eligibility.reasons.length ? eligibility.reasons.map((code) => { const label = refundReasonLabel(code); return t(label.ar, label.en); }).join(" · ") : "—",
                    ],
                    [t("المتبقي القابل للاسترداد", "Refundable remaining"), eligibility.remaining_minor != null ? <span key="m" className="ma-num">{formatMinor(eligibility.remaining_minor, data.currency_code)}</span> : "—"],
                    [t("الموارد", "Resources"), eligibility.resources?.length ? eligibility.resources.map((r) => `${r.resource_type} ${shortRef(r.resource_id)}`).join(" · ") : "—"],
                    [t("أثر النقاط", "Points impact"), eligibility.points_impact ? `${t("إعادة", "Restore")} ${eligibility.points_impact.restore_used} · ${t("عكس", "Reverse")} ${eligibility.points_impact.reverse_earned}` : "—"],
                  ]}
                />
              </Card>

              <Card title={t("البوابة", "Gateway")}>
                {data.provider_error ? (
                  <Alert kind="danger" title={t("خطأ من البوابة", "Gateway error")}>
                    {data.provider_error}
                  </Alert>
                ) : null}
                <Dl
                  rows={[
                    [t("البوابة", "Gateway"), data.provider],
                    [t("مرجع الاسترداد", "Refund reference"), <bdi key="ref">{data.provider_refund_id ?? "—"}</bdi>],
                    [t("اكتمل", "Completed"), data.completed_at ? formatDateTime(data.completed_at) : "—"],
                  ]}
                />
              </Card>

              <Card title={t("سجل الأحداث", "Timeline")}>
                <ol className="ma-timeline">
                  {data.events.map((event, index) => {
                    const label = refundEventLabel(event.event_type);
                    const note = eventNote(event);
                    return (
                      <li key={`${event.created_at}-${index}`}>
                        <strong>{t(label.ar, label.en)}</strong>
                        <span className="ma-help">{formatDateTime(event.created_at)}</span>
                        {note ? <span>{note}</span> : null}
                      </li>
                    );
                  })}
                </ol>
              </Card>
            </div>
            <DecisionCard data={data} />
          </div>
        ) : (
          <Loading />
        )}
      </PageState>
    </>
  );
}
