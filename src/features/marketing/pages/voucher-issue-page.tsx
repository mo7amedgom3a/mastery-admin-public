import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { issueBulkVouchers, issueVoucher, previewVoucherSegment, vouchersKeys, type VoucherSegment } from "@/lib/api";
import { formatMinor, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { Alert, Button, Card, ErrorAlert, Field, FormActions, PageHead } from "@/components/ui/kit";
import { ConfirmModal } from "@/components/ui/confirm-modal";

const toMinor = (major: string) => Math.round(Number(major) * 100);
const endOfDay = (date: string) => (date ? `${date}T23:59:59Z` : null);

function VoucherFields({ amount, setAmount, expires, setExpires, note, setNote }: {
  amount: string; setAmount: (v: string) => void; expires: string; setExpires: (v: string) => void; note: string; setNote: (v: string) => void;
}) {
  const t = useT();
  return (
    <>
      <div className="ma-form-grid ma-form-grid--2">
        <Field id="voucher-amount" type="number" label={t("قيمة القسيمة (USD)", "Voucher value (USD)")} min={1} step="0.01" dir="ltr" required value={amount} onChange={setAmount} />
        <Field id="voucher-expires" type="date" label={t("تنتهي", "Expires")} hint={t("فارغ = بلا انتهاء.", "Empty = never.")} value={expires} onChange={setExpires} />
      </div>
      <Field id="voucher-note" type="textarea" rows={2} label={t("ملاحظة", "Note")} value={note} onChange={setNote} />
    </>
  );
}

function SingleIssue() {
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [expires, setExpires] = useState("");
  const [note, setNote] = useState("");

  const issue = useMutation({
    mutationFn: () => issueVoucher({ email: email.trim(), amount_minor: toMinor(amount), expires_at: endOfDay(expires), note: note.trim() || null }),
    onSuccess: (voucher) => {
      queryClient.invalidateQueries({ queryKey: vouchersKeys.all });
      navigate(`/sales/vouchers/${voucher.voucher_id}`);
    },
  });
  const disabled = issue.isPending || !email.trim() || !(Number(amount) > 0);

  return (
    <Card title={t("لعميل واحد", "One customer")}>
      <form className="ma-form ma-form--narrow" onSubmit={(e) => { e.preventDefault(); if (!disabled) issue.mutate(); }}>
        <Field id="voucher-email" type="email" label={t("بريد العميل", "Customer email")} dir="ltr" required value={email} onChange={setEmail} />
        <VoucherFields amount={amount} setAmount={setAmount} expires={expires} setExpires={setExpires} note={note} setNote={setNote} />
        <ErrorAlert error={issue.error} title={t("تعذّر إصدار القسيمة", "Couldn't issue the voucher")} />
        <FormActions>
          <Button type="submit" kind="primary" icon="check" disabled={disabled} label={issue.isPending ? t("جارٍ الإصدار…", "Issuing…") : t("إصدار القسيمة", "Issue voucher")} />
        </FormActions>
      </form>
    </Card>
  );
}

function BulkIssue() {
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [minSpend, setMinSpend] = useState("300");
  const [minOrders, setMinOrders] = useState("1");
  const [since, setSince] = useState("");
  const [amount, setAmount] = useState("");
  const [expires, setExpires] = useState("");
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState(false);

  const segment: VoucherSegment = {
    min_spend_minor: toMinor(minSpend || "0"),
    min_orders: Number.parseInt(minOrders || "1", 10),
    paid_since: since ? `${since}T00:00:00Z` : null,
  };
  const preview = useMutation({ mutationFn: () => previewVoucherSegment(segment) });
  const bulk = useMutation({
    mutationFn: () => issueBulkVouchers({ segment, voucher: { amount_minor: toMinor(amount), expires_at: endOfDay(expires), note: note.trim() || null } }),
    onSuccess: () => {
      setConfirm(false);
      queryClient.invalidateQueries({ queryKey: vouchersKeys.all });
      navigate("/sales/vouchers");
    },
  });
  const matched = preview.data?.total ?? 0;

  return (
    <Card title={t("حسب الإنفاق", "By customer spend")}>
      <div className="ma-form">
        <div className="ma-form-grid ma-form-grid--2">
          <Field id="seg-spend" type="number" label={t("إجمالي المشتريات ≥ (USD)", "Lifetime spend ≥ (USD)")} min={0} dir="ltr" value={minSpend} onChange={(v) => { setMinSpend(v); preview.reset(); }} />
          <Field id="seg-orders" type="number" label={t("عدد الطلبات المدفوعة ≥", "Paid orders ≥")} min={1} dir="ltr" value={minOrders} onChange={(v) => { setMinOrders(v); preview.reset(); }} />
          <Field id="seg-since" type="date" label={t("طلبات منذ", "Orders since")} hint={t("فارغ = كل الوقت.", "Empty = all time.")} value={since} onChange={(v) => { setSince(v); preview.reset(); }} />
        </div>
        <FormActions>
          <Button icon="users" label={preview.isPending ? t("جارٍ العدّ…", "Counting…") : t("معاينة العملاء", "Preview customers")} disabled={preview.isPending} onClick={() => preview.mutate()} />
        </FormActions>
        <ErrorAlert error={preview.error} title={t("تعذّرت المعاينة", "Couldn't preview")} />
        {preview.data ? (
          <Alert kind={matched ? "info" : "warning"} title={t(`${formatNumber(matched)} عميل يطابق`, `${formatNumber(matched)} customers match`)}>
            {preview.data.sample.length ? (
              <ul style={{ margin: 0, paddingInlineStart: "1.2em" }}>
                {preview.data.sample.map((c) => (
                  <li key={c.customer_id}><bdi>{c.email ?? c.customer_id}</bdi> — {formatMinor(c.spend_minor)} · {formatNumber(c.paid_orders)} {t("طلب", "orders")}</li>
                ))}
              </ul>
            ) : null}
          </Alert>
        ) : null}
        {matched ? (
          <>
            <VoucherFields amount={amount} setAmount={setAmount} expires={expires} setExpires={setExpires} note={note} setNote={setNote} />
            <ErrorAlert error={bulk.error} title={t("تعذّر الإصدار", "Couldn't issue")} />
            <FormActions>
              <Button kind="primary" icon="send" disabled={!(Number(amount) > 0) || bulk.isPending} label={t(`إصدار ${formatNumber(matched)} قسيمة`, `Issue ${formatNumber(matched)} vouchers`)} onClick={() => setConfirm(true)} />
            </FormActions>
          </>
        ) : null}
      </div>
      <ConfirmModal
        open={confirm}
        onOpenChange={setConfirm}
        tone="primary"
        title={t("إصدار القسائم؟", "Issue the vouchers?")}
        message={t(
          `سيحصل ${formatNumber(matched)} عميل على قسيمة بقيمة ${formatMinor(toMinor(amount || "0"))}.`,
          `${formatNumber(matched)} customers get a ${formatMinor(toMinor(amount || "0"))} voucher each.`,
        )}
        confirmLabel={t("إصدار", "Issue")}
        loading={bulk.isPending}
        onConfirm={() => bulk.mutate()}
      />
    </Card>
  );
}

export default function VoucherIssuePage() {
  const t = useT();
  const [mode, setMode] = useState<"single" | "bulk">("single");
  return (
    <>
      <PageHead
        title={t("إصدار قسائم رصيد", "Issue vouchers")}
        sub={t("لعميل محدّد، أو لكل من تجاوز إنفاقه مبلغًا معيّنًا.", "To one customer, or to everyone whose spend passed an amount.")}
        back={{ href: "/sales/vouchers", label: t("قسائم الرصيد", "Vouchers") }}
      />
      <nav className="ma-tabs mb-4" aria-label={t("طريقة الإصدار", "Issue mode")}>
        <button type="button" aria-selected={mode === "single"} onClick={() => setMode("single")}>{t("عميل واحد", "One customer")}</button>
        <button type="button" aria-selected={mode === "bulk"} onClick={() => setMode("bulk")}>{t("حسب الإنفاق", "By spend")}</button>
      </nav>
      {mode === "single" ? <SingleIssue /> : <BulkIssue />}
    </>
  );
}
