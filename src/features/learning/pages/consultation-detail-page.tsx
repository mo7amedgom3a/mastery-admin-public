import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import {
  consultationsQueries,
  productQueries,
  type AvailabilitySlot,
  type ConsultationMilestone,
  type ConsultationRevenue,
  type ConsultationSection,
  type ConsultationSessionRequest,
} from "@/lib/api";
import { formatAmount, formatDateTime, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { productHref } from "@/lib/refs";
import { initialsOf } from "@/lib/status";
import { AppLink } from "@/components/ui/app-link";
import { Avatar, Badge, Card, Dl, Empty, Loading, PageHead } from "@/components/ui/kit";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageState } from "@/components/ui/primitives";
import { RichHtml } from "@/components/ui/rich-html";
import { SearchBox } from "@/components/ui/paged-list";
import { SelectField } from "@/components/ui/select";

const str = (value: unknown): string | null => (value == null || value === "" ? null : String(value));
const isUrl = (value: unknown): boolean => typeof value === "string" && /^https?:\/\//i.test(value);

export default function ConsultationDetailPage() {
  const t = useT();
  const { id: idParam = "" } = useParams<{ id: string }>();
  const id = Number(idParam);
  const valid = Number.isFinite(id);

  const service = useQuery({ ...consultationsQueries.detail(id), enabled: valid });
  const info = useQuery({ ...consultationsQueries.info(id), enabled: valid });
  const milestones = useQuery({ ...consultationsQueries.milestones(id), enabled: valid });
  const revenue = useQuery({ ...consultationsQueries.revenue(id), enabled: valid });
  const sessions = useQuery({ ...consultationsQueries.sessionRequests(id), enabled: valid });
  const availability = useQuery({ ...consultationsQueries.availability(id), enabled: valid });

  const title = service.data && typeof service.data.title === "string" ? service.data.title : `${t("استشارة", "Consultation")} #${idParam}`;
  const bookingLink = service.data?.booking_link;
  // The B2C catalog product of this legacy consultation (slug `consultation-<legacy id>`).
  const slug = `consultation-${idParam}`;
  const products = useQuery({
    ...productQueries.list({ source: "b2c", product_type: "consultation", query: slug }),
    enabled: valid,
  });
  const product = products.data?.items.find((row) => row.slug === slug);

  return (
    <>
      <PageHead
        back={{ href: "/learning/consultations", label: t("الاستشارات", "Consultations") }}
        title={title}
        sub={`#${idParam}`}
        actions={
          product ? (
            <AppLink className="ma-btn ma-btn--soft" to={productHref(product.ref ?? `b2c:${product.product_id}`)}>
              {t("فتح في الكتالوج", "Open in catalog")}
            </AppLink>
          ) : null
        }
      />

      <PageState error={service.error}>
        {service.data ? (
          <>
            <div className="ma-cols ma-cols--2">
              <Card title={t("بيانات الخدمة", "Service")}>
                <div className="ma-cell-flex" style={{ marginBlockEnd: "var(--space-4)" }}>
                  <Avatar
                    initials={initialsOf(str(service.data.title) ?? "")}
                    src={str(service.data.image) ?? str(service.data.square_image)}
                    color="var(--coral)"
                    alt={title}
                    square
                    lg
                  />
                  <div>
                    <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>{title}</h3>
                    <div className="ma-cell-flex" style={{ marginBlockStart: "var(--space-1)" }}>
                      <Avatar
                        initials={initialsOf(str(service.data.consultant_name) ?? "")}
                        src={str(service.data.consultant_avatar)}
                        color="var(--purple)"
                        alt={str(service.data.consultant_name) ?? ""}
                      />
                      <span>
                        <span className="ma-cell-main">{str(service.data.consultant_name) ?? "—"}</span>
                        <span className="ma-cell-sub"><bdi>{str(service.data.consultant_email) ?? "—"}</bdi></span>
                      </span>
                    </div>
                  </div>
                </div>

                <Dl
                  rows={[
                    [t("المستشار / المدرب", "Consultant"), str(service.data.consultant_name) ?? "—"],
                    [t("بريد المستشار", "Consultant email"), <bdi key="e">{str(service.data.consultant_email) ?? "—"}</bdi>],
                    [t("المعرّف القديم", "Legacy id"), <span key="l" className="ma-num">{str(service.data.legacy_consultancy_id) ?? idParam}</span>],
                    [t("السعر", "Price"), service.data.price != null ? <span key="p" className="ma-num">{formatNumber(Number(service.data.price))}</span> : "—"],
                    [t("الجلسات", "Sessions"), service.data.sessions != null ? <span key="s" className="ma-num">{formatNumber(Number(service.data.sessions))}</span> : "—"],
                    [t("دقائق/جلسة", "Minutes / session"), service.data.session_minutes != null ? <span key="m" className="ma-num">{formatNumber(Number(service.data.session_minutes))}</span> : "—"],
                    [t("الحالة", "Status"), <Badge key="a" def={{ label: service.data.active ? { ar: "نشطة", en: "Active" } : { ar: "موقوفة", en: "Inactive" }, tone: service.data.active ? "success" : "warning" }} />],
                    [t("رابط الحجز", "Booking link"), isUrl(bookingLink) ? <a key="b" className="ma-link" href={String(bookingLink)} target="_blank" rel="noreferrer">{str(bookingLink)}</a> : str(bookingLink) ?? "—"],
                  ]}
                />
              </Card>

              <Card title={t("المراحل", "Milestones")}>
                {milestones.isLoading ? <Loading /> : <Milestones rows={milestones.data ?? []} />}
              </Card>
            </div>

            <Card title={t("معلومات الاستشارة", "Consultancy info")} className="ma-section-gap">
              {info.isLoading ? <Loading /> : <InfoSections rows={info.data ?? []} />}
            </Card>

            <Card title={t("طلبات الجلسات", "Session requests")} className="ma-section-gap">
              {sessions.isLoading ? <Loading /> : <SessionRequests rows={sessions.data ?? []} />}
            </Card>

            <Card title={t("الإيراد", "Revenue")} className="ma-section-gap">
              {revenue.isLoading ? <Loading /> : <Revenue revenue={revenue.data} />}
            </Card>

            <Card title={t("أوقات توفر الخبير", "Expert availability")} className="ma-section-gap">
              {availability.isLoading ? <Loading /> : <Availability rows={availability.data ?? []} />}
            </Card>
          </>
        ) : service.isLoading ? (
          <Loading />
        ) : (
          <Empty icon="calendar" text={t("لم يُعثر على الاستشارة.", "Consultation not found.")} />
        )}
      </PageState>
    </>
  );
}

