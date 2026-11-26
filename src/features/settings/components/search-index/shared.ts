import type { IndexRunKind, IndexRunStatus, IndexState } from "@/lib/api";
import type { BadgeDef } from "@/components/ui/kit";

export const STATE_BADGE: Record<IndexState, BadgeDef> = {
  indexed: { label: { ar: "مفهرس", en: "Indexed" }, tone: "success" },
  stale: { label: { ar: "تغيّر بعد الفهرسة", en: "Changed since indexing" }, tone: "warning" },
  deleted: { label: { ar: "محذوف من الفهرس", en: "Removed" }, tone: "neutral" },
  not_indexed: { label: { ar: "غير مفهرس", en: "Not indexed" }, tone: "danger" },
};

export const RUN_STATUS_BADGE: Record<IndexRunStatus, BadgeDef> = {
  running: { label: { ar: "قيد التنفيذ", en: "Running" }, tone: "info" },
  completed: { label: { ar: "اكتمل", en: "Completed" }, tone: "success" },
  failed: { label: { ar: "فشل", en: "Failed" }, tone: "danger" },
  canceled: { label: { ar: "أُلغي", en: "Canceled" }, tone: "neutral" },
  terminated: { label: { ar: "أُوقف", en: "Terminated" }, tone: "danger" },
  continued_as_new: { label: { ar: "استُكمل", en: "Continued" }, tone: "neutral" },
  timed_out: { label: { ar: "انتهت المهلة", en: "Timed out" }, tone: "danger" },
  unknown: { label: { ar: "غير معروف", en: "Unknown" }, tone: "neutral" },
};

export const RUN_KIND_LABEL: Record<IndexRunKind, { ar: string; en: string }> = {
  index: { ar: "فهرسة منتجات", en: "Index products" },
  delete: { ar: "حذف من الفهرس", en: "Remove from index" },
  refresh: { ar: "تحديث الكتالوج كاملاً", en: "Full catalog refresh" },
};

export function duration(started: string | null, closed: string | null): string {
  if (!started) return "—";
  const end = closed ? new Date(closed).getTime() : Date.now();
  const seconds = Math.max(0, Math.round((end - new Date(started).getTime()) / 1000));
  if (!Number.isFinite(seconds)) return "—";
  return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} m ${seconds % 60} s`;
}
