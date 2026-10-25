import type { ReactNode } from "react";

import type { SubscriptionPlan } from "@/lib/api";
import { formatAmount, formatNumber } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n";
import { productStatusBadge } from "@/lib/status";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/kit";

import { FeatureIcon } from "./feature-icon";
import { AUDIENCE_LABELS, PER_INTERVAL, PLAN_TYPE_LABELS, cardFeaturesFor, labelOf, planTitle, toNumber } from "../lib";

/**
 * The plan as customers see it on the pricing page (price, struck-through original while a
 * discount runs, card bullets) plus admin facts (status, subscribers). `actions` go in the footer.
 */
export function PlanCard({ plan, actions, showStats = true }: { plan: SubscriptionPlan; actions?: ReactNode; showStats?: boolean }) {
  const t = useT();
  const lang = useLang();
  const features = cardFeaturesFor(plan, lang);
  const per = labelOf(PER_INTERVAL, plan.billing_interval);
  const discount = plan.discount;

  return (
    <article className={cn("ma-plancard", plan.is_featured && "ma-plancard--featured")}>
      <div className="ma-plancard__head">
        <div style={{ minWidth: 0 }}>
          <h3 className="ma-plancard__title">{planTitle(plan, lang)}</h3>
          <bdi className="ma-plancard__slug">{plan.slug}</bdi>
        </div>
        <Badge def={productStatusBadge(plan.status)} />
      </div>

      <div className="ma-plancard__badges">
        <span className="ma-badge ma-badge--neutral">{t(labelOf(PLAN_TYPE_LABELS, plan.plan_type).ar, labelOf(PLAN_TYPE_LABELS, plan.plan_type).en)}</span>
        <span className="ma-badge ma-badge--neutral">{t(labelOf(AUDIENCE_LABELS, plan.audience_type).ar, labelOf(AUDIENCE_LABELS, plan.audience_type).en)}</span>
        {plan.audience_type === "company" ? (
          <span className="ma-badge ma-badge--neutral">
            {t(`${plan.min_seats ?? 1}–${plan.max_seats} موظفًا`, `${plan.min_seats ?? 1}–${plan.max_seats} employees`)}
          </span>
        ) : null}
        {plan.is_featured ? <span className="ma-badge ma-badge--info">{t("مميّزة", "Featured")}</span> : null}
        {discount ? (
          <span className={cn("ma-badge", discount.is_active ? "ma-badge--success" : "ma-badge--warning")}>
            {discount.label ?? t("خصم", "Discount")} ·{" "}
            {discount.discount_type === "percent" ? `${toNumber(discount.value)}%` : formatAmount(toNumber(discount.value), plan.currency_code)}
            {discount.is_active ? null : ` · ${t("غير فعّال", "inactive")}`}
          </span>
        ) : null}
      </div>

      <div className="ma-plancard__price">
        <span className="ma-plancard__amount">{formatAmount(toNumber(plan.effective_price), plan.currency_code)}</span>
        <span className="ma-plancard__interval">
          {plan.audience_type === "company" ? t(`لكل موظف ${per.ar}`, `per employee ${per.en}`) : t(per.ar, per.en)}
        </span>
        {plan.compare_at_price ? (
          <span className="ma-plancard__was">{formatAmount(toNumber(plan.compare_at_price), plan.currency_code)}</span>
        ) : null}
      </div>

      {(plan.plan_features ?? []).some((f) => f.is_highlighted) ? (
        <ul className="ma-plancard__highlights">
          {(plan.plan_features ?? []).filter((f) => f.is_highlighted).map((f) => (
            <li key={f.feature_id}>
              <span className="ma-featureicon"><FeatureIcon name={f.icon} size={16} /></span>
              <span>
                {t(f.title_ar, f.title_en)}
                {f.value_ar || f.value_en ? <small> · {t(f.value_ar ?? f.value_en ?? "", f.value_en ?? f.value_ar ?? "")}</small> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {features.length ? (
        <ul className="ma-plancard__features">
          {features.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="ma-plancard__empty">{t("لا توجد عناصر على البطاقة بعد.", "No card items yet.")}</p>
      )}

      {showStats ? (
        <div className="ma-plancard__stats">
          <span>{t("مشتركون نشطون", "Active")}: <strong>{formatNumber(plan.active_subscribers ?? 0)}</strong></span>
          <span>{t("الإجمالي", "All-time")}: <strong>{formatNumber(plan.total_subscribers ?? 0)}</strong></span>
          <span>{t("الموارد", "Resources")}: <strong>{formatNumber(plan.products?.length ?? 0)}</strong></span>
          <span>v{plan.version}</span>
        </div>
      ) : null}

      {actions ? <div className="ma-plancard__actions">{actions}</div> : null}
    </article>
  );
}
