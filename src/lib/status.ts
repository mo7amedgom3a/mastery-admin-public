import type { BadgeDef } from "@/components/ui/kit";

/** Status labels always carry a word (kit rule 10); tone adds the coloured square. */
export function orderStatusBadge(status: string | null | undefined): BadgeDef | null {
  switch (status) {
    case "created":
      return { label: { ar: "جديد", en: "Created" }, tone: "info" };
    case "pending_payment":
      return { label: { ar: "بانتظار الدفع", en: "Pending payment" }, tone: "warning" };
    case "paid":
      return { label: { ar: "مدفوع", en: "Paid" }, tone: "success" };
    case "fulfilled":
      return { label: { ar: "مكتمل", en: "Fulfilled" }, tone: "success" };
    case "cancelled":
      return { label: { ar: "ملغى", en: "Cancelled" }, tone: "danger" };
    case "payment_failed":
      return { label: { ar: "فشل الدفع", en: "Payment failed" }, tone: "danger" };
    case "refunded":
      return { label: { ar: "مُسترد", en: "Refunded" }, tone: "info" };
    case "partially_refunded":
      return { label: { ar: "مُسترد جزئيًا", en: "Partially refunded" }, tone: "info" };
    case "expired":
      return { label: { ar: "منتهي", en: "Expired" }, tone: "neutral" };
    default:
      return status ? { label: { ar: status, en: status } } : null;
  }
}

export function paymentStatusBadge(status: string | null | undefined): BadgeDef | null {
  switch (status) {
    case "pending":
      return { label: { ar: "بانتظار", en: "Pending" }, tone: "warning" };
    case "succeeded":
      return { label: { ar: "ناجح", en: "Succeeded" }, tone: "success" };
    case "failed":
      return { label: { ar: "فاشل", en: "Failed" }, tone: "danger" };
    case "refunded":
      return { label: { ar: "مُسترد", en: "Refunded" }, tone: "info" };
    case "partially_refunded":
      return { label: { ar: "مُسترد جزئيًا", en: "Partially refunded" }, tone: "info" };
    case "cancelled":
      return { label: { ar: "ملغى", en: "Cancelled" }, tone: "neutral" };
    default:
      return status ? { label: { ar: status, en: status } } : null;
  }
}

/** Refund case workflow, in review order. The single source for the refunds filter, KPIs and badges. */
export const REFUND_CASE_STATUSES = [
  "requested",
  "processing",
  "pending",
  "requires_action",
  "needs_reconciliation",
  "succeeded",
  "failed",
  "rejected",
  "canceled",
] as const;

export function refundCaseStatusBadge(status: string | null | undefined): BadgeDef | null {
  switch (status) {
    case "requested":
      return { label: { ar: "بانتظار القرار", en: "Awaiting decision" }, tone: "warning" };
    case "processing":
      return { label: { ar: "قيد التنفيذ", en: "Processing" }, tone: "info" };
    case "pending":
      return { label: { ar: "معلّق لدى البوابة", en: "Pending at gateway" }, tone: "info" };
    case "requires_action":
      return { label: { ar: "يتطلب إجراء", en: "Requires action" }, tone: "warning" };
    case "needs_reconciliation":
      return { label: { ar: "يحتاج مطابقة", en: "Needs reconciliation" }, tone: "danger" };
    case "succeeded":
      return { label: { ar: "تم الاسترداد", en: "Refunded" }, tone: "success" };
    case "failed":
      return { label: { ar: "فشل", en: "Failed" }, tone: "danger" };
    case "rejected":
      return { label: { ar: "مرفوض", en: "Rejected" }, tone: "neutral" };
    case "canceled":
      return { label: { ar: "ملغى", en: "Canceled" }, tone: "neutral" };
    default:
      return status ? { label: { ar: status, en: status } } : null;
  }
}