function InfoSections({ rows }: { rows: ConsultationSection[] }) {
  const t = useT();
  const sections = rows
    .filter((row) => row.title || row.body)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.legacy_section_id - b.legacy_section_id);
  if (!sections.length) return <Empty text={t("لا معلومات.", "No info.")} />;
  return (
    <div className="ma-stack">
      {sections.map((row) => (
        <section key={row.legacy_section_id}>
          {row.title ? <h3 className="ma-subhead">{row.title}</h3> : null}
          <RichHtml html={row.body ?? null} />
        </section>
      ))}
    </div>
  );
}

function Milestones({ rows }: { rows: ConsultationMilestone[] }) {
  const t = useT();
  const [doneFilter, setDoneFilter] = useState("all");

  const filtered = useMemo(() => {
    return doneFilter === "all" ? rows : rows.filter((r) => (doneFilter === "done" ? Boolean(r.done) : !r.done));
  }, [rows, doneFilter]);

  const link = (value: string | null | undefined) =>
    isUrl(value) ? <a className="ma-link" href={String(value)} target="_blank" rel="noreferrer">{t("فتح", "Open")}</a> : "—";
  const columns: Column<ConsultationMilestone>[] = [
    { key: "id", header: t("المعرّف", "Id"), cell: (row) => <span className="ma-num">{row.legacy_milestone_id}</span> },
    { key: "order", header: t("الطلب", "Order"), cell: (row) => <span className="ma-num">{row.order_ref ?? "—"}</span> },
    { key: "done", header: t("مُنجز", "Done"), cell: (row) => <Badge def={{ label: row.done ? { ar: "نعم", en: "Yes" } : { ar: "لا", en: "No" }, tone: row.done ? "success" : "warning" }} /> },
    { key: "meeting", header: t("الاجتماع", "Meeting"), cell: (row) => formatDateTime(row.meeting_at) },
    { key: "scheduleLink", header: t("رابط الجدولة", "Schedule link"), cell: (row) => link(row.schedule_link) },
    { key: "meetingLink", header: t("رابط الاجتماع", "Meeting link"), cell: (row) => link(row.meeting_link) },
    { key: "recordingLink", header: t("التسجيل", "Recording"), cell: (row) => link(row.recording_link) },
  ];

  const toolbar = rows.length > 2 ? (
    <SelectField
      label={t("حالة الإنجاز", "Status")}
      value={doneFilter}
      onChange={setDoneFilter}
      options={[
        { value: "all", label: t("الكل", "All") },
        { value: "done", label: t("مُنجز", "Done") },
        { value: "pending", label: t("قيد التنفيذ", "Pending") },
      ]}
    />
  ) : undefined;

  return <DataTable rows={filtered} columns={columns} toolbar={toolbar} empty={t("لا مراحل.", "No milestones.")} />;
}

