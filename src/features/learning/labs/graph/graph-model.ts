import type { BadgeDef } from "@/components/ui/kit";

import type { FlowBadge, FlowEdge, FlowNode, FlowText } from "./types";

const KIND_ICON: Record<string, string> = {
  lifecycle: "layers",
  version: "history",
  lab: "book",
  engine: "settings",
  scenario: "file",
  phase: "list",
  stage: "clipboard",
  dialogue_node: "message",
  option: "check",
  field: "edit",
  page: "file",
  block: "grid",
  pathway_node: "link",
  speaker: "users",
  meter: "chart",
  fact: "info",
  document: "file",
  constraint: "shield",
  persona: "user",
  summary: "info",
  truncated: "alert",
};

export function nodeIcon(kind: FlowNode["kind"]): string {
  return KIND_ICON[kind] ?? "file";
}

export function textOf(value: FlowText | null | undefined, t: (ar: string, en?: string) => string): string {
  if (!value) return "";
  return t(value.ar, value.en ?? undefined);
}

export function badgeOf(badge: FlowBadge): BadgeDef {
  return { label: { ar: badge.label.ar, en: badge.label.en ?? badge.label.ar }, tone: badge.tone };
}

export function nodeIsExpandable(node: FlowNode): boolean {
  return Boolean(node.expand_group && (node.count ?? 0) > 0);
}

const EDGE_TONE: Record<string, string> = {
  neutral: "var(--line-strong)",
  info: "var(--purple)",
  success: "var(--green)",
  warning: "var(--yellow)",
  danger: "var(--pink)",
};

export function edgeColor(edge: FlowEdge): string {
  if (edge.kind === "reference") return "var(--line-strong)";
  if (edge.kind === "guard") return "var(--yellow)";
  if (edge.kind === "choice" && edge.tone === "neutral") return "var(--text-muted)";
  return EDGE_TONE[edge.tone] ?? EDGE_TONE.neutral;
}

export function edgeWidth(edge: FlowEdge): number {
  if (edge.kind === "publish" || edge.kind === "pin") return 2;
  return 1.4;
}

export function edgeDash(edge: FlowEdge): string | undefined {
  if (edge.kind === "guard" || edge.kind === "pin") return "5 4";
  if (edge.kind === "reference") return "2 4";
  return undefined;
}

export const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  neutral: { ar: "عادي", en: "Neutral" },
  info: { ar: "معلومة", en: "Info" },
  success: { ar: "سليم", en: "OK" },
  warning: { ar: "تنبيه", en: "Warning" },
  danger: { ar: "خطأ", en: "Error" },
};