const REFUND_REASONS: Record<string, { ar: string; en: string }> = {
  open_request_exists: { ar: "يوجد طلب آخر قيد المراجعة", en: "Another request is open" },
  learning_started: { ar: "بدأ التعلم", en: "Learning started" },
  outside_30_day_window: { ar: "تجاوز 30 يومًا", en: "Outside 30 days" },
  payment_not_captured: { ar: "الدفع غير مكتمل", en: "Payment not captured" },
  unallocated_existing_refund: { ar: "استرداد سابق غير مرتبط بطلب", en: "Earlier refund not linked to a case" },
  fully_refunded_or_reserved: { ar: "مسترد بالكامل أو محجوز", en: "Fully refunded or reserved" },
  consultation_not_provider_failed: { ar: "الاستشارة غير مؤهلة", en: "Consultation not eligible" },
  customer_cancelled_or_missed: { ar: "إلغاء العميل أو غيابه", en: "Customer cancelled or missed" },
  subscription_period_ended: { ar: "انتهت فترة الاشتراك", en: "Subscription period ended" },
  subscription_period_missing: { ar: "فترة الاشتراك غير معروفة", en: "Subscription period unknown" },
  resource_mapping_missing: { ar: "ربط الموارد بالمنصة ناقص", en: "LMS resource mapping missing" },
  unsupported_product_type: { ar: "نوع منتج غير مدعوم", en: "Unsupported product type" },
  verification_unavailable: { ar: "تعذّر التحقق من المنصة", en: "LMS check unavailable" },
};

export function refundReasonLabel(code: string): { ar: string; en: string } {
  return REFUND_REASONS[code] ?? { ar: code, en: code };
}

const REFUND_EVENTS: Record<string, { ar: string; en: string }> = {
  requested: { ar: "طلب العميل الاسترداد", en: "Customer requested a refund" },
  admin_created: { ar: "أنشأت الإدارة الطلب", en: "Created by an admin" },
  approved: { ar: "تمت الموافقة", en: "Approved" },
  rejected: { ar: "تم الرفض", en: "Rejected" },
  provider_status: { ar: "تحديث من البوابة", en: "Gateway update" },
  provider_uncertain: { ar: "استجابة البوابة غير مؤكدة", en: "Gateway response uncertain" },
  expert_service_failure: { ar: "تعذّر تقديم الاستشارة", en: "Expert service failure" },
};

export function refundEventLabel(code: string): { ar: string; en: string } {
  return REFUND_EVENTS[code] ?? { ar: code, en: code };
}

export function customerStatusBadge(status: string | null | undefined): BadgeDef | null {
  switch (status) {
    case "active":
      return { label: { ar: "نشط", en: "Active" }, tone: "success" };
    case "suspended":
      return { label: { ar: "موقوف", en: "Suspended" }, tone: "warning" };
    case "blocked":
      return { label: { ar: "محظور", en: "Blocked" }, tone: "danger" };
    default:
      return status ? { label: { ar: status, en: status } } : null;
  }
}

export function productStatusBadge(status: string | null | undefined): BadgeDef | null {
  switch (status) {
    case "published":
      return { label: { ar: "منشور", en: "Published" }, tone: "success" };
    case "draft":
      return { label: { ar: "مسودة", en: "Draft" }, tone: "warning" };
    case "unpublished":
      return { label: { ar: "غير منشور", en: "Unpublished" }, tone: "warning" };
    case "archived":
      return { label: { ar: "مؤرشف", en: "Archived" }, tone: "neutral" };
    default:
      return status ? { label: { ar: status, en: status } } : null;
  }
}

/** Customer subscription status (`b2c.subscriptions.status`). */
export function subscriberStatusBadge(status: string | null | undefined): BadgeDef | null {
  switch (status) {
    case "active":
      return { label: { ar: "نشط", en: "Active" }, tone: "success" };
    case "pending":
      return { label: { ar: "قيد التفعيل", en: "Pending" }, tone: "info" };
    case "past_due":
      return { label: { ar: "متأخر السداد", en: "Past due" }, tone: "warning" };
    case "canceled":
      return { label: { ar: "ملغي", en: "Canceled" }, tone: "danger" };
    case "expired":
      return { label: { ar: "منتهي", en: "Expired" }, tone: "neutral" };
    default:
      return status ? { label: { ar: status, en: status } } : null;
  }
}

