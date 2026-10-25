import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

import {
  couponsKeys,
  listCoupons,
  listPromotions,
  promotionsKeys,
  setCouponActive,
  setPromotionActive,
  type Coupon,
  type Promotion,
} from "@/lib/api";
import { formatDate, formatDateTime, formatMinor, formatNumber, formatPercent } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { dateValue } from "@/lib/export/columns";
import { AppLink } from "@/components/ui/app-link";
import { Badge, Button, ErrorAlert, PageHead } from "@/components/ui/kit";
import { type Column } from "@/components/ui/data-table";
import { PagedList, type ListFilter } from "@/components/ui/paged-list";

import { couponStatusBadge, couponValueLabel } from "../lib/coupons";

function NativeCoupons() {
  const t = useT();
  const queryClient = useQueryClient();
  const canWrite = can("coupons.write");

  const toggle = useMutation({
    mutationFn: (coupon: Coupon) => setCouponActive(coupon.promotion_id, !coupon.is_active),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: couponsKeys.all }),
  });

  const columns: Column<Coupon>[] = [
    {
      key: "code", header: t("الكود", "Code"), exportValue: (row) => row.code,
      cell: (row) => (
        <AppLink className="ma-link ma-link--plain" to={`/sales/coupons/${row.promotion_id}`}>
          <span className="ma-cell-main ma-num">{row.code}</span>
          {row.name ? <span className="ma-cell-sub">{row.name}</span> : null}
        </AppLink>
      ),
    },
    { key: "discount", header: t("الخصم", "Discount"), exportValue: (row) => couponValueLabel(row), cell: (row) => <span className="ma-num">{couponValueLabel(row)}</span> },
    {
      key: "uses", header: t("الاستخدام", "Uses"), align: "end", exportKind: "number", exportValue: (row) => row.stats.redemptions,
      cell: (row) => <span className="ma-num">{formatNumber(row.stats.redemptions)}{row.usage_limit ? ` / ${formatNumber(row.usage_limit)}` : ""}</span>,
    },
    { key: "customers", header: t("العملاء", "Customers"), align: "end", exportKind: "number", exportValue: (row) => row.stats.unique_customers, cell: (row) => <span className="ma-num">{formatNumber(row.stats.unique_customers)}</span> },
    { key: "given", header: t("الخصم الممنوح", "Discount given"), align: "end", exportKind: "number", exportValue: (row) => row.stats.discount_minor / 100, cell: (row) => <span className="ma-num">{formatMinor(row.stats.discount_minor, row.currency_code)}</span> },
    { key: "revenue", header: t("الإيراد", "Revenue"), align: "end", exportKind: "number", exportValue: (row) => row.stats.revenue_minor / 100, cell: (row) => <span className="ma-num">{formatMinor(row.stats.revenue_minor, row.currency_code)}</span> },
    {
      key: "conversion", header: t("التحويل", "Conversion"), align: "end", exportKind: "number", exportValue: (row) => row.stats.conversion_rate ?? null,
      cell: (row) => <span className="ma-num">{row.stats.conversion_rate == null ? "—" : formatPercent(row.stats.conversion_rate * 100)}</span>,
    },
    { key: "ends", header: t("ينتهي", "Ends"), exportKind: "datetime", exportValue: (row) => dateValue(row.ends_at), cell: (row) => formatDate(row.ends_at) },
    { key: "status", header: t("الحالة", "Status"), exportValue: (row) => row.status, cell: (row) => <Badge def={couponStatusBadge(row.status)} /> },
    {
      key: "actions", header: "", exportable: false, align: "end",
      cell: (row) =>
        canWrite && row.status !== "archived" ? (
          <Button sm disabled={toggle.isPending} label={row.is_active ? t("إيقاف", "Deactivate") : t("تفعيل", "Activate")} onClick={() => toggle.mutate(row)} />
        ) : null,
    },
  ];

  const filters: ListFilter[] = [
    {
      key: "status",
      label: t("كل الحالات", "All states"),
      options: [
        { value: "active", label: t("مفعّل", "Active") },
        { value: "inactive", label: t("موقوف", "Inactive") },
        { value: "expired", label: t("منتهي", "Expired") },
        { value: "archived", label: t("مؤرشف", "Archived") },
      ],
    },
  ];

  return (
    <>
      <ErrorAlert error={toggle.error} title={t("تعذّر تغيير حالة الكوبون", "Couldn't change the coupon state")} />
      <PagedList
        queryKeyBase={couponsKeys.all}
        fetchPage={({ query, offset, limit, filters: selected }) =>
          listCoupons({ query, status: (selected.status || undefined) as never, limit, offset })
        }
        columns={columns}
        searchPlaceholder={t("ابحث بالكود أو الاسم…", "Search code or name…")}
        filters={filters}
        empty={t("لا كوبونات بعد.", "No coupons yet.")}
        exportConfig={{ filename: "coupons", title: t("الكوبونات", "Coupons"), pdf: true, fetchSize: 200 }}
      />
    </>
  );
}

