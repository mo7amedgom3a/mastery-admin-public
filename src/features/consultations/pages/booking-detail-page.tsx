import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams } from "react-router-dom";

import { consultationAdminQueries } from "@/lib/api";
import { can } from "@/lib/permissions";
import { useT } from "@/lib/i18n";
import { orderHref } from "@/lib/refs";
import { bookingStatusBadge } from "@/lib/status";
import { formatAmount } from "@/lib/format";
import { AppLink } from "@/components/ui/app-link";
import { Badge, Button, Card, Dl, Loading, PageHead } from "@/components/ui/kit";
import { PageState } from "@/components/ui/primitives";
import { MeetingTab } from "../components/meeting-tab";
import { RescheduleModal } from "../components/reschedule-modal";
import { formatUtc } from "../lib";

type Tab = "details" | "meeting";
const MOVABLE = new Set(["awaiting_approval", "confirmed"]);

export default function BookingDetailPage() {
  const t = useT();
  const { id = "" } = useParams<{ id: string }>();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab | null) ?? "details";
  const [moving, setMoving] = useState(false);
  const query = useQuery(consultationAdminQueries.booking(id));
  const b = query.data;
  const canMove = !!b && MOVABLE.has(b.status) && can("consultationsWrite.write");

  return (
    <>
      <PageHead back={{ href: "/consultations/bookings", label: t("الحجوزات", "Bookings") }}
        title={b?.product_title ?? t("حجز", "Booking")} status={b ? <Badge def={bookingStatusBadge(b.status)} /> : null}
        sub={b ? `${formatUtc(b.scheduled_start_at)} – ${formatUtc(b.scheduled_end_at)}` : undefined}
        actions={canMove ? <Button kind="primary" icon="calendar" label={t("تغيير الموعد", "Reschedule")} onClick={() => setMoving(true)} /> : null} />
      <nav className="ma-cell-flex" style={{ marginBlockEnd: "var(--space-4)" }}>
        {([["details", t("التفاصيل", "Details")], ["meeting", t("الاجتماع والتسجيل", "Meeting & recording")]] as [Tab, string][]).map(([key, label]) => (
          <Button key={key} kind={tab === key ? "primary" : "soft"} sm label={label}
            onClick={() => setParams((prev) => { const n = new URLSearchParams(prev); n.set("tab", key); return n; }, { replace: true })} />
        ))}
      </nav>
      <PageState error={query.error}>
        {query.isLoading ? <Loading /> : null}
        {b && tab === "details" ? (
          <>
            <div className="ma-cols ma-cols--2">
              <Card title={t("الطالب", "Student")}>
                <Dl rows={[
                  [t("الاسم", "Name"), b.customer?.full_name ?? b.customer_name ?? "—"],
                  [t("البريد", "Email"), <bdi key="e">{b.customer?.email ?? "—"}</bdi>],
                  [t("الهاتف", "Phone"), <bdi key="p">{b.customer?.phone ?? "—"}</bdi>],
                  [t("الدولة", "Country"), b.customer?.country_code ?? "—"],
                ]} />
                {b.customer ? <AppLink className="ma-link" to={`/customers/${encodeURIComponent(`b2c:${b.customer.customer_id}`)}`}>{t("ملف العميل", "Customer profile")}</AppLink> : null}
              </Card>
              <Card title={t("الخبير والطلب", "Expert & order")}>
                <Dl rows={[
                  [t("الخبير", "Expert"), b.consultant_id
                    ? <AppLink key="x" className="ma-link" to={`/consultations/experts/${b.consultant_id}`}>{b.expert_name ?? "—"}</AppLink>
                    : (b.expert_name ?? "—")],
                  [t("المدة", "Duration"), b.duration_minutes ? `${b.duration_minutes} ${t("د", "min")}` : "—"],
                  [t("الطلب", "Order"), b.order
                    ? <AppLink key="o" className="ma-link" to={orderHref(`b2c:${b.order.order_id}`)}>{b.order.order_id.slice(0, 8)}</AppLink>
                    : "—"],
                  [t("حالة الطلب", "Order status"), b.order?.status ?? "—"],
                  [t("المبلغ", "Amount"), b.order ? formatAmount(Number(b.order.total_amount), b.order.currency_code) : "—"],
                  [t("موافقة حتى", "Approval deadline"), formatUtc(b.approval_deadline_at)],
                  [t("سبب الرفض", "Rejection reason"), b.rejection_reason ?? "—"],
                ]} />
              </Card>
            </div>
            <Card title={t("المواعيد المحجوزة", "Booked slots")}>
              <Dl rows={b.slots.map((s, i) => [`#${i + 1}`, `${formatUtc(s.starts_at)} – ${formatUtc(s.ends_at)}`] as [string, string])} />
            </Card>
            <Card title={t("سجل الأحداث", "Timeline")}>
              <ol className="ma-timeline">
                {b.events.map((event, index) => (
                  <li key={index}>
                    <strong>{event.event_type}</strong>
                    <span className="ma-help">{formatUtc(event.created_at)}</span>
                    {event.note ? <span>{event.note}</span> : null}
                  </li>
                ))}
              </ol>
            </Card>
          </>
        ) : null}
        {b && tab === "meeting" ? <MeetingTab booking={b} /> : null}
      </PageState>
      {moving && b ? <RescheduleModal open onOpenChange={setMoving} booking={b} /> : null}
    </>
  );
}
