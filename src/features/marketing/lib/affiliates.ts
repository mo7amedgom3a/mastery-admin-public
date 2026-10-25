import type { BadgeDef } from "@/components/ui/kit";

const def = (ar: string, en: string, tone: BadgeDef["tone"]): BadgeDef => ({ label: { ar, en }, tone });

const PARTNER: Record<string, BadgeDef> = {
  active: def("نشط", "Active", "success"),
  pending: def("بانتظار الموافقة", "Pending", "warning"),
  suspended: def("موقوف", "Suspended", "danger"),
  rejected: def("مرفوض", "Rejected", "neutral"),
};
const SYNC: Record<string, BadgeDef> = {
  synced: def("متزامن مع Tolt", "Synced to Tolt", "success"),
  pending: def("بانتظار المزامنة", "Sync pending", "info"),
  failed: def("فشلت المزامنة", "Sync failed", "danger"),
  skipped: def("غير مرسل لـ Tolt", "Not in Tolt", "neutral"),
};
const CONVERSION: Record<string, BadgeDef> = {
  synced: def("مرسلة لـ Tolt", "In Tolt", "success"),
  pending_sync: def("بانتظار الإرسال", "Sending", "info"),
  failed: def("فشل الإرسال", "Send failed", "danger"),
  refund_pending: def("استرداد قيد الإرسال", "Refund sending", "warning"),
  refunded: def("مستردة", "Refunded", "neutral"),
  partially_refunded: def("استرداد جزئي", "Partly refunded", "warning"),
  skipped: def("بدون مبلغ نقدي", "No cash", "neutral"),
};
const COMMISSION: Record<string, BadgeDef> = {
  pending: def("معلّقة", "Pending", "warning"),
  approved: def("معتمدة", "Approved", "success"),
  paid: def("مدفوعة", "Paid", "success"),
  rejected: def("مرفوضة", "Rejected", "neutral"),
  refunded: def("مستردة", "Refunded", "neutral"),
};
const PAYOUT: Record<string, BadgeDef> = {
  requested: def("بانتظار المراجعة", "Requested", "warning"),
  approved: def("معتمد للدفع", "Approved", "info"),
  paid: def("مدفوع", "Paid", "success"),
  partially_paid: def("مدفوع جزئياً", "Partly paid", "success"),
  rejected: def("مرفوض", "Rejected", "danger"),
  cancelled: def("ألغاه المسوّق", "Cancelled", "neutral"),
};
const REWARD: Record<string, BadgeDef> = {
  pending: def("فترة انتظار", "Holding", "info"),
  granted: def("مُنحت", "Granted", "success"),
  revoked: def("أُلغيت", "Revoked", "neutral"),
};

const pick = (map: Record<string, BadgeDef>) => (status: string | null | undefined): BadgeDef =>
  map[status ?? ""] ?? def(status ?? "—", status ?? "—", "neutral");

export const partnerStatusBadge = pick(PARTNER);
export const syncStatusBadge = pick(SYNC);
export const conversionStatusBadge = pick(CONVERSION);
export const commissionStatusBadge = pick(COMMISSION);
export const rewardStatusBadge = pick(REWARD);
export const payoutStatusBadge = pick(PAYOUT);

const METHOD: Record<string, { ar: string; en: string }> = {
  paypal: { ar: "PayPal", en: "PayPal" },
  bank_transfer: { ar: "تحويل بنكي", en: "Bank transfer" },
  wise: { ar: "Wise", en: "Wise" },
  other: { ar: "طريقة أخرى", en: "Other" },
};

export const payoutMethodLabel = (method: string | null | undefined, lang: "ar" | "en"): string =>
  METHOD[method ?? ""]?.[lang] ?? method ?? "—";