function SessionRequests({ rows }: { rows: ConsultationSessionRequest[] }) {
  const t = useT();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return rows;
    return rows.filter((r) => String(r.legacy_session_id).includes(search) || String(r.legacy_user_id ?? "").includes(search));
  }, [rows, search]);

  const yes = (value: boolean | null | undefined) => (value ? t("نعم", "yes") : t("لا", "no"));
  const columns: Column<ConsultationSessionRequest>[] = [
    { key: "id", header: t("المعرّف", "Id"), cell: (row) => <span className="ma-num">{row.legacy_session_id}</span> },
    { key: "user", header: t("المستخدم", "User"), cell: (row) => (row.legacy_user_id != null ? `#${row.legacy_user_id}` : "—") },
    { key: "date", header: t("التاريخ", "Date"), cell: (row) => formatDateTime(row.date) },
    { key: "time", header: t("الوقت", "Time"), cell: (row) => [row.day, row.hour, row.timezone].filter((v) => v != null && v !== "").join(" · ") || "—" },
    { key: "approved", header: t("مقبول", "Approved"), cell: (row) => yes(row.approved) },
    { key: "done", header: t("مُنجز", "Done"), cell: (row) => yes(row.done) },
  ];

  const toolbar = rows.length > 2 ? (
    <SearchBox placeholder={t("ابحث بالرقم…", "Search id…")} value={search} onChange={setSearch} />
  ) : undefined;

  return <DataTable rows={filtered} columns={columns} toolbar={toolbar} empty={t("لا طلبات.", "No requests.")} />;
}

function Revenue({ revenue }: { revenue?: ConsultationRevenue }) {
  const t = useT();
  if (!revenue) return <Empty text={t("لا بيانات.", "No data.")} />;
  return (
    <Dl
      rows={[
        [t("طلبات مدفوعة", "Paid orders"), <span key="o" className="ma-num">{formatNumber(revenue.orders)}</span>],
        [t("الإيراد", "Revenue"), <span key="r" className="ma-num">{formatAmount(revenue.revenue, revenue.currency)}</span>],
      ]}
    />
  );
}

function Availability({ rows }: { rows: AvailabilitySlot[] }) {
  const t = useT();
  const show = (value: unknown) => (value == null || value === "" ? "—" : String(value));
  const columns: Column<AvailabilitySlot>[] = [
    { key: "day", header: t("اليوم", "Day"), cell: (row) => show(row.day) },
    { key: "from", header: t("من", "From"), cell: (row) => show(row.from_hour) },
    { key: "to", header: t("إلى", "To"), cell: (row) => show(row.to_hour) },
    { key: "tz", header: t("المنطقة الزمنية", "Timezone"), cell: (row) => row.timezone ?? "—" },
  ];
  return <DataTable rows={rows} columns={columns} empty={t("لا أوقات.", "No availability.")} />;
}
