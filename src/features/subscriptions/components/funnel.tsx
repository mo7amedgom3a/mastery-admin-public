import type { SubscriptionFunnelRow } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";

/** Viewed → checkout started → paid for one plan (or a total), with step conversion. */
export function PlanFunnel({ row }: { row: Pick<SubscriptionFunnelRow, "viewed" | "checkout_started" | "paid"> }) {
  const t = useT();
  const max = Math.max(row.viewed, row.checkout_started, row.paid, 1);
  // A later step can outnumber an earlier one when it predates view tracking; no rate then.
  const rate = (num: number, den: number) => (den > 0 && num <= den ? `${((num * 100) / den).toFixed(1)}%` : "—");
  const steps = [
    { label: t("شاهدوا الباقة", "Viewed the plan"), value: row.viewed, color: "var(--sky)", note: null },
    {
      label: t("بدأوا الدفع", "Started checkout"),
      value: row.checkout_started,
      color: "var(--purple)",
      note: t(`${rate(row.checkout_started, row.viewed)} من المشاهدين`, `${rate(row.checkout_started, row.viewed)} of viewers`),
    },
    {
      label: t("دفعوا واشتركوا", "Paid & subscribed"),
      value: row.paid,
      color: "var(--green)",
      note: t(
        `${rate(row.paid, row.checkout_started)} ممن بدأوا الدفع · ${rate(row.paid, row.viewed)} من المشاهدين`,
        `${rate(row.paid, row.checkout_started)} of checkouts · ${rate(row.paid, row.viewed)} of viewers`,
      ),
    },
  ];
  return (
    <div className="ma-funnel">
      {steps.map((step) => (
        <div className="ma-funnel__step" key={step.label}>
          <div className="ma-funnel__row">
            <span>{step.label}</span>
            <strong className="ma-num">{formatNumber(step.value)}</strong>
          </div>
          <div className="ma-funnel__track">
            <div className="ma-funnel__fill" style={{ width: `${Math.max(2, (step.value / max) * 100)}%`, background: step.color }} />
          </div>
          {step.note ? <span className="ma-funnel__rate">{step.note}</span> : null}
        </div>
      ))}
      {row.checkout_started > row.viewed ? (
        <span className="ma-help">
          {t(
            "تُسجَّل مشاهدات صفحات الباقات منذ إطلاق هذه الميزة فقط، لذا قد تكون عمليات الدفع الأقدم أكثر من المشاهدات.",
            "Plan page views are recorded only since this feature launched, so older checkouts can outnumber views.",
          )}
        </span>
      ) : null}
    </div>
  );
}