export function affiliateStatusBadge(status: string | null | undefined): BadgeDef | null {
  switch (status) {
    case "pending":
      return { label: { ar: "قيد المراجعة", en: "Pending" }, tone: "warning" };
    case "approved":
      return { label: { ar: "معتمد", en: "Approved" }, tone: "success" };
    case "refused":
      return { label: { ar: "مرفوض", en: "Refused" }, tone: "danger" };
    default:
      return status ? { label: { ar: status, en: status } } : null;
  }
}

/** Colour per course track, kept consistent across media, tags and chart marks. */
export const PALETTE = ["var(--coral)", "var(--yellow)", "var(--purple)", "var(--sky)", "var(--pink)", "var(--teal)", "var(--lilac)", "var(--green)"];

/** Initials for an avatar from a name or email (emails use their local part). */
export function initialsOf(name: string | null | undefined, fallback = "MA"): string {
  if (!name) return fallback;
  const value = name.includes("@") ? (name.split("@")[0] ?? name) : name;
  const parts = value.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase() || fallback;
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase() || fallback;
}

/** Booking lifecycle of a B2C consultation (labels match the student/expert apps). */
export function bookingStatusBadge(status: string | null | undefined): BadgeDef | null {
  switch (status) {
    case "pending_payment":
      return { label: { ar: "بانتظار الدفع", en: "Pending payment" }, tone: "warning" };
    case "expired":
      return { label: { ar: "منتهي", en: "Expired" }, tone: "neutral" };
    case "awaiting_approval":
      return { label: { ar: "بانتظار موافقة الخبير", en: "Awaiting expert" }, tone: "warning" };
    case "confirmed":
      return { label: { ar: "مؤكد", en: "Confirmed" }, tone: "info" };
    case "in_progress":
      return { label: { ar: "جارٍ", en: "In progress" }, tone: "info" };
    case "completed":
      return { label: { ar: "مكتمل", en: "Completed" }, tone: "success" };
    case "rejected":
      return { label: { ar: "مرفوض", en: "Rejected" }, tone: "danger" };
    case "refund_pending":
      return { label: { ar: "بانتظار الاسترداد", en: "Refund pending" }, tone: "danger" };
    case "no_show_customer":
      return { label: { ar: "غياب الطالب", en: "Student no-show" }, tone: "danger" };
    case "no_show_expert":
      return { label: { ar: "غياب الخبير", en: "Expert no-show" }, tone: "danger" };
    case "cancelled":
      return { label: { ar: "ملغى", en: "Cancelled" }, tone: "neutral" };
    default:
      return status ? { label: { ar: status, en: status } } : null;
  }
}

export function slotStateBadge(state: string | null | undefined): BadgeDef | null {
  switch (state) {
    case "free":
      return { label: { ar: "متاح", en: "Free" }, tone: "success" };
    case "held":
      return { label: { ar: "محجوز مؤقتًا", en: "Held" }, tone: "warning" };
    case "booked":
      return { label: { ar: "محجوز", en: "Booked" }, tone: "info" };
    default:
      return state ? { label: { ar: state, en: state } } : null;
  }
}

/** A customer's access to a product (`active` past its expiry is reported as `expired` by the API). */
export function entitlementStatusBadge(status: string | null | undefined): BadgeDef | null {
  switch (status) {
    case "active":
      return { label: { ar: "فعّال", en: "Active" }, tone: "success" };
    case "expired":
      return { label: { ar: "منتهٍ", en: "Expired" }, tone: "neutral" };
    case "suspended":
      return { label: { ar: "موقوف مؤقتاً", en: "Suspended" }, tone: "warning" };
    case "revoked":
      return { label: { ar: "مسحوب", en: "Revoked" }, tone: "danger" };
    default:
      return status ? { label: { ar: status, en: status } } : null;
  }
}
