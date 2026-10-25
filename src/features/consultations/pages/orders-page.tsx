import { consultationAdminKeys, listB2cOrders, type B2cOrderRow } from "@/lib/api";
import { formatAmount } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { bookingStatusBadge, orderStatusBadge } from "@/lib/status";
import { orderHref } from "@/lib/refs";
import { AppLink } from "@/components/ui/app-link";
import { Badge, PageHead } from "@/components/ui/kit";
import type { Column } from "@/components/ui/data-table";
import { PagedList, type ListFilter } from "@/components/ui/paged-list";
import { formatUtc } from "../lib";

export default function ConsultationOrdersPage() {
  const t = useT();
  const columns: Column<B2cOrderRow>[] = [
    { key: "order", header: t("الطلب", "Order"), exportValue: (r) => r.order_id,
      cell: (r) => <AppLink className="ma-link" to={orderHref(`b2c:${r.order_id}`)}>{r.order_id.slice(0, 8)}</AppLink> },
    { key: "date", header: t("التاريخ (UTC)", "Date (UTC)"), exportValue: (r) => r.created_at ?? "", cell: (r) => formatUtc(r.created_at) },
    { key: "service", header: t("الاستشارة", "Consultation"), exportValue: (r) => r.product_title ?? "", cell: (r) => r.product_title ?? "—" },
    { key: "student", header: t("الطالب", "Student"), exportValue: (r) => r.email ?? "",
      cell: (r) => (<span><span className="ma-cell-main">{r.customer_name ?? "—"}</span><span className="ma-cell-sub"><bdi>{r.email ?? ""}</bdi></span></span>) },
    { key: "slots", header: t("المواعيد", "Slots"), align: "end", exportKind: "number", exportValue: (r) => r.slots, cell: (r) => r.slots },
    { key: "total", header: t("الإجمالي", "Total"), align: "end", exportKind: "money", exportCurrency: (r) => r.currency_code,
      exportValue: (r) => Number(r.total_amount), cell: (r) => formatAmount(Number(r.total_amount), r.currency_code) },
    { key: "status", header: t("حالة الطلب", "Order"), exportValue: (r) => r.status, cell: (r) => <Badge def={orderStatusBadge(r.status)} /> },
    { key: "booking", header: t("الحجز", "Booking"), exportValue: (r) => r.booking_status ?? "",
      cell: (r) => r.booking_id
        ? <AppLink className="ma-link" to={`/consultations/bookings/${r.booking_id}`}><Badge def={bookingStatusBadge(r.booking_status)} /></AppLink>
        : "—" },
  ];
  const filters: ListFilter[] = [{
    key: "status",
    label: t("كل الحالات", "All statuses"),
    options: ["pending_payment", "paid", "fulfilled", "cancelled", "payment_failed", "refunded"].map((value) => ({
      value, label: orderStatusBadge(value)?.label.en ?? value,
    })),
  }];
  return (
    <>
      <PageHead title={t("طلبات الاستشارات", "Consultation orders")}
        sub={t("الطلبات التي تحتوي على استشارة والحجز الناتج عنها.", "Orders that contain a consultation, with the booking they created.")} />
      <PagedList
        queryKeyBase={consultationAdminKeys.orders()}
        fetchPage={({ query, offset, limit, filters: selected }) => listB2cOrders({ q: query, offset, limit, status: selected.status })}
        columns={columns}
        filters={filters}
        searchPlaceholder={t("ابحث باسم الطالب أو بريده…", "Search student name or email…")}
        empty={t("لا طلبات.", "No orders.")}
        exportConfig={{ filename: "consultation-orders", title: t("طلبات الاستشارات", "Consultation orders"), pdf: true, fetchSize: 200 }}
      />
    </>
  );
}
