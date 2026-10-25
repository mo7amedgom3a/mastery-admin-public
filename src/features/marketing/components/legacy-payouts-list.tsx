import { useMemo } from "react";
import { listReferralPayouts, referralsKeys, type ReferralPayout } from "@/lib/api";
import { formatAmount, formatDateTime } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n";
import { badgeLabel, dateValue } from "@/lib/export/columns";
import { Badge } from "@/components/ui/kit";
import type { Column } from "@/components/ui/data-table";
import { PagedList, type ListFilter } from "@/components/ui/paged-list";

const payoutStatus = (status: number) =>
  status === 3
    ? { label: { ar: "مدفوع", en: "Paid" }, tone: "success" as const }
    : { label: { ar: "مطلوب", en: "Requested" }, tone: "warning" as const };

/** Payout requests of the legacy referral platform (`legacy.MAS_AFF_Payment`), read-only. */
export function LegacyPayoutsList() {
  const t = useT();
  const lang = useLang();

  const columns: Column<ReferralPayout>[] = [
    { key: "partner", header: t("المسوّق", "Partner"), exportValue: (row) => row.partner_name, cell: (row) => row.partner_name },
    { key: "amount", header: t("المبلغ", "Amount"), align: "end", exportKind: "money", exportValue: (row) => row.amount, cell: (row) => formatAmount(row.amount) },
    { key: "status", header: t("الحالة", "Status"), exportValue: (row) => badgeLabel(payoutStatus(row.status), lang), cell: (row) => <Badge def={payoutStatus(row.status)} /> },
    { key: "requested", header: t("الطلب", "Requested"), exportKind: "datetime", exportValue: (row) => dateValue(row.requested_at), cell: (row) => formatDateTime(row.requested_at) },
    { key: "updated", header: t("آخر تحديث", "Updated"), exportKind: "datetime", exportValue: (row) => dateValue(row.updated_at), cell: (row) => formatDateTime(row.updated_at) },
  ];

  const filters: ListFilter[] = useMemo(
    () => [
      {
        key: "status",
        label: t("كل الحالات", "All statuses"),
        options: [
          { value: "3", label: t("مدفوع", "Paid") },
          { value: "1", label: t("مطلوب", "Requested") },
        ],
      },
    ],
    [t],
  );

  return (
    <PagedList
      queryKeyBase={referralsKeys.payouts()}
      fetchPage={({ offset, limit, filters: selected, query }) =>
        listReferralPayouts({ limit, offset }).then((res) => {
          let items = res.items;
          if (query) {
            const q = query.toLowerCase();
            items = items.filter((item) => item.partner_name?.toLowerCase().includes(q));
          }
          if (selected.status) {
            const st = Number(selected.status);
            items = items.filter((item) => item.status === st);
          }
          return { ...res, items };
        })
      }
      columns={columns}
      filters={filters}
      searchPlaceholder={t("ابحث باسم المسوق…", "Search partner name…")}
      empty={t("لا طلبات صرف.", "No payout requests.")}
      exportConfig={{ filename: "payouts-legacy", title: t("طلبات الصرف (النظام القديم)", "Payouts (legacy)"), pdf: true, fetchSize: 200 }}
    />
  );
}
