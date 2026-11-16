import type { OrderFollowUpStatus } from "@/lib/api";

export const FOLLOW_UP_STAGES: { value: OrderFollowUpStatus; ar: string; en: string }[] = [
  { value: "new", ar: "جديد", en: "New" },
  { value: "in_progress", ar: "قيد التنفيذ", en: "In progress" },
  { value: "failure", ar: "فشل", en: "Failure" },
  { value: "success", ar: "نجاح", en: "Success" },
  { value: "not_completed", ar: "غير مكتمل", en: "Not completed" },
];

