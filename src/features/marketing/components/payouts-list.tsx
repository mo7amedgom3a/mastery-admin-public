import { useState } from "react";

import { affiliatesKeys, listAffiliatePayouts, type AffiliatePayout } from "@/lib/api";
import { formatDateTime, formatMinor } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n";
import { badgeLabel, dateValue } from "@/lib/export/columns";
import { AppLink } from "@/components/ui/app-link";
import { Badge, Button } from "@/components/ui/kit";
import type { Column } from "@/components/ui/data-table";
import { PagedList, type ListFilter } from "@/components/ui/paged-list";

import { payoutMethodLabel, payoutStatusBadge } from "../lib/affiliates";
import { PayoutReviewModal } from "./payout-review-modal";

const STATUSES = ["open", "requested", "approved", "paid", "partially_paid", "rejected", "cancelled"] as const;

/** Marketer payout requests on the local ledger; each row opens the review modal. */
export function PayoutsList({ partnerId }: { partnerId?: string }) {
  const t = useT();
  const lang = useLang();
  const [reviewing, setReviewing] = useState<string | null>(null);

  const statusLabel = (value: (typeof STATUSES)[number]) =>
    value === "open" ? t("المفتوحة (للمراجعة أو الدفع)", "Open (to review or pay)") : badgeLabel(payoutStatusBadge(value), lang);

  const columns: Column<AffiliatePayout>[] = [
    ...(partnerId
      ? []
      : [
          {
            key: "partner",
            header: t("المسوّق", "Marketer"),
            exportValue: (r: AffiliatePayout) => r.partner_email ?? "",
            cell: (r: AffiliatePayout) => (
              <AppLink className="ma-link ma-link--plain" to={`/marketing/affiliates/${r.partner_id}?tab=payouts`}>
                <span className="ma-cell-main">{r.partner_name || r.partner_email}</span>
                <span className="ma-cell-sub"><bdi>{r.partner_email}</bdi></span>
              </AppLink>
            ),
          } as Column<AffiliatePayout>,
        ]),
    { key: "requested", header: t("المطلوب", "Requested"), align: "end", exportKind: "number", exportValue: (r) => r.requested_minor / 100, cell: (r) => <span className="ma-num">{formatMinor(r.requested_minor)}</span> },
    { key: "paid", header: t("المحوّل", "Paid"), align: "end", exportKind: "number", exportValue: (r) => (r.paid_minor ?? 0) / 100, cell: (r) => <span className="ma-num">{r.paid_minor != null ? formatMinor(r.paid_minor) : "—"}</span> },
    { key: "method", header: t("طريقة الدفع", "Method"), exportValue: (r) => payoutMethodLabel(r.method, lang), cell: (r) => (
      <>
        <span className="ma-cell-main">{payoutMethodLabel(r.method, lang)}</span>
        {r.destination ? <span className="ma-cell-sub"><bdi dir="ltr">{r.destination}</bdi></span> : null}
      </>
    ) },
    { key: "status", header: t("الحالة", "Status"), exportValue: (r) => badgeLabel(payoutStatusBadge(r.status), lang), cell: (r) => <Badge def={payoutStatusBadge(r.status)} /> },
    { key: "requested_at", header: t("تاريخ الطلب", "Requested at"), exportKind: "datetime", exportValue: (r) => dateValue(r.requested_at), cell: (r) => formatDateTime(r.requested_at) },
    { key: "reference", header: t("المرجع", "Reference"), exportValue: (r) => r.payment_reference ?? "", cell: (r) => (r.payment_reference ? <bdi dir="ltr" className="ma-num">{r.payment_reference}</bdi> : "—") },
    {
      key: "actions", header: "", exportable: false, align: "end",
      cell: (r) => (
        <Button
          sm
          kind={r.status === "requested" || r.status === "approved" ? "primary" : "ghost"}
          label={r.status === "requested" || r.status === "approved" ? t("مراجعة", "Review") : t("عرض", "View")}
          onClick={() => setReviewing(r.payout_id)}
        />
      ),
    },
  ];

  const filters: ListFilter[] = [
    {
      key: "status",
      label: t("كل الحالات", "All statuses"),
      options: STATUSES.map((value) => ({ value, label: statusLabel(value) })),
    },
  ];

  return (
    <>
      <PagedList
        queryKeyBase={affiliatesKeys.payouts({ partner_id: partnerId })}
        fetchPage={({ query, offset, limit, filters: selected }) =>
          listAffiliatePayouts({
            partner_id: partnerId,
            status: selected.status || undefined,
            query: query || undefined,
            limit,
            offset,
          })
        }
        columns={columns}
        filters={filters}
        searchPlaceholder={partnerId ? undefined : t("ابحث بالاسم أو البريد أو المرجع…", "Search name, email or reference…")}
        empty={t("لا طلبات صرف.", "No payout requests.")}
        refreshOnFocus
        exportConfig={{ filename: "affiliate-payouts", title: t("طلبات صرف المسوقين", "Marketer payouts"), pdf: true, fetchSize: 200 }}
      />
      <PayoutReviewModal payoutId={reviewing} onClose={() => setReviewing(null)} />
    </>
  );
}
