import { useState } from "react";

import { listOrders, ordersKeys, setOrderFollowUp, type OrderFollowUpStatus, type AdminOrder } from "@/lib/api";
import { formatAmount, formatDateTime } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n";
import { badgeLabel } from "@/lib/export/columns";
import { customerHref, orderHref, shortRef } from "@/lib/refs";
import { SourceBadge } from "@/components/ui/source-badge";
import { initialsOf, orderStatusBadge, paymentStatusBadge } from "@/lib/status";
import { AppLink } from "@/components/ui/app-link";
import { type Column } from "@/components/ui/data-table";
import { Avatar, Badge, DateRange, PageHead } from "@/components/ui/kit";
import { PagedList, type ListFilter } from "@/components/ui/paged-list";

import { useCan } from "@/lib/permissions";
import { OrderFollowUp } from "../components/order-follow-up";
import { FOLLOW_UP_STAGES } from "../follow-up-stages";

const STATUSES: { value: string; ar: string; en: string }[] = [
  { value: "pending_payment", ar: "بانتظار الدفع", en: "Pending payment" },
  { value: "paid", ar: "مدفوع", en: "Paid" },
  { value: "payment_failed", ar: "فشل الدفع", en: "Payment failed" },
  { value: "cancelled", ar: "ملغى", en: "Cancelled" },
  { value: "partially_refunded", ar: "مُسترد جزئيًا", en: "Partially refunded" },
  { value: "refunded", ar: "مُسترد", en: "Refunded" },
  { value: "expired", ar: "منتهي", en: "Expired" },
];

const PROVIDERS = ["stripe", "tamara", "free"];

const PLAN_TYPES: { value: string; ar: string; en: string }[] = [
  { value: "standard", ar: "قياسية", en: "Standard" },
  { value: "full_library", ar: "المكتبة الكاملة", en: "Full library" },
  { value: "choose_x", ar: "اختر عددًا من الدورات", en: "Choose X" },
];

const AUDIENCES: { value: string; ar: string; en: string }[] = [
  { value: "company", ar: "اشتراكات الشركات", en: "Company subscriptions" },
  { value: "individual", ar: "اشتراكات الأفراد", en: "Individual subscriptions" },
];

const PAYMENT_STATUSES: { value: string; ar: string; en: string }[] = [
  { value: "pending", ar: "بانتظار", en: "Pending" },
  { value: "succeeded", ar: "ناجح", en: "Succeeded" },
  { value: "failed", ar: "فاشل", en: "Failed" },
  { value: "refunded", ar: "مُسترد", en: "Refunded" },
  { value: "incomplete", ar: "غير مكتمل (قديم)", en: "Incomplete (legacy)" },
];

