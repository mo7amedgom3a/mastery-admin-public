import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { useT } from "@/lib/i18n";
import { formatAmount, formatNumber } from "@/lib/format";
import { productHref, studioHref } from "@/lib/refs";
import { initialsOf } from "@/lib/status";
import { AppLink } from "@/components/ui/app-link";
import { Avatar, Badge, Card, Dl, Empty, ErrorAlert, Kpi, Loading } from "@/components/ui/kit";
import { consultationAdminQueries, type ProductView } from "@/lib/api";
import { AvailabilityTab } from "@/features/consultations/components/availability-tab";
import { BookingsTable } from "@/features/consultations/components/bookings-table";

/*
 * The tabs of a consultation product: its details and page content (Studio), its expert, its bookings and the
 * expert's bookable slots. Slots belong to the expert, so every consultation of that expert shares them.
 */

/** The consultation's expert (B2C consultant) and its service row on that expert. */
function useConsultationExpert(data: ProductView) {
  const consultantId = data.product.consultant_id ?? null;
  const expert = useQuery({ ...consultationAdminQueries.expert(consultantId ?? ""), enabled: consultantId != null, retry: false });
  const service = (expert.data?.services ?? []).find((row) => row.product_id === data.product.product_id) ?? null;
  return { consultantId, expert, service };
}

function NoExpert() {
  const t = useT();
  return (
    <Card>
      <Empty
        icon="user"
        text={t(
          "لا خبير مرتبط بهذه الاستشارة. اربطها بخبير من صفحة الخبراء لإدارة الحجوزات والمواعيد.",
          "This consultation has no expert. Link it to an expert from the Experts page to manage bookings and slots.",
        )}
      />
      <div style={{ marginBlockStart: 12 }}>
        <AppLink className="ma-btn ma-btn--soft" to="/consultations/experts">{t("الخبراء", "Experts")}</AppLink>
      </div>
    </Card>
  );
}

/** Main details: status, price, prices per currency and the Studio that writes the consultation page. */
export function ConsultationTab({ data, productRef }: { data: ProductView; productRef: string }) {
  const t = useT();
  const b2c = data.b2c;
  const item = data.product;
  const currency = item.price_currency ?? "USD";
  const { service } = useConsultationExpert(data);

  return (
    <div className="ma-stack" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card
        title={t("محتوى صفحة الاستشارة", "Consultation page content")}
        actions={
          <AppLink className="ma-btn ma-btn--primary ma-btn--sm" to={studioHref(productRef)}>
            {t("فتح استوديو الاستشارة", "Open the consultation studio")}
          </AppLink>
        }
      >
        <p className="ma-muted">
          {t(
            "يُكتب وصف الاستشارة وكل محتوى صفحتها في الاستوديو (README والمحرر) ويظهر مباشرة على المتجر.",
            "The consultation description and everything on its page are written in the Studio (README and editor) and show straight away on the storefront.",
          )}
        </p>
      </Card>

      <Card title={t("تفاصيل الاستشارة", "Consultation details")}>
        <Dl
          rows={[
            [t("الحالة", "Status"), item.status],
            [t("السعر", "Price"), <span key="p" className="ma-num">{item.price != null ? formatAmount(item.price, currency) : "—"}</span>],
            [t("الرابط", "Slug"), item.slug],
            [t("مدة الجلسة", "Session length"), service?.duration_minutes ? `${service.duration_minutes} ${t("د", "min")}` : "—"],
            [t("مدة الوصول (أيام)", "Access days"), b2c?.access_duration_days != null ? String(b2c.access_duration_days) : "—"],
          ]}
        />
        {b2c?.short_description ? <p className="ma-muted" style={{ marginTop: 12 }}>{b2c.short_description}</p> : null}
      </Card>

      {b2c?.prices?.length ? (
        <Card title={t("الأسعار حسب العملة", "Prices by currency")}>
          <Dl
            rows={b2c.prices.map((price): [string, string] => [
              `${price.currency}${price.country_code ? ` · ${price.country_code}` : ""}`,
              formatAmount(price.amount, price.currency),
            ])}
          />
        </Card>
      ) : null}
    </div>
  );
}

