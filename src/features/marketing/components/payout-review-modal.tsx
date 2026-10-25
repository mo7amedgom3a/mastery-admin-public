import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  affiliatesKeys,
  affiliatesQueries,
  approveAffiliatePayout,
  payAffiliatePayout,
  rejectAffiliatePayout,
  type PayoutReview,
} from "@/lib/api";
import { formatDateTime, formatMinor } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { AppLink } from "@/components/ui/app-link";
import { Alert, Badge, Button, Dl, ErrorAlert, Field, Kpi, Loading } from "@/components/ui/kit";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";

import { payoutMethodLabel, payoutStatusBadge } from "../lib/affiliates";

type Action = "approve" | "reject" | "pay" | null;
type PayMode = "amount" | "percent";

function CopyValue({ value }: { value: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  return (
    <span style={{ display: "inline-flex", gap: "var(--space-1)", alignItems: "center", flexWrap: "wrap" }}>
      <bdi dir="ltr" className="ma-num" style={{ wordBreak: "break-all" }}>{value}</bdi>
      <Button
        sm
        kind="ghost"
        icon={copied ? "check" : "copy"}
        aria-label={t("نسخ", "Copy")}
        onClick={() => {
          void navigator.clipboard?.writeText(value);
          setCopied(true);
        }}
      />
    </span>
  );
}

function Destination({ review }: { review: PayoutReview }) {
  const t = useT();
  const lang = useLang();
  const d = review.payout.details;
  if (!d) return <p className="ma-help">{t("لا توجد بيانات دفع محفوظة.", "No payout details saved.")}</p>;
  const rows: [string, string | null | undefined][] = [
    [t("البريد", "Email"), d.email],
    [t("اسم صاحب الحساب", "Account name"), d.account_name],
    ["IBAN", d.iban],
    [t("البنك", "Bank"), d.bank_name],
    ["SWIFT", d.swift],
    [t("الدولة", "Country"), d.country],
    [t("تعليمات", "Instructions"), d.instructions],
  ];
  return (
    <Dl
      rows={[
        [t("طريقة الدفع", "Method"), payoutMethodLabel(d.method, lang)],
        ...rows.filter(([, v]) => v).map(([k, v]) => [k, <CopyValue key={k} value={v as string} />] as [string, ReactNode]),
      ]}
    />
  );
}

function PayForm({
  review,
  pending,
  onSubmit,
  onCancel,
}: {
  review: PayoutReview;
  pending: boolean;
  onSubmit: (body: { amount_minor?: number; percent?: number; payment_reference: string; note?: string }) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const requested = review.payout.requested_minor;
  const [mode, setMode] = useState<PayMode>("amount");
  const [amount, setAmount] = useState(String(requested / 100));
  const [percent, setPercent] = useState("100");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  const paidMinor =
    mode === "amount"
      ? Math.round(Number(amount) * 100)
      : Math.round((requested * Number(percent)) / 100);
  const valid = Number.isFinite(paidMinor) && paidMinor > 0 && paidMinor <= requested && reference.trim().length > 0;
  const aboveLedger = paidMinor > review.balance.available_minor + review.balance.held_minor;

  return (
    <form
      className="ma-stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        onSubmit({
          ...(mode === "amount" ? { amount_minor: paidMinor } : { percent: Number(percent) }),
          payment_reference: reference.trim(),
          note: note.trim() || undefined,
        });
      }}
    >
      <nav className="ma-tabs" aria-label={t("طريقة تحديد المبلغ", "Amount mode")}>
        <button type="button" aria-selected={mode === "amount"} onClick={() => setMode("amount")}>{t("مبلغ", "Amount")}</button>
        <button type="button" aria-selected={mode === "percent"} onClick={() => setMode("percent")}>{t("نسبة مئوية", "Percentage")}</button>
      </nav>
      {mode === "amount" ? (
        <Field
          id="pay-amount"
          type="number"
          label={t("المبلغ المحوّل (USD)", "Amount paid (USD)")}
          value={amount}
          onChange={setAmount}
          min={0.01}
          max={requested / 100}
          step="0.01"
          required
        />
      ) : (
        <Field
          id="pay-percent"
          type="number"
          label={t("نسبة من المبلغ المطلوب (%)", "Percent of the request (%)")}
          value={percent}
          onChange={setPercent}
          min={0.01}
          max={100}
          step="0.01"
          required
        />
      )}
      <Alert kind={paidMinor < requested ? "info" : "success"} title={t(`يُحوَّل ${formatMinor(Math.max(paidMinor, 0))}`, `Paying ${formatMinor(Math.max(paidMinor, 0))}`)}>
        {paidMinor > 0 && paidMinor < requested
          ? t(
              `يعود ${formatMinor(requested - paidMinor)} إلى رصيد المسوّق المتاح ويمكنه طلبه لاحقاً.`,
              `${formatMinor(requested - paidMinor)} returns to the marketer's available balance and can be requested again.`,
            )
          : t("يُغلق الطلب كمدفوع بالكامل.", "The request closes as fully paid.")}
      </Alert>
      {aboveLedger ? (
        <Alert kind="warning" title={t("المبلغ أكبر من رصيد المسوّق", "Above the marketer's balance")}>
          {t("استُرد جزء من العمولات بعد الطلب. ادفع مبلغاً أقل أو ارفض الطلب.", "Some commission was refunded after the request. Pay less or reject it.")}
        </Alert>
      ) : null}
      <Field
        id="pay-reference"
        label={t("مرجع التحويل", "Payment reference")}
        hint={t("رقم عملية PayPal أو مرجع التحويل البنكي — يظهر للمسوّق.", "PayPal transaction or bank transfer reference — shown to the marketer.")}
        value={reference}
        onChange={setReference}
        maxLength={200}
        required
      />
      <Field id="pay-note" type="textarea" rows={2} label={t("ملاحظة داخلية", "Internal note")} value={note} onChange={setNote} maxLength={2000} />
      <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
        <Button kind="ghost" label={t("رجوع", "Back")} onClick={onCancel} />
        <Button type="submit" kind="primary" icon="card" label={t("تأكيد الدفع", "Confirm payment")} disabled={!valid || pending || aboveLedger} />
      </div>
    </form>
  );
}