export default function OrdersPage() {
  const t = useT();
  const canMove = useCan("orders.write");
  const lang = useLang();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const followUpColumns = FOLLOW_UP_STAGES.map((stage) => ({ value: stage.value, label: t(stage.ar, stage.en) }));
  const columns: Column<AdminOrder>[] = [
    { key: "follow_up_status", header: t("حالة المتابعة", "Follow-up status"),
      exportValue: (row) => followUpColumns.find((stage) => stage.value === row.follow_up_status)?.label ?? row.follow_up_status,
      cell: (row) => <OrderFollowUp orderRef={row.ref} value={row.follow_up_status} /> },
    {
      key: "order",
      header: t("الطلب", "Order"),
      sortable: true,
      sortValue: (row) => row.created_at,
      exportValue: (row) => shortRef(row.ref),
      cell: (row) => (
        <AppLink className="ma-link ma-link--plain" to={orderHref(row.ref)}>
          <span className="ma-cell-main"><bdi>{shortRef(row.ref)}</bdi></span>
          <span className="ma-cell-sub">{formatDateTime(row.created_at)}</span>
        </AppLink>
      ),
    },
    {
      key: "customer",
      header: t("العميل", "Customer"),
      sortable: true,
      sortValue: (row) => row.customer_email ?? "",
      cell: (row) => (
        row.customer_ref ? (
          <AppLink className="ma-cell-flex ma-link ma-link--plain" to={customerHref(row.customer_ref)}>
            <Avatar initials={initialsOf(row.customer_email ?? "?")} color="var(--sky)" />
            <span className="ma-cell-main"><bdi>{row.customer_email ?? "—"}</bdi></span>
          </AppLink>
        ) : (
          "—"
        )
      ),
    },
    { key: "source", header: t("النظام", "System"), exportValue: (row) => row.source, cell: (row) => <SourceBadge source={row.source} /> },
    { key: "status", header: t("الحالة", "Status"), sortable: true, exportValue: (row) => badgeLabel(orderStatusBadge(row.status), lang), cell: (row) => <Badge def={orderStatusBadge(row.status)} /> },
    {
      key: "payment",
      header: t("الدفع", "Payment"),
      exportValue: (row) => [badgeLabel(paymentStatusBadge(row.payment_status), lang), row.payment_provider].filter(Boolean).join(" · "),
      cell: (row) => (
        <>
          <Badge def={paymentStatusBadge(row.payment_status)} />
          {row.payment_provider ? <span className="ma-cell-sub">{row.payment_provider}</span> : null}
        </>
      ),
    },
    {
      key: "total",
      header: t("الإجمالي", "Total"),
      align: "end",
      sortable: true,
      sortValue: (row) => row.amount_minor,
      exportKind: "money",
      exportValue: (row) => row.amount_minor / 100,
      exportCurrency: (row) => row.currency_code,
      cell: (row) => <span className="ma-num">{formatAmount(row.amount_minor / 100, row.currency_code)}</span>,
    },
  ];

  const filters: ListFilter[] = [
    { key: "follow_up_status", label: t("كل حالات المتابعة", "All follow-up stages"), options: followUpColumns },
    {
      key: "source",
      label: t("كل الأنظمة", "All systems"),
      options: [
        { value: "b2c", label: t("المتجر (B2C)", "B2C") },
        { value: "legacy", label: t("النظام القديم", "Legacy") },
      ],
    },
    { key: "status", label: t("كل الحالات", "All statuses"), options: STATUSES.map((item) => ({ value: item.value, label: t(item.ar, item.en) })) },
    { key: "payment_status", label: t("كل حالات الدفع", "All payments"), options: PAYMENT_STATUSES.map((item) => ({ value: item.value, label: t(item.ar, item.en) })) },
    { key: "provider", label: t("كل البوابات", "All gateways"), options: PROVIDERS.map((value) => ({ value, label: value })) },
    {
      key: "audience_type",
      label: t("كل أنواع المشتركين", "All subscribers"),
      options: AUDIENCES.map((item) => ({ value: item.value, label: t(item.ar, item.en) })),
    },
    {
      key: "plan_type",
      label: t("كل أنواع الباقات", "All plan types"),
      options: PLAN_TYPES.map((item) => ({ value: item.value, label: t(item.ar, item.en) })),
    },
  ];

  return (
    <>
      <PageHead
        title={t("الطلبات", "Orders")}
        sub={t("طلبات المتجر الجديد والنظام القديم مع الفلاتر والبحث وفترة التاريخ.", "Orders of B2C and the legacy platform, with filters and date range.")}
      />

      <PagedList
        queryKeyBase={[...ordersKeys.all, { from, to }]}
        fetchPage={({ query, offset, limit, filters: selected }) =>
          listOrders({
            source: (selected.source || "all") as "all" | "b2c" | "legacy",
            status: selected.status || undefined,
            payment_status: selected.payment_status || undefined,
            follow_up_status: (selected.follow_up_status || undefined) as OrderFollowUpStatus | undefined,
            provider: selected.provider || undefined,
            plan_type: (selected.plan_type || undefined) as "standard" | "full_library" | "choose_x" | undefined,
            audience_type: (selected.audience_type || undefined) as "individual" | "company" | undefined,
            start: from || undefined,
            end: to || undefined,
            query,
            limit,
            offset,
          })
        }
        toolbar={<DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} onClear={() => { setFrom(""); setTo(""); }} />}
        board={{
          columns: followUpColumns, stageFilterKey: "follow_up_status", canMove,
          getId: (row) => row.ref, getStage: (row) => row.follow_up_status,
          move: (row, stage) => setOrderFollowUp(row.ref, stage as OrderFollowUpStatus),
          invalidateKeys: [ordersKeys.all],
          renderCard: (row) => <>
            <AppLink className="ma-link ma-cell-main" to={orderHref(row.ref)}><bdi>{shortRef(row.ref)}</bdi></AppLink>
            <span><bdi>{row.customer_email ?? "—"}</bdi></span>
            <strong className="ma-num">{formatAmount(row.amount_minor / 100, row.currency_code)}</strong>
            <div className="flex flex-wrap gap-2"><SourceBadge source={row.source} /><Badge def={orderStatusBadge(row.status)} /><Badge def={paymentStatusBadge(row.payment_status)} /></div>
            <span className="ma-cell-sub">{formatDateTime(row.created_at)}</span>
          </>,
        }}
        columns={columns}
        searchPlaceholder={t("ابحث ببريد العميل…", "Search customer email…")}
        filters={filters}
        empty={t("لا طلبات.", "No orders.")}
        exportConfig={{
          filename: "orders",
          title: t("الطلبات", "Orders"),
          pdf: true,
          fetchSize: 200,
          extraColumns: [{ key: "created", header: t("تاريخ الإنشاء", "Created"), kind: "datetime", value: (row) => (row.created_at ? new Date(row.created_at) : null) }],
          describe: () => (from || to ? [`${t("الفترة", "Period")}: ${from || "…"} → ${to || "…"}`] : []),
        }}
      />

    </>
  );
}