/** Coupons of the legacy platform (local mirror), kept visible next to the new ones. */
function LegacyCoupons() {
  const t = useT();
  const lang = useLang();
  const queryClient = useQueryClient();

  const toggle = useMutation({
    mutationFn: (promotion: Promotion) => setPromotionActive(promotion.legacy_coupon_id, { active: !promotion.active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: promotionsKeys.all }),
  });

  const columns: Column<Promotion>[] = [
    { key: "code", header: t("الكود", "Code"), sortable: true, exportValue: (row) => row.code, cell: (row) => <span className="ma-num">{row.code}</span> },
    { key: "name", header: t("الاسم", "Name"), sortable: true, exportValue: (row) => row.name, cell: (row) => row.name },
    { key: "discount", header: t("الخصم", "Discount"), align: "end", sortable: true, sortValue: (row) => row.discount_percent ?? 0, exportKind: "number", exportHeader: t("الخصم %", "Discount %"), exportValue: (row) => row.discount_percent ?? null, cell: (row) => (row.discount_percent != null ? `${row.discount_percent}%` : "—") },
    { key: "ends", header: t("ينتهي", "Ends"), exportKind: "datetime", exportValue: (row) => dateValue(row.ends_at), cell: (row) => formatDateTime(row.ends_at) },
    { key: "active", header: t("الحالة", "Status"), exportValue: (row) => (row.active ? (lang === "ar" ? "مفعّل" : "Active") : lang === "ar" ? "موقوف" : "Inactive"), cell: (row) => <Badge def={{ label: row.active ? { ar: "مفعّل", en: "Active" } : { ar: "موقوف", en: "Inactive" }, tone: row.active ? "success" : "warning" }} /> },
    {
      key: "actions",
      header: "",
      exportable: false,
      align: "end",
      cell: (row) => (
        <Button sm disabled={toggle.isPending} label={row.active ? t("إيقاف", "Deactivate") : t("تفعيل", "Activate")} onClick={() => toggle.mutate(row)} />
      ),
    },
  ];

  const filters: ListFilter[] = [
    {
      key: "active",
      label: t("كل الحالات", "All states"),
      options: [
        { value: "true", label: t("مفعّل", "Active") },
        { value: "false", label: t("موقوف", "Inactive") },
      ],
    },
  ];

  return (
    <>
      <ErrorAlert error={toggle.error} title={t("تعذّر تغيير حالة الكوبون", "Couldn't change the coupon state")} />
      <PagedList
        queryKeyBase={["marketing", "promotions"]}
        fetchPage={({ query, offset, limit, filters: selected }) =>
          listPromotions({ query, active: selected.active ? selected.active === "true" : undefined, limit, offset })
        }
        columns={columns}
        searchPlaceholder={t("ابحث بالكود أو الاسم…", "Search code or name…")}
        filters={filters}
        empty={t("لا كوبونات.", "No coupons.")}
        exportConfig={{ filename: "legacy-coupons", title: t("كوبونات النظام القديم", "Legacy coupons"), pdf: true, fetchSize: 200 }}
      />
    </>
  );
}

export default function CouponsPage() {
  const t = useT();
  const [params, setParams] = useSearchParams();
  const legacy = params.get("view") === "legacy";
  const select = (view: "" | "legacy") =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (view) next.set("view", view);
      else next.delete("view");
      return next;
    }, { replace: true });

  return (
    <>
      <PageHead
        title={t("الكوبونات", "Coupons")}
        sub={t("أكواد خصم يستخدمها العملاء عند الدفع.", "Discount codes customers apply at checkout.")}
        actions={can("coupons.write") ? <Button kind="primary" icon="plus" label={t("إنشاء كوبون", "Create coupon")} href="/sales/coupons/new" /> : null}
      />
      <nav className="ma-tabs mb-4" aria-label={t("مصدر الكوبونات", "Coupon source")}>
        <button type="button" aria-selected={!legacy} onClick={() => select("")}>{t("الكوبونات", "Coupons")}</button>
        <button type="button" aria-selected={legacy} onClick={() => select("legacy")}>{t("النظام القديم", "Legacy system")}</button>
      </nav>
      {legacy ? <LegacyCoupons /> : <NativeCoupons />}
    </>
  );
}
