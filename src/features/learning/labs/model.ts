import type { BadgeDef } from "@/components/ui/kit";
import type { LabAttempt, LabListItem, LabScenario, LabStatus } from "@/lib/api";

/** Labels and small helpers shared by the labs pages. */

export const LAB_STATUSES: LabStatus[] = ["draft", "in_review", "scheduled", "published", "paused", "archived"];

export const LAB_STATUS: Record<LabStatus, BadgeDef> = {
  draft: { label: { ar: "مسودة", en: "Draft" }, tone: "neutral" },
  in_review: { label: { ar: "قيد المراجعة", en: "In review" }, tone: "info" },
  scheduled: { label: { ar: "مجدول", en: "Scheduled" }, tone: "info" },
  published: { label: { ar: "منشور", en: "Published" }, tone: "success" },
  paused: { label: { ar: "موقوف", en: "Paused" }, tone: "warning" },
  archived: { label: { ar: "مؤرشف", en: "Archived" }, tone: "neutral" },
};

export const ATTEMPT_STATUS: Record<LabAttempt["status"], BadgeDef> = {
  scored: { label: { ar: "مُقيَّم", en: "Scored" }, tone: "success" },
  flagged: { label: { ar: "موسوم", en: "Flagged" }, tone: "warning" },
  overridden: { label: { ar: "معدَّل يدويًا", en: "Overridden" }, tone: "info" },
  voided: { label: { ar: "ملغى", en: "Voided" }, tone: "danger" },
};

export const READINESS: Record<string, BadgeDef> = {
  ready: { label: { ar: "جاهز", en: "Ready" }, tone: "success" },
  excellent: { label: { ar: "متميّز", en: "Excellent" }, tone: "success" },
  developing: { label: { ar: "قيد التطوّر", en: "Developing" }, tone: "warning" },
  "not-ready": { label: { ar: "غير جاهز", en: "Not ready" }, tone: "danger" },
};

export const DIFFICULTIES = ["مبتدئ", "متوسط", "متقدّم"] as const;

export const SKILLS = [
  "communication",
  "analysis",
  "persuasion",
  "empathy",
  "decision",
  "execution",
  "strategy",
] as const;

export const SKILL_LABELS: Record<string, { ar: string; en: string }> = {
  communication: { ar: "التواصل", en: "Communication" },
  analysis: { ar: "التحليل", en: "Analysis" },
  persuasion: { ar: "الإقناع", en: "Persuasion" },
  empathy: { ar: "التعاطف", en: "Empathy" },
  decision: { ar: "اتخاذ القرار", en: "Decision" },
  execution: { ar: "التنفيذ", en: "Execution" },
  strategy: { ar: "الاستراتيجية", en: "Strategy" },
};

export const COLORS = ["blue", "teal", "purple", "coral", "amber", "green", "slate"] as const;

/** Scenario status → badge (active/disabled). */
export const SCENARIO_STATUS: Record<LabScenario["status"], BadgeDef> = {
  active: { label: { ar: "نشط", en: "Active" }, tone: "success" },
  disabled: { label: { ar: "معطّل", en: "Disabled" }, tone: "neutral" },
};

export function labStatusBadge(status: string): BadgeDef | null {
  return LAB_STATUS[status as LabStatus] ?? null;
}

export function labTitle(lab: Pick<LabListItem, "title" | "slug">): string {
  return lab.title || lab.slug;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

/** `GET /labs/{slug}` path for an admin preview token, opened on the storefront origin. */
export function storefrontUrl(path: string): string {
  const origin = (import.meta.env.VITE_STOREFRONT_ORIGIN as string | undefined) ?? "http://localhost:3000";
  return `${origin.replace(/\/$/, "")}${path}`;
}

export function percent(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${Math.round(value * 10) / 10}%`;
}

export function engineLabel(engine: { key: string; label: string } | undefined): string {
  return engine?.label ?? engine?.key ?? "—";
}

/** Group lab issues by top-level definition section so each Studio tab shows its own. */
export function issuesBySection<T extends { path: string }>(issues: T[], section: string): T[] {
  return issues.filter((issue) => issue.path === section || issue.path.startsWith(`${section}/`));
}
