import { listVouchers, vouchersKeys, type Voucher } from "@/lib/api";
import { formatDate, formatMinor } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { dateValue } from "@/lib/export/columns";
import { AppLink } from "@/components/ui/app-link";
import { Badge, Button, PageHead } from "@/components/ui/kit";
import { type Column } from "@/components/ui/data-table";
import { PagedList, type ListFilter } from "@/components/ui/paged-list";

import { voucherStatusBadge } from "../lib/coupons";

export default function VouchersPage() {
  const t = useT();

  const columns: Column<Voucher>[] = [
    {
      key: "code", header: t("الكود", "Code"), exportValue: (row) => row.code,
      cell: (row) => <AppLink className="ma-link ma-num" style={{ whiteSpace: "nowrap" }} to={`/sales/vouchers/${row.voucher_id}`}>{row.code}</AppLink>,
    },
    {
      key: "customer", header: t("العميل", "Customer"), exportValue: (row) => row.customer_email ?? row.customer_id,
      cell: (row) => (
        <AppLink className="ma-link ma-link--plain" to={`/customers/${row.customer_id}`}>
          <span className="ma-cell-main">{row.customer_name || row.customer_email || "—"}</span>
          <span className="ma-cell-sub"><bdi>{row.customer_email ?? row.customer_id}</bdi></span>
        </AppLink>
      ),
    },
    { key: "initial", header: t("القيمة", "Value"), align: "end", exportKind: "number", exportValue: (row) => row.initial_amount_minor / 100, cell: (row) => <span className="ma-num">{formatMinor(row.initial_amount_minor, row.currency_code)}</span> },
    { key: "used", header: t("المستخدم", "Spent"), align: "end", exportKind: "number", exportValue: (row) => row.used_minor / 100, cell: (row) => <span className="ma-num">{formatMinor(row.used_minor, row.currency_code)}</span> },
    { key: "balance", header: t("الرصيد", "Balance"), align: "end", exportKind: "number", exportValue: (row) => row.balance_minor / 100, cell: (row) => <span className="ma-num">{formatMinor(row.balance_minor, row.currency_code)}</span> },
    { key: "expires", header: t("تنتهي", "Expires"), exportKind: "datetime", exportValue: (row) => dateValue(row.expires_at), cell: (row) => (row.expires_at ? formatDate(row.expires_at) : t("بلا انتهاء", "Never")) },
    { key: "source", header: t("المصدر", "Source"), exportValue: (row) => row.source, cell: (row) => row.source },
    { key: "status", header: t("الحالة", "Status"), exportValue: (row) => row.status, cell: (row) => <Badge def={voucherStatusBadge(row.status)} /> },
  ];

  const filters: ListFilter[] = [
    {
      key: "status",
      label: t("كل الحالات", "All states"),
      options: [
        { value: "active", label: t("فعّالة", "Active") },
        { value: "exhausted", label: t("مستنفدة", "Used up") },
        { value: "expired", label: t("منتهية", "Expired") },
        { value: "revoked", label: t("ملغاة", "Revoked") },
      ],
    },
  ];

  return (
    <>
      <PageHead
        title={t("قسائم الرصيد", "Vouchers")}
        sub={t("رصيد باسم العميل يستخدمه عند الدفع حتى ينفد أو تنتهي صلاحيته.", "Store credit on a customer, spent at checkout until used up or expired.")}
        actions={can("coupons.write") ? <Button kind="primary" icon="plus" label={t("إصدار قسائم", "Issue vouchers")} href="/sales/vouchers/new" /> : null}
      />
      <PagedList
        queryKeyBase={vouchersKeys.all}
        fetchPage={({ query, offset, limit, filters: selected }) =>
          listVouchers({ query, status: (selected.status || undefined) as never, limit, offset })
        }
        columns={columns}
        searchPlaceholder={t("ابحث بالكود أو بريد العميل…", "Search code or customer email…")}
        filters={filters}
        empty={t("لا قسائم بعد.", "No vouchers yet.")}
        exportConfig={{ filename: "vouchers", title: t("قسائم الرصيد", "Vouchers"), pdf: true, fetchSize: 200 }}
      />
    </>
  );
}
