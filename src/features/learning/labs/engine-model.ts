import type { BadgeDef } from "@/components/ui/kit";
import type { EngineDefinitionDoc, EngineDefSummary } from "@/lib/api";

/** Status badges for admin engines. */
export const ENGINE_STATUS: Record<string, BadgeDef> = {
  draft: { label: { ar: "مسودة", en: "Draft" }, tone: "neutral" },
  published: { label: { ar: "منشور", en: "Published" }, tone: "success" },
  archived: { label: { ar: "مؤرشف", en: "Archived" }, tone: "warning" },
};

export const SYSTEM_BADGE: BadgeDef = { label: { ar: "محرّك نظام", en: "System" }, tone: "info" };

export const PERSONA_TONES = ["sky", "coral", "purple", "teal", "yellow", "pink", "green", "blue"] as const;

const TONE_VAR: Record<string, string> = {
  sky: "var(--sky, #8ecae6)",
  coral: "var(--coral, #ff8f70)",
  purple: "var(--purple, #b69cff)",
  teal: "var(--teal, #6fd3c3)",
  yellow: "var(--yellow, #ffd166)",
  pink: "var(--pink, #ff9ec7)",
  green: "var(--green, #8fd694)",
  blue: "var(--sky, #8ecae6)",
};

/** Avatar background for a persona tone. */
export function personaColor(profile: { tone?: string | null } | undefined): string {
  return TONE_VAR[profile?.tone ?? "sky"] ?? TONE_VAR.sky;
}

export const CONSTRAINT_TYPES = [
  ["number", { ar: "رقم", en: "Number" }],
  ["money", { ar: "مبلغ", en: "Money" }],
  ["minutes", { ar: "دقائق", en: "Minutes" }],
  ["percent", { ar: "نسبة", en: "Percent" }],
  ["text", { ar: "نص", en: "Text" }],
  ["bool", { ar: "نعم/لا", en: "Yes/No" }],
] as const;

export const ICONS = ["sparkle", "message", "users", "chart", "shield", "building", "book", "zap", "award", "clipboard"] as const;

export function engineName(engine: Pick<EngineDefSummary, "name" | "key">, ar = true): string {
  const name = engine.name as { ar?: string; en?: string | null } | undefined;
  return (ar ? name?.ar : name?.en || name?.ar) || engine.key;
}

/** A draft with every section present, so editors never deal with `undefined`. */
export function normalizeDefinition(raw: unknown): EngineDefinitionDoc {
  const value = (raw ?? {}) as Partial<EngineDefinitionDoc>;
  return {
    schema_version: 1,
    context: { ...(value.context ?? {}) },
    config: { ...(value.config ?? {}) },
    persona_slots: [...(value.persona_slots ?? [])],
    constraints: [...(value.constraints ?? [])],
    rubric: value.rubric ?? null,
    starter_scenario: value.starter_scenario ?? null,
    notes: value.notes ?? null,
  };
}

/** `"Sales discovery"` → `"sales-discovery"`. */
export function keyify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// ------------------------------------------------------------------ rubric (mirror of domain/rubric.py)

export type Condition = { left: string; op: ConditionOp; right?: unknown } | string;
export type ConditionOp = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "contains" | "exists";

export type Term =
  | { kind: "const"; points: number; label?: string }
  | { kind: "count"; source: string; per: number; among?: string[] | null; cap?: number | null; label?: string }
  | { kind: "tags"; tags: string[]; per: number; stage?: string | null; cap?: number | null; label?: string }
  | { kind: "value"; source: string; scale: number; offset: number; label?: string }
  | { kind: "if"; when: Condition[]; any?: Condition[]; points: number; else_points?: number; label?: string }
  | { kind: "range"; source: string; low: number; high: number; inside: number; outside_per: number; label?: string }
  | { kind: "group"; terms: Term[]; min?: number | null; max?: number | null; label?: string };

export type RubricDimension = {
  key: string;
  label: { ar: string; en?: string | null };
  skill: string;
  weight: number;
  base?: number;
  terms: Term[];
  praise?: string;
  tip?: string;
};

export type Rule = { when?: Condition[]; any?: Condition[] };
export type Rubric = {
  dimensions: RubricDimension[];
  verdicts: (Rule & { text: string })[];
  highlights: (Rule & { at?: string; tone?: "good" | "bad" | "info"; text: string })[];
  signals: (Rule & { key: string })[];
  run_notes_first?: boolean;
};

export function normalizeRubric(raw: unknown): Rubric {
  const value = (raw ?? {}) as Partial<Rubric>;
  return {
    dimensions: [...(value.dimensions ?? [])],
    verdicts: [...(value.verdicts ?? [])],
    highlights: [...(value.highlights ?? [])],
    signals: [...(value.signals ?? [])],
    run_notes_first: value.run_notes_first ?? true,
  };
}

export const TERM_KINDS: [Term["kind"], { ar: string; en: string }][] = [
  ["const", { ar: "نقاط ثابتة", en: "Fixed points" }],
  ["count", { ar: "عدد عناصر", en: "Count items" }],
  ["tags", { ar: "عدد الوسوم", en: "Count tags" }],
  ["value", { ar: "قيمة رقمية", en: "Numeric value" }],
  ["if", { ar: "شرط", en: "Condition" }],
  ["range", { ar: "نطاق مثالي", en: "Ideal range" }],
  ["group", { ar: "مجموعة بسقف", en: "Capped group" }],
];

export function newTerm(kind: Term["kind"]): Term {
  switch (kind) {
    case "const":
      return { kind, points: 10 };
    case "count":
      return { kind, source: "facts", per: 10 };
    case "tags":
      return { kind, tags: ["empathy"], per: 10 };
    case "value":
      return { kind, source: "meters.trust", scale: 1, offset: 0 };
    case "if":
      return { kind, when: [{ left: "outcome", op: "eq", right: "success" }], points: 20 };
    case "range":
      return { kind, source: "talk_share", low: 35, high: 55, inside: 100, outside_per: 3 };
    case "group":
      return { kind, terms: [], min: 0, max: 30 };
  }
}

/** Context paths every dialogue run offers (shown as suggestions in the condition builder). */
export const CONTEXT_PATHS = [
  "outcome",
  "facts",
  "fact.<id>",
  "tags.<tag>",
  "meters.<meter>",
  "turns",
  "talk_share",
  "listen_share",
  "visited",
  "counts.facts",
  "answers.<stage>",
  "answers.<form>.<field>",
  "stages.<stage>.outcome",
  "stages.<stage>.meters.<meter>",
  "stages.<stage>.correct",
  "constraints.<key>",
] as const;