/** The expert giving the consultation and their other services. */
export function ConsultationExpertTab({ data }: { data: ProductView }) {
  const t = useT();
  const item = data.product;
  const currency = item.price_currency ?? "USD";
  const { consultantId, expert } = useConsultationExpert(data);
  if (!consultantId) return <NoExpert />;
  const e = expert.data;
  const expertName = e?.display_name ?? item.instructor ?? null;
  const otherServices = (e?.services ?? []).filter((service) => service.product_id !== item.product_id);

  return (
    <div className="ma-stack" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {expert.isLoading ? <Loading /> : null}
      <ErrorAlert error={expert.error} />
      {e ? (
        <div className="ma-kpis">
          <Kpi label={t("الحجوزات", "Bookings")} value={formatNumber(e.bookings_count)} icon="calendar" />
          <Kpi label={t("القادمة", "Upcoming")} value={formatNumber(e.upcoming_count)} icon="clock" />
          <Kpi label={t("مواعيد متاحة", "Free slots")} value={formatNumber(e.free_slots)} icon="video" />
        </div>
      ) : null}
      <Card
        title={t("الخبير", "Expert")}
        actions={
          <AppLink className="ma-btn ma-btn--soft ma-btn--sm" to={`/consultations/experts/${consultantId}`}>
            {t("فتح صفحة الخبير", "Open expert page")}
          </AppLink>
        }
      >
        <div className="ma-cell-flex" style={{ marginBlockEnd: "var(--space-4)" }}>
          <Avatar initials={initialsOf(expertName ?? "?")} src={item.instructor_avatar} color="var(--purple)" lg alt={expertName ?? ""} />
          <span>
            <AppLink className="ma-cell-main ma-link" to={`/consultations/experts/${consultantId}`}>{expertName ?? "—"}</AppLink>
            {e?.email ? <span className="ma-cell-sub"><bdi>{e.email}</bdi></span> : null}
          </span>
        </div>
        {e ? (
          <Dl
            rows={[
              [t("الحالة", "Status"), <Badge key="s" def={{ tone: e.status === "active" ? "success" : "neutral", label: e.status === "active" ? { ar: "نشط", en: "Active" } : { ar: "غير نشط", en: "Inactive" } }} />],
              [t("الهاتف", "Phone"), <bdi key="p">{e.phone ?? "—"}</bdi>],
              [t("مدة الجلسة", "Session length"), e.session_minutes ? `${e.session_minutes} ${t("د", "min")}` : "—"],
              [t("عدد الخدمات", "Services"), formatNumber(e.services.length)],
            ]}
          />
        ) : null}
        {e?.bio ? <p className="ma-muted" style={{ marginBlockStart: 12 }}>{e.bio}</p> : null}
      </Card>
      {otherServices.length ? (
        <Card title={t("خدمات أخرى لنفس الخبير", "Other services by this expert")}>
          <Dl
            rows={otherServices.map((service): [ReactNode, ReactNode] => [
              <AppLink key={service.service_id} className="ma-link" to={productHref(`b2c:${service.product_id}`)}>{service.title ?? "—"}</AppLink>,
              service.price_amount != null ? formatAmount(Number(service.price_amount), service.currency_code ?? currency) : "—",
            ])}
          />
        </Card>
      ) : null}
    </div>
  );
}

/** Bookings of this consultation (its service on the expert). */
export function ConsultationBookingsTab({ data }: { data: ProductView }) {
  const t = useT();
  const { consultantId, expert, service } = useConsultationExpert(data);
  if (!consultantId) return <NoExpert />;
  if (expert.isLoading) return <Loading />;
  if (!service) {
    return (
      <Card>
        <Empty icon="calendar" text={t("لا خدمة حجز لهذه الاستشارة عند الخبير.", "The expert has no booking service for this consultation.")} />
      </Card>
    );
  }
  return (
    <Card title={t("حجوزات الاستشارة", "Consultation bookings")}>
      <BookingsTable consultantId={consultantId} serviceId={service.service_id} hideExpert />
    </Card>
  );
}

/** The expert's bookable slots: calendar, add availability, move or delete free slots. */
export function ConsultationAvailabilityTab({ data }: { data: ProductView }) {
  const t = useT();
  const { consultantId, expert } = useConsultationExpert(data);
  if (!consultantId) return <NoExpert />;
  if (expert.isLoading) return <Loading />;
  if (!expert.data) return <ErrorAlert error={expert.error} />;
  return (
    <div className="ma-stack" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p className="ma-help">
        {t(
          "المواعيد للخبير نفسه، فتظهر لكل استشاراته.",
          "Slots belong to the expert, so they are shared by all of the expert's consultations.",
        )}
      </p>
      <AvailabilityTab expert={expert.data} />
    </div>
  );
}
