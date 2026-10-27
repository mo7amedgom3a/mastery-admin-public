import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams } from "react-router-dom";

import { consultationAdminQueries } from "@/lib/api";
import { formatAmount, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useCan } from "@/lib/permissions";
import { initialsOf } from "@/lib/status";
import { Avatar, Button, Card, Dl, Kpi, Loading, PageHead } from "@/components/ui/kit";
import { PageState } from "@/components/ui/primitives";
import { AvailabilityTab } from "../components/availability-tab";
import { BookingsTable } from "../components/bookings-table";
import { ExpertProfileEditor, ExpertServicesCard } from "../components/expert-editor";

type Tab = "overview" | "availability" | "bookings";

export default function ExpertDetailPage() {
  const t = useT();
  const { id = "" } = useParams<{ id: string }>();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab | null) ?? "overview";
  const expert = useQuery(consultationAdminQueries.expert(id));
  const e = expert.data;
  const [editingProfile, setEditingProfile] = useState(false);
  const canWrite = useCan("consultationsWrite.write");

  const tabs: [Tab, string][] = [
    ["overview", t("نظرة عامة", "Overview")],
    ["availability", t("المواعيد المتاحة", "Availability")],
    ["bookings", t("الحجوزات", "Bookings")],
  ];
  const select = (next: Tab) => setParams((prev) => { const n = new URLSearchParams(prev); n.set("tab", next); return n; }, { replace: true });

  return (
    <>
      <PageHead back={{ href: "/consultations/experts", label: t("الخبراء", "Experts") }}
        title={e?.display_name ?? t("خبير", "Expert")} sub={e?.email ?? undefined} />
      <nav className="ma-cell-flex" style={{ marginBlockEnd: "var(--space-4)" }} aria-label={t("أقسام الصفحة", "Page sections")}>
        {tabs.map(([key, label]) => (
          <Button key={key} kind={tab === key ? "primary" : "soft"} sm label={label} onClick={() => select(key)} />
        ))}
      </nav>
      <PageState error={expert.error}>
        {expert.isLoading ? <Loading /> : null}
        {e && tab === "overview" ? (
          <>
            <div className="ma-kpis">
              <Kpi label={t("الحجوزات", "Bookings")} value={formatNumber(e.bookings_count)} icon="calendar" />
              <Kpi label={t("القادمة", "Upcoming")} value={formatNumber(e.upcoming_count)} icon="clock" />
              <Kpi label={t("مواعيد متاحة", "Free slots")} value={formatNumber(e.free_slots)} icon="video" />
              {e.revenue.map((r) => (
                <Kpi key={r.currency_code} label={t("الإيراد", "Revenue")} value={formatAmount(Number(r.amount ?? 0), r.currency_code)}
                  meta={`${r.orders} ${t("طلب", "orders")}`} icon="card" />
              ))}
            </div>
            <div className="ma-cols ma-cols--2">
              {editingProfile ? (
                <ExpertProfileEditor expert={e} onDone={() => setEditingProfile(false)} />
              ) : (
              <Card
                title={t("بيانات الخبير", "Profile")}
                actions={canWrite ? <Button sm label={t("تعديل", "Edit")} onClick={() => setEditingProfile(true)} /> : undefined}
              >
                <div className="ma-cell-flex" style={{ marginBlockEnd: "var(--space-4)" }}>
                  <Avatar initials={initialsOf(e.display_name ?? "?")} color="var(--purple)" lg alt={e.display_name ?? ""} />
                  <span className="ma-cell-main">{e.display_name ?? "—"}</span>
                </div>
                <Dl rows={[
                  [t("البريد", "Email"), <bdi key="m">{e.email ?? "—"}</bdi>],
                  [t("الهاتف", "Phone"), <bdi key="p">{e.phone ?? "—"}</bdi>],
                  [t("الدولة", "Country"), e.country_code ?? "—"],
                  [t("مدة الجلسة", "Session length"), e.session_minutes ? `${e.session_minutes} ${t("د", "min")}` : "—"],
                  [t("الحالة", "Status"), e.status],
                ]} />
                {e.bio ? <p style={{ marginBlockStart: "var(--space-3)" }}>{e.bio}</p> : null}
              </Card>
              )}
              <Card title={t("الحجوزات حسب الحالة", "Bookings by status")}>
                <Dl rows={Object.entries(e.status_counts).map(([k, v]) => [k, formatNumber(v)] as [string, string])} />
              </Card>
            </div>
            <ExpertServicesCard expert={e} />
          </>
        ) : null}
        {e && tab === "availability" ? <AvailabilityTab expert={e} /> : null}
        {e && tab === "bookings" ? <BookingsTable consultantId={id} hideExpert /> : null}
      </PageState>
    </>
  );
}