/** Review one marketer payout request: details to pay to, the marketer's balance, and approve / reject / pay. */
export function PayoutReviewModal({ payoutId, onClose }: { payoutId: string | null; onClose: () => void }) {
  const t = useT();
  const lang = useLang();
  const queryClient = useQueryClient();
  const [action, setAction] = useState<Action>(null);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const review = useQuery({ ...affiliatesQueries.payout(payoutId ?? ""), enabled: Boolean(payoutId) });
  const canWrite = can("affiliatesWrite.manage");

  const done = (data: PayoutReview, message: string) => {
    queryClient.setQueryData(affiliatesKeys.payout(data.payout.payout_id), data);
    void queryClient.invalidateQueries({ queryKey: affiliatesKeys.all });
    toast.success(message);
    setAction(null);
    setNote("");
    setReason("");
  };
  const approve = useMutation({
    mutationFn: () => approveAffiliatePayout(payoutId!, note.trim()),
    onSuccess: (data) => done(data, t("تم اعتماد الطلب", "Request approved")),
  });
  const reject = useMutation({
    mutationFn: () => rejectAffiliatePayout(payoutId!, reason.trim()),
    onSuccess: (data) => done(data, t("تم رفض الطلب وإعادة المبلغ للرصيد", "Rejected — amount returned to the balance")),
  });
  const pay = useMutation({
    mutationFn: (body: Parameters<typeof payAffiliatePayout>[1]) => payAffiliatePayout(payoutId!, body),
    onSuccess: (data) =>
      done(
        data,
        data.payout.status === "paid"
          ? t("تم تسجيل الدفع", "Payment recorded")
          : t("تم تسجيل الدفع الجزئي", "Partial payment recorded"),
      ),
  });
  const error = approve.error ?? reject.error ?? pay.error;

  const close = () => {
    setAction(null);
    approve.reset();
    reject.reset();
    pay.reset();
    onClose();
  };

  const r = review.data;
  const p = r?.payout;
  const open = p ? p.status === "requested" || p.status === "approved" : false;

  return (
    <Modal open={Boolean(payoutId)} onOpenChange={(next) => (next ? null : close())} size="lg" title={t("مراجعة طلب الصرف", "Review payout request")}>
      {review.isLoading || !r || !p ? (
        review.error ? <ErrorAlert error={review.error} /> : <Loading />
      ) : (
        <div className="ma-stack">
          <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flexWrap: "wrap" }}>
            <Badge def={payoutStatusBadge(p.status)} />
            <AppLink className="ma-link" to={`/marketing/affiliates/${p.partner_id}?tab=payouts`} onClick={close}>
              {p.partner_name || p.partner_email}
            </AppLink>
            <bdi dir="ltr" className="ma-help">{p.partner_email}</bdi>
          </div>

          <div className="ma-kpis">
            <Kpi label={t("المبلغ المطلوب", "Requested")} value={formatMinor(p.requested_minor)} icon="receipt" />
            <Kpi label={t("الرصيد المتاح", "Available")} value={formatMinor(r.balance.available_minor)} meta={t("بعد خصم هذا الطلب", "excluding this request")} icon="card" />
            <Kpi label={t("صُرف سابقاً", "Paid so far")} value={formatMinor(r.balance.paid_total_minor)} icon="check" />
          </div>

          {error ? <ErrorAlert error={error} /> : null}

          <section>
            <h3 className="ma-subhead">{t("بيانات الدفع (وقت الطلب)", "Payout details (at request time)")}</h3>
            <Destination review={r} />
          </section>

          <Dl
            rows={[
              [t("تاريخ الطلب", "Requested"), formatDateTime(p.requested_at)],
              [t("تمت المراجعة", "Reviewed"), formatDateTime(p.reviewed_at)],
              ...(p.paid_minor != null
                ? ([
                    [t("المبلغ المحوّل", "Paid"), formatMinor(p.paid_minor)],
                    [t("عاد إلى الرصيد", "Returned to balance"), formatMinor(p.returned_minor)],
                    [t("مرجع التحويل", "Reference"), p.payment_reference ? <CopyValue key="ref" value={p.payment_reference} /> : "—"],
                    [t("تاريخ الدفع", "Paid at"), formatDateTime(p.paid_at)],
                  ] as [string, ReactNode][])
                : []),
              ...(p.reject_reason ? ([[t("سبب الرفض", "Reject reason"), p.reject_reason]] as [string, string][]) : []),
              ...(p.admin_note ? ([[t("ملاحظة داخلية", "Internal note"), p.admin_note]] as [string, string][]) : []),
              [t("طريقة الدفع", "Method"), payoutMethodLabel(p.method, lang)],
            ]}
          />

          {canWrite && open && action === null ? (
            <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <Button kind="danger" icon="x" label={t("رفض", "Reject")} onClick={() => setAction("reject")} />
              {p.status === "requested" ? (
                <Button icon="check" label={t("اعتماد", "Approve")} onClick={() => setAction("approve")} />
              ) : null}
              <Button kind="primary" icon="card" label={t("تسجيل الدفع", "Record payment")} onClick={() => setAction("pay")} />
            </div>
          ) : null}

          {action === "approve" ? (
            <form className="ma-stack" onSubmit={(e) => { e.preventDefault(); approve.mutate(); }}>
              <Field id="approve-note" type="textarea" rows={2} label={t("ملاحظة داخلية (اختياري)", "Internal note (optional)")} value={note} onChange={setNote} maxLength={2000} />
              <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
                <Button kind="ghost" label={t("رجوع", "Back")} onClick={() => setAction(null)} />
                <Button type="submit" kind="primary" label={t("اعتماد الطلب", "Approve request")} disabled={approve.isPending} />
              </div>
            </form>
          ) : null}

          {action === "reject" ? (
            <form className="ma-stack" onSubmit={(e) => { e.preventDefault(); if (reason.trim().length >= 3) reject.mutate(); }}>
              <Field
                id="reject-reason"
                type="textarea"
                rows={3}
                label={t("سبب الرفض", "Reason")}
                hint={t("يظهر للمسوّق. يعود المبلغ كاملاً إلى رصيده.", "Shown to the marketer. The full amount returns to their balance.")}
                value={reason}
                onChange={setReason}
                minLength={3}
                maxLength={1000}
                required
              />
              <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
                <Button kind="ghost" label={t("رجوع", "Back")} onClick={() => setAction(null)} />
                <Button type="submit" kind="danger" label={t("رفض الطلب", "Reject request")} disabled={reject.isPending || reason.trim().length < 3} />
              </div>
            </form>
          ) : null}

          {action === "pay" ? (
            <PayForm review={r} pending={pay.isPending} onSubmit={(body) => pay.mutate(body)} onCancel={() => setAction(null)} />
          ) : null}
        </div>
      )}
    </Modal>
  );
}
