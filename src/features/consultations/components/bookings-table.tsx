import { useMemo } from "react";

import { B2C_BOOKING_STATUSES, consultationAdminKeys, listB2cBookings, type B2cBookingRow } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { bookingStatusBadge } from "@/lib/status";
import { orderHref } from "@/lib/refs";
import { AppLink } from "@/components/ui/app-link";
import { Badge } from "@/components/ui/kit";
import type { Column } from "@/components/ui/data-table";
import { PagedList, type ListFilter } from "@/components/ui/paged-list";
import { formatUtc } from "../lib";

/** Cross-expert booking list; pass `consultantId` to scope it to one expert. */
export function BookingsTable({ consultantId, hideExpert }: { consultantId?: string; hideExpert?: boolean }) {
  const t = useT();
  const columns: Column<B2cBookingRow>[] = [
    {
      key: "when",
      header: t("الموعد (UTC)", "Time (UTC)"),
      exportValue: (row) => row.scheduled_start_at ?? "",
      cell: (row) => (
        <AppLink className="ma-link" to={`/consultations/bookings/${row.booking_id}`}>
          {formatUtc(row.scheduled_start_at)}
        </AppLink>
      ),
    },
    {
      key: "service",
      header: t("الاستشارة", "Consultation"),
      exportValue: (row) => row.product_title ?? "",
      cell: (row) => row.product_title ?? "—",
    },
    ...(hideExpert
      ? []
      : [{
          key: "expert",
          header: t("الخبير", "Expert"),
          exportValue: (row: B2cBookingRow) => row.expert_name ?? "",
          cell: (row: B2cBookingRow) =>
            row.consultant_id ? (
              <AppLink className="ma-link" to={`/consultations/experts/${row.consultant_id}`}>{row.expert_name ?? "—"}</AppLink>
            ) : (row.expert_name ?? "—"),
        } satisfies Column<B2cBookingRow>]),
    {
      key: "student",
      header: t("الطالب", "Student"),
      exportValue: (row) => row.customer_name ?? "",
      cell: (row) => row.customer_name ?? "—",
    },
    {
      key: "duration",
      header: t("المدة", "Duration"),
      exportKind: "number",
      exportValue: (row) => row.duration_minutes ?? null,
      align: "end",
      cell: (row) => (row.duration_minutes ? `${row.duration_minutes} ${t("د", "min")}` : "—"),
    },
    {
      key: "order",
      header: t("الطلب", "Order"),
      exportValue: (row) => row.order_id ?? "",
      cell: (row) =>
        row.order_id ? (
          <AppLink className="ma-link" to={orderHref(`b2c:${row.order_id}`)}>{row.order_id.slice(0, 8)}</AppLink>
        ) : "—",
    },
    {
      key: "status",
      header: t("الحالة", "Status"),
      exportValue: (row) => row.status,
      cell: (row) => <Badge def={bookingStatusBadge(row.status)} />,
    },
  ];
  const filters: ListFilter[] = useMemo(
    () => [{
      key: "status",
      label: t("كل الحالات", "All statuses"),
      options: B2C_BOOKING_STATUSES.map((value) => ({ value, label: bookingStatusBadge(value)?.label.en ?? value })),
    }],
    [t],
  );

  return (
    <PagedList
      queryKeyBase={consultationAdminKeys.bookings({ consultantId })}
      fetchPage={({ query, offset, limit, filters: selected }) =>
        listB2cBookings({
          customer: query,
          offset,
          limit,
          consultant_id: consultantId,
          status: selected.status ? [selected.status as (typeof B2C_BOOKING_STATUSES)[number]] : undefined,
        })}
      columns={columns}
      filters={filters}
      searchPlaceholder={t("ابحث باسم الطالب أو بريده…", "Search student name or email…")}
      empty={t("لا حجوزات.", "No bookings.")}
      exportConfig={{ filename: "consultation-bookings", title: t("حجوزات الاستشارات", "Consultation bookings"), pdf: true, fetchSize: 200 }}
    />
  );
}
