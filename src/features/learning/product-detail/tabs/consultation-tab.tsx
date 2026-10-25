import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { useT } from "@/lib/i18n";
import { formatAmount, formatNumber } from "@/lib/format";
import { productHref, studioHref } from "@/lib/refs";
import { initialsOf } from "@/lib/status";
import { AppLink } from "@/components/ui/app-link";
import { Avatar, Badge, Card, Dl } from "@/components/ui/kit";
import { consultationAdminQueries, type ProductView } from "@/lib/api";

/**
 * A consultation product in B2C (its price, currency prices and access). Booking sessions, availability and
 * revenue live on the legacy consultation service, reached from the Consultations section.
 */
export function ConsultationTab({ data, productRef }: { data: ProductView; productRef: string }) {
  const t = useT();
  const b2c = data.b2c;
  const item = data.product;
  const currency = item.price_currency ?? "USD";
  const consultantId = item.consultant_id ?? null;
  const expert = useQuery({ ...consultationAdminQueries.expert(consultantId ?? ""), enabled: consultantId != null, retry: false });
  const e = expert.data;
  const expertName = e?.display_name ?? item.instructor ?? null;
  const otherServices = (e?.services ?? []).filter((service) => service.product_id !== item.product_id);

  return (
    <div className="ma-stack" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {consultantId ? (
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
                [t("مدة الجلسة", "Session length"), e.session_minutes ? `${e.session_minutes} ${t("د", "min")}` : "—"],
                [t("عدد الخدمات", "Services"), formatNumber(e.services.length)],
                [t("الحجوزات", "Bookings"), formatNumber(e.bookings_count)],
                [t("القادمة", "Upcoming"), formatNumber(e.upcoming_count)],
                [t("مواعيد متاحة", "Free slots"), formatNumber(e.free_slots)],
              ]}
            />
          ) : null}
          {e?.bio ? <p className="ma-muted" style={{ marginBlockStart: 12 }}>{e.bio}</p> : null}
          {otherServices.length ? (
            <div style={{ marginBlockStart: 12 }}>
              <strong>{t("خدمات أخرى لنفس الخبير", "Other services by this expert")}</strong>
              <Dl
                rows={otherServices.map((service): [ReactNode, ReactNode] => [
                  <AppLink key={service.service_id} className="ma-link" to={productHref(`b2c:${service.product_id}`)}>{service.title ?? "—"}</AppLink>,
                  service.price_amount != null ? formatAmount(Number(service.price_amount), service.currency_code ?? currency) : "—",
                ])}
              />
            </div>
          ) : null}
        </Card>
      ) : null}

      <Card title={t("الاستشارة", "Consultation")}>
        <Dl
          rows={[
            [t("الحالة", "Status"), item.status],
            [t("السعر", "Price"), <span key="p" className="ma-num">{item.price != null ? formatAmount(item.price, currency) : "—"}</span>],
            [t("الرابط", "Slug"), item.slug],
            [t("مدة الوصول (أيام)", "Access days"), b2c?.access_duration_days != null ? String(b2c.access_duration_days) : "—"],
          ]}
        />
        {b2c?.short_description ? <p className="ma-muted" style={{ marginTop: 12 }}>{b2c.short_description}</p> : null}
      </Card>

      {b2c?.prices?.length ? (
        <Card title={t("الأسعار حسب العملة", "Prices by currency")} className="ma-section-gap">
          <Dl
            rows={b2c.prices.map((price): [string, string] => [
              `${price.currency}${price.country_code ? ` · ${price.country_code}` : ""}`,
              formatAmount(price.amount, price.currency),
            ])}
          />
        </Card>
      ) : null}

      <Card title={t("محتوى صفحة الاستشارة", "Consultation page content")}>
        <p className="ma-muted" style={{ marginBlockEnd: 12 }}>
          {t(
            "يُكتب وصف الاستشارة وكل محتوى صفحتها في الاستوديو (README والمحرر) ويظهر مباشرة على المتجر.",
            "The consultation description and everything on its page are written in the Studio (README and editor) and show straight away on the storefront.",
          )}
        </p>
        <AppLink className="ma-btn ma-btn--primary" to={studioHref(productRef)}>
          {t("فتح استوديو الاستشارة", "Open the consultation studio")}
        </AppLink>
      </Card>

      <Card title={t("جلسات الاستشارة والمواعيد", "Sessions & availability")} className="ma-section-gap">
        <p className="ma-muted">
          {t(
            "تُدار مواعيد الجلسات وتوفر الخبير والإيرادات في قسم الاستشارات (النظام القديم).",
            "Session bookings, expert availability and revenue are managed in the Consultations section (legacy).",
          )}
        </p>
        <div style={{ marginTop: 12 }}>
          <AppLink className="ma-btn ma-btn--soft" to={consultantId ? `/consultations/experts/${consultantId}?tab=bookings` : "/learning/consultations"}>
            {consultantId ? t("حجوزات الخبير", "Expert's bookings") : t("فتح الاستشارات", "Open consultations")}
          </AppLink>
        </div>
      </Card>
    </div>
  );
}
