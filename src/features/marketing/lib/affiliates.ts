import type { BadgeDef } from "@/components/ui/kit";

const def = (ar: string, en: string, tone: BadgeDef["tone"]): BadgeDef => ({ label: { ar, en }, tone });

const PARTNER: Record<string, BadgeDef> = {
  active: def("نشط", "Active", "success"),
  pending: def("بانتظار الموافقة", "Pending", "warning"),
  suspended: def("موقوف", "Suspended", "danger"),
  rejected: def("مرفوض", "Rejected", "neutral"),
};
const CONNECT: Record<string, BadgeDef> = {
  none: def("لم يربط Stripe", "Stripe not connected", "neutral"),
  onboarding: def("يكمل بيانات Stripe", "Stripe onboarding", "info"),
  enabled: def("جاهز للتحويل", "Payouts ready", "success"),
  restricted: def("Stripe يطلب بيانات", "Stripe restricted", "danger"),
  unsupported: def("بلد غير مدعوم", "Country unsupported", "danger"),
};
const CONVERSION: Record<string, BadgeDef> = {
  recorded: def("مسجّلة", "Recorded", "success"),
  // History from before the move off Tolt.
  synced: def("مسجّلة", "Recorded", "success"),
  pending_sync: def("مسجّلة", "Recorded", "success"),
  failed: def("مسجّلة", "Recorded", "success"),
  refund_pending: def("مستردة", "Refunded", "neutral"),
  refunded: def("مستردة", "Refunded", "neutral"),
  partially_refunded: def("استرداد جزئي", "Partly refunded", "warning"),
  skipped: def("بدون مبلغ نقدي", "No cash", "neutral"),
};
const COMMISSION: Record<string, BadgeDef> = {
  pending: def("معلّقة", "Pending", "warning"),
  approved: def("معتمدة", "Approved", "success"),
  paid: def("مدفوعة", "Paid", "success"),
  reversed: def("ملغاة", "Reversed", "neutral"),
  rejected: def("مرفوضة", "Rejected", "neutral"),
  refunded: def("مستردة", "Refunded", "neutral"),
};
const PAYOUT: Record<string, BadgeDef> = {
  processing: def("قيد التحويل", "Processing", "info"),
  sent: def("أُرسلت للبنك", "Sent to bank", "info"),
  pending_confirmation: def("بانتظار التأكيد", "Needs confirmation", "warning"),
  paid: def("حُوّلت", "Paid", "success"),
  failed: def("فشل التحويل", "Failed", "danger"),
  returned: def("أعادها البنك", "Returned", "danger"),
  cancelled: def("أُلغيت", "Cancelled", "neutral"),
};
const BATCH: Record<string, BadgeDef> = {
  running: def("قيد التنفيذ", "Running", "info"),
  completed: def("مكتملة", "Completed", "success"),
  partial: def("مكتملة جزئيًا", "Partial", "warning"),
  failed: def("فشلت", "Failed", "danger"),
};
const REWARD: Record<string, BadgeDef> = {
  pending: def("فترة انتظار", "Holding", "info"),
  granted: def("مُنحت", "Granted", "success"),
  revoked: def("أُلغيت", "Revoked", "neutral"),
};

const pick = (map: Record<string, BadgeDef>) => (status: string | null | undefined): BadgeDef =>
  map[status ?? ""] ?? def(status ?? "—", status ?? "—", "neutral");

export const partnerStatusBadge = pick(PARTNER);
export const connectStatusBadge = pick(CONNECT);
export const payoutStatusBadge = pick(PAYOUT);

const PROVIDER: Record<string, { ar: string; en: string }> = {
  connect: { ar: "Stripe Connect", en: "Stripe Connect" },
  global: { ar: "تحويل بنكي (Global Payouts)", en: "Bank payout (Global Payouts)" },
  none: { ar: "غير محدد", en: "Not set" },
};
export const payoutProviderLabel = (provider: string | null | undefined, lang: "ar" | "en"): string =>
  PROVIDER[provider ?? "none"]?.[lang] ?? provider ?? "—";
export const batchStatusBadge = pick(BATCH);
export const conversionStatusBadge = pick(CONVERSION);
export const commissionStatusBadge = pick(COMMISSION);
export const rewardStatusBadge = pick(REWARD);

const METHOD: Record<string, { ar: string; en: string }> = {
  paypal: { ar: "PayPal", en: "PayPal" },
  bank_transfer: { ar: "تحويل بنكي", en: "Bank transfer" },
  wise: { ar: "Wise", en: "Wise" },
  other: { ar: "طريقة أخرى", en: "Other" },
};

export const payoutMethodLabel = (method: string | null | undefined, lang: "ar" | "en"): string =>
  METHOD[method ?? ""]?.[lang] ?? method ?? "—";
