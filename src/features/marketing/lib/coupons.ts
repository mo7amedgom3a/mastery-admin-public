import type { BadgeDef } from "@/components/ui/kit";
import type { Coupon } from "@/lib/api";
import { formatMinor } from "@/lib/format";

const COUPON_STATUS: Record<Coupon["status"], BadgeDef> = {
  active: { label: { ar: "مفعّل", en: "Active" }, tone: "success" },
  scheduled: { label: { ar: "مجدول", en: "Scheduled" }, tone: "info" },
  inactive: { label: { ar: "موقوف", en: "Inactive" }, tone: "warning" },
  expired: { label: { ar: "منتهي", en: "Expired" }, tone: "neutral" },
  archived: { label: { ar: "مؤرشف", en: "Archived" }, tone: "neutral" },
};

export const couponStatusBadge = (status: Coupon["status"]): BadgeDef => COUPON_STATUS[status];

/** "20%" or "$10.00", with the cap for capped percentages. */
export function couponValueLabel(coupon: Pick<Coupon, "kind" | "value" | "currency_code" | "max_discount_minor">): string {
  if (coupon.kind === "fixed") return formatMinor(Math.round(Number(coupon.value) * 100), coupon.currency_code);
  const percent = `${Number(coupon.value)}%`;
  return coupon.max_discount_minor ? `${percent} ≤ ${formatMinor(coupon.max_discount_minor, coupon.currency_code)}` : percent;
}

const VOUCHER_STATUS: Record<string, BadgeDef> = {
  active: { label: { ar: "فعّالة", en: "Active" }, tone: "success" },
  exhausted: { label: { ar: "مستنفدة", en: "Used up" }, tone: "neutral" },
  expired: { label: { ar: "منتهية", en: "Expired" }, tone: "warning" },
  revoked: { label: { ar: "ملغاة", en: "Revoked" }, tone: "danger" },
};

export const voucherStatusBadge = (status: string): BadgeDef =>
  VOUCHER_STATUS[status] ?? { label: { ar: status, en: status }, tone: "neutral" };

export const VOUCHER_TXN_LABELS: Record<string, { ar: string; en: string }> = {
  issue: { ar: "إصدار", en: "Issued" },
  reserve: { ar: "حجز عند الدفع", en: "Held at checkout" },
  capture: { ar: "استُخدمت", en: "Spent" },
  release: { ar: "أُعيد الحجز", en: "Hold released" },
  refund_restore: { ar: "استرداد", en: "Refund restored" },
  expire: { ar: "انتهاء", en: "Expired" },
  adjust: { ar: "تعديل", en: "Adjusted" },
  revoke: { ar: "إلغاء", en: "Revoked" },
};
