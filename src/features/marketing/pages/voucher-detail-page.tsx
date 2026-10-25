import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { revokeVoucher, setVoucherExpiry, vouchersKeys, vouchersQueries, type VoucherTransaction } from "@/lib/api";
import { formatDate, formatDateTime, formatMinor, formatNumber } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { AppLink } from "@/components/ui/app-link";
import { Badge, Button, Card, Dl, ErrorAlert, Field, FormActions, Kpi, Loading, PageHead } from "@/components/ui/kit";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageState } from "@/components/ui/primitives";

import { VOUCHER_TXN_LABELS, voucherStatusBadge } from "../lib/coupons";

export default function VoucherDetailPage() {
  const t = useT();
  const lang = useLang();
  const { voucherId = "" } = useParams();
  const queryClient = useQueryClient();
  const voucher = useQuery(vouchersQueries.detail(voucherId));
  const v = voucher.data;
  const [expiry, setExpiry] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const editable = can("coupons.write") && (v?.status === "active" || v?.status === "expired");

  const refresh = () => queryClient.invalidateQueries({ queryKey: vouchersKeys.all });
  const saveExpiry = useMutation({
    mutationFn: (date: string) => setVoucherExpiry(voucherId, date ? `${date}T23:59:59Z` : null),
    onSuccess: () => { setExpiry(null); refresh(); },
  });
  const expireNow = useMutation({
    mutationFn: () => setVoucherExpiry(voucherId, new Date(Date.now() - 60_000).toISOString()),
    onSuccess: refresh,
  });
  const revoke = useMutation({
    mutationFn: () => revokeVoucher(voucherId),
    onSuccess: () => { setConfirmRevoke(false); refresh(); },
  });

  const columns: Column<VoucherTransaction>[] = [
    { key: "at", header: t("التاريخ", "Date"), cell: (r) => formatDateTime(r.created_at) },
    { key: "type", header: t("الحركة", "Entry"), cell: (r) => VOUCHER_TXN_LABELS[r.txn_type]?.[lang] ?? r.txn_type },
    { key: "amount", header: t("المبلغ", "Amount"), align: "end", cell: (r) => <span className="ma-num">{formatMinor(r.amount_minor, v?.currency_code)}</span> },
    { key: "after", header: t("المتاح بعدها", "Available after"), align: "end", cell: (r) => <span className="ma-num">{formatMinor(r.balance_after_minor, v?.currency_code)}</span> },
    { key: "order", header: t("الطلب", "Order"), cell: (r) => (r.order_id ? <AppLink className="ma-link ma-num" to={`/sales/orders/${r.order_id}`}>{r.order_id.slice(0, 8)}</AppLink> : r.note ?? "—") },
  ];

  return (
    <>
      <PageHead
        title={v ? <span className="ma-num">{v.code}</span> : t("قسيمة رصيد", "Voucher")}
        status={v ? <Badge def={voucherStatusBadge(v.status)} /> : null}
        sub={v ? <bdi>{v.customer_email ?? v.customer_id}</bdi> : undefined}
        back={{ href: "/sales/vouchers", label: t("قسائم الرصيد", "Vouchers") }}
        actions={
          editable ? (
            <>
              {v?.status === "active" ? <Button label={t("إنهاء الآن", "Expire now")} disabled={expireNow.isPending} onClick={() => expireNow.mutate()} /> : null}
              <Button kind="ghost" icon="x" label={t("إلغاء القسيمة", "Revoke")} onClick={() => setConfirmRevoke(true)} />
            </>
          ) : null
        }
      />
      <ErrorAlert error={saveExpiry.error ?? expireNow.error ?? revoke.error} title={t("تعذّر تحديث القسيمة", "Couldn't update the voucher")} />
      <PageState error={voucher.error}>
        {voucher.isLoading ? <Loading /> : null}
        {v ? (
          <>
            <div className="ma-kpis">
              <Kpi label={t("القيمة", "Value")} value={formatMinor(v.initial_amount_minor, v.currency_code)} icon="tag" />
              <Kpi label={t("المستخدم", "Spent")} value={formatMinor(v.used_minor, v.currency_code)} meta={t(`في ${formatNumber(v.orders)} طلب`, `on ${formatNumber(v.orders)} orders`)} icon="cart" />
              <Kpi label={t("المتاح", "Available")} value={formatMinor(v.spendable_minor, v.currency_code)} meta={v.reserved_minor ? t(`${formatMinor(v.reserved_minor)} محجوز`, `${formatMinor(v.reserved_minor)} held`) : undefined} icon="card" />
            </div>
            <div className="ma-cols ma-cols--main-side">
              <Card title={t("الحركات", "Ledger")} flush>
                <DataTable rows={v.transactions ?? []} columns={columns} empty={t("لا حركات.", "No entries.")} />
              </Card>
              <Card title={t("التفاصيل", "Details")}>
                <Dl
                  rows={[
                    [t("العميل", "Customer"), <AppLink key="c" className="ma-link" to={`/customers/${v.customer_id}`}>{v.customer_name || v.customer_email}</AppLink>],
                    [t("تنتهي", "Expires"), v.expires_at ? formatDate(v.expires_at) : t("بلا انتهاء", "Never")],
                    [t("المصدر", "Source"), v.source],
                    [t("أُصدرت", "Issued"), formatDateTime(v.created_at)],
                    [t("ملاحظة", "Note"), v.note ?? "—"],
                  ]}
                />
                {editable ? (
                  <form className="ma-form" style={{ marginBlockStart: "var(--space-4)" }} onSubmit={(e) => { e.preventDefault(); if (expiry !== null) saveExpiry.mutate(expiry); }}>
                    <Field id="voucher-expiry" type="date" label={t("تاريخ انتهاء جديد", "New expiry")} value={expiry ?? v.expires_at?.slice(0, 10) ?? ""} onChange={setExpiry} />
                    <FormActions>
                      <Button type="submit" sm kind="primary" disabled={expiry === null || saveExpiry.isPending} label={t("حفظ", "Save")} />
                    </FormActions>
                  </form>
                ) : null}
              </Card>
            </div>
          </>
        ) : null}
      </PageState>
      <ConfirmModal
        open={confirmRevoke}
        onOpenChange={setConfirmRevoke}
        title={t("إلغاء القسيمة؟", "Revoke this voucher?")}
        message={t("لن يستطيع العميل استخدام الرصيد المتبقي.", "The customer can no longer spend what is left.")}
        confirmLabel={t("إلغاء القسيمة", "Revoke")}
        loading={revoke.isPending}
        onConfirm={() => revoke.mutate()}
      />
    </>
  );
}
