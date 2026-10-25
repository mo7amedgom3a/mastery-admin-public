import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { affiliatesKeys, affiliatesQueries, listPartnerLedger, type LedgerEntry, type Partner } from "@/lib/api";
import { formatDateTime, formatMinor } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n";
import { Alert, Card, Dl, Kpi, Loading } from "@/components/ui/kit";
import type { Column } from "@/components/ui/data-table";
import { PagedList } from "@/components/ui/paged-list";
import { PageState } from "@/components/ui/primitives";

import { payoutMethodLabel } from "../lib/affiliates";
import { PayoutsList } from "./payouts-list";

/** A marketer's money: balance, where they are paid, their payout requests and the ledger behind it. */
export function PartnerPayouts({ partner }: { partner: Partner }) {
  const t = useT();
  const lang = useLang();
  const balance = useQuery(affiliatesQueries.partnerBalance(partner.partner_id));
  const b = balance.data?.balance;
  const d = balance.data?.details;

  const entryLabel = (row: LedgerEntry) =>
    row.entry_type === "commission"
      ? row.amount_minor >= 0 ? t("عمولة معتمدة", "Approved commission") : t("استرداد عمولة", "Commission reversed")
      : row.entry_type === "payout" ? t("صرف", "Payout") : t("تسوية يدوية", "Adjustment");
  const columns: Column<LedgerEntry>[] = [
    { key: "at", header: t("التاريخ", "Date"), exportKind: "datetime", exportValue: (r) => r.created_at ?? null, cell: (r) => formatDateTime(r.created_at) },
    { key: "type", header: t("الحركة", "Entry"), exportValue: entryLabel, cell: entryLabel },
    { key: "ref", header: t("المرجع", "Reference"), exportValue: (r) => r.tolt_commission_id ?? r.note ?? "", cell: (r) => <bdi dir="ltr" className="ma-num">{r.tolt_commission_id?.slice(0, 14) ?? r.note ?? "—"}</bdi> },
    { key: "amount", header: t("المبلغ", "Amount"), align: "end", exportKind: "number", exportValue: (r) => r.amount_minor / 100, cell: (r) => (
      <span className="ma-num" style={{ color: r.amount_minor < 0 ? "var(--danger)" : undefined }}>{formatMinor(r.amount_minor)}</span>
    ) },
  ];

  return (
    <PageState error={balance.error}>
      {balance.isLoading || !b ? <Loading /> : (
        <>
          <div className="ma-kpis">
            <Kpi label={t("الرصيد المتاح", "Available")} value={formatMinor(b.available_minor)} icon="card" />
            <Kpi label={t("في طلب مفتوح", "In an open request")} value={formatMinor(b.held_minor)} icon="clock" />
            <Kpi label={t("بانتظار اعتماد Tolt", "Pending in Tolt")} value={formatMinor(b.pending_minor)} icon="receipt" />
            <Kpi label={t("إجمالي المصروف", "Paid out")} value={formatMinor(b.paid_total_minor)} icon="check" />
          </div>
          {b.available_minor < 0 ? (
            <Alert kind="warning" title={t("رصيد سالب", "Negative balance")}>
              {t("استُردت عمولات بعد صرفها؛ تُخصم من العمولات القادمة.", "Commissions were refunded after being paid; future commissions cover it first.")}
            </Alert>
          ) : null}
          {partner.customer_id ? null : (
            <Alert kind="info" title={t("لا يوجد حساب مرتبط", "No linked account")}>
              {t(
                `يرتبط المسوّق تلقائياً عند تسجيل دخوله بالبريد ${partner.email} ليطلب الصرف.`,
                `The marketer is linked automatically when they sign in with ${partner.email}, and can then request payouts.`,
              )}
            </Alert>
          )}
          <Card title={t("بيانات الدفع", "Payout details")}>
            {d ? (
              <Dl
                rows={[
                  [t("الطريقة", "Method"), payoutMethodLabel(d.method, lang)],
                  ...([
                    [t("البريد", "Email"), d.email],
                    [t("اسم صاحب الحساب", "Account name"), d.account_name],
                    ["IBAN", d.iban],
                    [t("البنك", "Bank"), d.bank_name],
                    ["SWIFT", d.swift],
                    [t("تعليمات", "Instructions"), d.instructions],
                  ] as [string, string | null | undefined][])
                    .filter(([, v]) => v)
                    .map(([k, v]) => [k, <bdi key={k} dir="ltr">{v}</bdi>] as [string, ReactNode]),
                ]}
              />
            ) : (
              <p className="ma-help">{t("لم يضف المسوّق بيانات الدفع بعد.", "The marketer hasn't added payout details yet.")}</p>
            )}
          </Card>
          <h3 className="ma-subhead">{t("طلبات الصرف", "Payout requests")}</h3>
          <PayoutsList partnerId={partner.partner_id} />
          <h3 className="ma-subhead">{t("سجل الرصيد", "Balance ledger")}</h3>
          <PagedList
            queryKeyBase={affiliatesKeys.partnerLedger(partner.partner_id)}
            fetchPage={({ offset, limit }) => listPartnerLedger(partner.partner_id, { offset, limit })}
            columns={columns}
            empty={t("لا حركات بعد. تُضاف العمولات عند اعتمادها في Tolt.", "No entries yet. Commissions are added once Tolt approves them.")}
            exportConfig={{ filename: `affiliate-ledger-${partner.referral_code}`, title: t("سجل الرصيد", "Balance ledger"), fetchSize: 200 }}
          />
        </>
      )}
    </PageState>
  );
}
