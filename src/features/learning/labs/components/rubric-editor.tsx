import { useId, useState, type ReactNode } from "react";

import { useT } from "@/lib/i18n";
import { Alert, Button, Card, Field } from "@/components/ui/kit";

import { SKILLS, SKILL_LABELS } from "../model";
import { newTerm, normalizeRubric, TERM_KINDS, type Rubric, type RubricDimension, type Term } from "../engine-model";
import { ConditionEditor } from "./condition-editor";

const num = (value: string, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const list = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

function move<T>(items: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (target < 0 || target >= items.length) return items;
  const copy = [...items];
  [copy[index], copy[target]] = [copy[target], copy[index]];
  return copy;
}

function TermEditor({ term, onChange, onRemove, suggestions, depth = 0, readOnly }: {
  term: Term;
  onChange: (next: Term) => void;
  onRemove: () => void;
  suggestions: string[];
  depth?: number;
  readOnly: boolean;
}) {
  const t = useT();
  const kindLabel = TERM_KINDS.find(([kind]) => kind === term.kind)?.[1];
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;
  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-control)", padding: "var(--space-3)", display: "grid", gap: 8 }}>
      <div className="ma-cell-flex" style={{ justifyContent: "space-between", gap: 6 }}>
        <strong>{kindLabel ? t(kindLabel.ar, kindLabel.en) : term.kind}</strong>
        {!readOnly ? <Button sm kind="ghost" icon="trash" label={t("حذف", "Remove")} onClick={onRemove} /> : null}
      </div>
      {term.kind === "const" ? (
        <Field id={id("points")} label={t("النقاط", "Points")} type="number" value={term.points} onChange={(v) => onChange({ ...term, points: num(v) })} />
      ) : null}
      {term.kind === "count" ? (
        <div className="ma-form-grid">
          <Field id={id("source")} label={t("المصدر", "Source path")} dir="ltr" value={term.source} hint="facts · stages.prep.correct · answers.email" onChange={(v) => onChange({ ...term, source: v })} />
          <Field id={id("per")} label={t("نقاط لكل عنصر", "Points per item")} type="number" value={term.per} onChange={(v) => onChange({ ...term, per: num(v) })} />
          <Field id={id("cap")} label={t("حد أقصى للعدد", "Count cap")} type="number" value={term.cap ?? ""} onChange={(v) => onChange({ ...term, cap: v === "" ? null : num(v) })} />
          <Field id={id("among")} label={t("فقط من بين (اختياري)", "Only among (optional)")} dir="ltr" value={(term.among ?? []).join(", ")} onChange={(v) => onChange({ ...term, among: v.trim() ? list(v) : null })} />
        </div>
      ) : null}
      {term.kind === "tags" ? (
        <div className="ma-form-grid">
          <Field id={id("tags")} label={t("الوسوم", "Tags")} dir="ltr" value={term.tags.join(", ")} hint={t("مفصولة بفواصل", "Comma separated")} onChange={(v) => onChange({ ...term, tags: list(v) })} />
          <Field id={id("per")} label={t("نقاط لكل مرة", "Points each")} type="number" value={term.per} onChange={(v) => onChange({ ...term, per: num(v) })} />
          <Field id={id("cap")} label={t("حد أقصى", "Cap")} type="number" value={term.cap ?? ""} onChange={(v) => onChange({ ...term, cap: v === "" ? null : num(v) })} />
          <Field id={id("stage")} label={t("مرحلة محددة (اختياري)", "Only stage (optional)")} dir="ltr" value={term.stage ?? ""} onChange={(v) => onChange({ ...term, stage: v || null })} />
        </div>
      ) : null}
      {term.kind === "value" ? (
        <div className="ma-form-grid">
          <Field id={id("source")} label={t("المصدر", "Source path")} dir="ltr" value={term.source} hint="meters.trust · stages.joint.meters.tension" onChange={(v) => onChange({ ...term, source: v })} />
          <Field id={id("scale")} label={t("المعامل", "Scale")} type="number" value={term.scale} onChange={(v) => onChange({ ...term, scale: num(v, 1) })} />
          <Field id={id("offset")} label={t("الإزاحة", "Offset")} type="number" value={term.offset} onChange={(v) => onChange({ ...term, offset: num(v) })} />
        </div>
      ) : null}
      {term.kind === "range" ? (
        <div className="ma-form-grid">
          <Field id={id("source")} label={t("المصدر", "Source path")} dir="ltr" value={term.source} onChange={(v) => onChange({ ...term, source: v })} />
          <Field id={id("low")} label={t("من", "Low")} type="number" value={term.low} onChange={(v) => onChange({ ...term, low: num(v) })} />
          <Field id={id("high")} label={t("إلى", "High")} type="number" value={term.high} onChange={(v) => onChange({ ...term, high: num(v) })} />
          <Field id={id("inside")} label={t("النقاط داخل النطاق", "Points inside")} type="number" value={term.inside} onChange={(v) => onChange({ ...term, inside: num(v) })} />
          <Field id={id("outside")} label={t("خصم لكل وحدة خارجه", "Minus per unit outside")} type="number" value={term.outside_per} onChange={(v) => onChange({ ...term, outside_per: num(v) })} />
        </div>
      ) : null}
      {term.kind === "if" ? (
        <>
          <div className="ma-form-grid">
            <Field id={id("points")} label={t("النقاط إذا تحقق", "Points when true")} type="number" value={term.points} onChange={(v) => onChange({ ...term, points: num(v) })} />
            <Field id={id("else")} label={t("وإلا", "Otherwise")} type="number" value={term.else_points ?? 0} onChange={(v) => onChange({ ...term, else_points: num(v) })} />
          </div>
          <ConditionEditor label={t("كل هذه الشروط", "All of")} value={term.when} suggestions={suggestions} readOnly={readOnly} onChange={(when) => onChange({ ...term, when })} />
          <ConditionEditor label={t("وواحد على الأقل من (اختياري)", "And at least one of (optional)")} value={term.any ?? []} suggestions={suggestions} readOnly={readOnly} onChange={(any) => onChange({ ...term, any })} />
        </>
      ) : null}
      {term.kind === "group" ? (
        <>
          <div className="ma-form-grid">
            <Field id={id("min")} label={t("الحد الأدنى", "Min")} type="number" value={term.min ?? ""} onChange={(v) => onChange({ ...term, min: v === "" ? null : num(v) })} />
            <Field id={id("max")} label={t("الحد الأعلى", "Max")} type="number" value={term.max ?? ""} onChange={(v) => onChange({ ...term, max: v === "" ? null : num(v) })} />
          </div>
          <TermList terms={term.terms} onChange={(terms) => onChange({ ...term, terms })} suggestions={suggestions} depth={depth + 1} readOnly={readOnly} />
        </>
      ) : null}
    </div>
  );
}

function TermList({ terms, onChange, suggestions, depth = 0, readOnly }: { terms: Term[]; onChange: (next: Term[]) => void; suggestions: string[]; depth?: number; readOnly: boolean }) {
  const t = useT();
  const [kind, setKind] = useState<Term["kind"]>("tags");
  return (
    <div style={{ display: "grid", gap: 8, paddingInlineStart: depth ? 12 : 0 }}>
      {terms.map((term, index) => (
        <TermEditor
          key={index}
          term={term}
          depth={depth}
          suggestions={suggestions}
          readOnly={readOnly}
          onChange={(next) => onChange(terms.map((item, i) => (i === index ? next : item)))}
          onRemove={() => onChange(terms.filter((_, i) => i !== index))}
        />
      ))}
      {!readOnly && depth < 3 ? (
        <div className="ma-cell-flex" style={{ gap: 6 }}>
          <select className="ma-input" style={{ maxWidth: "14rem" }} value={kind} aria-label={t("نوع البند", "Term kind")} onChange={(event) => setKind(event.target.value as Term["kind"])}>
            {TERM_KINDS.filter(([value]) => depth < 2 || value !== "group").map(([value, label]) => (
              <option key={value} value={value}>
                {t(label.ar, label.en)}
              </option>
            ))}
          </select>
          <Button sm kind="soft" icon="plus" label={t("بند", "Term")} onClick={() => onChange([...terms, newTerm(kind)])} />
        </div>
      ) : null}
    </div>
  );
}

function DimensionEditor({ dimension, onChange, onRemove, onMove, suggestions, readOnly }: {
  dimension: RubricDimension;
  onChange: (next: RubricDimension) => void;
  onRemove: () => void;
  onMove: (delta: number) => void;
  suggestions: string[];
  readOnly: boolean;
}) {
  const t = useT();
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;
  return (
    <Card
      title={`${dimension.label.ar || dimension.key} · ${t("الوزن", "weight")} ${dimension.weight}`}
      actions={
        !readOnly ? (
          <span className="ma-cell-flex" style={{ gap: 4 }}>
            <Button sm kind="ghost" icon="up" label={t("أعلى", "Up")} onClick={() => onMove(-1)} />
            <Button sm kind="ghost" icon="down" label={t("أسفل", "Down")} onClick={() => onMove(1)} />
            <Button sm kind="ghost" icon="trash" label={t("حذف", "Remove")} onClick={onRemove} />
          </span>
        ) : null
      }
    >
      <div className="ma-form-grid">
        <Field id={id("key")} label={t("المفتاح", "Key")} dir="ltr" value={dimension.key} onChange={(v) => onChange({ ...dimension, key: v })} />
        <Field id={id("ar")} label={t("الاسم (عربي)", "Label (Arabic)")} value={dimension.label.ar} onChange={(v) => onChange({ ...dimension, label: { ...dimension.label, ar: v } })} />
        <Field id={id("en")} label={t("الاسم (إنجليزي)", "Label (English)")} value={dimension.label.en ?? ""} onChange={(v) => onChange({ ...dimension, label: { ...dimension.label, en: v || null } })} />
        <Field
          id={id("skill")}
          label={t("المهارة", "Skill")}
          value={dimension.skill}
          options={SKILLS.map((skill) => [skill, t(SKILL_LABELS[skill].ar, SKILL_LABELS[skill].en)])}
          onChange={(v) => onChange({ ...dimension, skill: v })}
        />
        <Field id={id("weight")} label={t("الوزن", "Weight")} type="number" value={dimension.weight} onChange={(v) => onChange({ ...dimension, weight: num(v, 1) })} />
        <Field id={id("base")} label={t("نقطة البداية", "Base points")} type="number" value={dimension.base ?? 0} onChange={(v) => onChange({ ...dimension, base: num(v) })} />
      </div>
      <div className="ma-form-grid">
        <Field id={id("praise")} type="textarea" rows={2} label={t("المديح (عند التفوق)", "Praise (when strong)")} value={dimension.praise ?? ""} hint={t("يدعم {{counts.facts}} وأي مسار", "Supports {{counts.facts}} and any path")} onChange={(v) => onChange({ ...dimension, praise: v })} />
        <Field id={id("tip")} type="textarea" rows={2} label={t("النصيحة (عند الضعف)", "Tip (when weak)")} value={dimension.tip ?? ""} onChange={(v) => onChange({ ...dimension, tip: v })} />
      </div>
      <span className="ma-label">{t("بنود الحساب: البداية + مجموع البنود، ثم يُحصر بين 0 و100", "Terms: base + sum of terms, clamped to 0–100")}</span>
      <TermList terms={dimension.terms} onChange={(terms) => onChange({ ...dimension, terms })} suggestions={suggestions} readOnly={readOnly} />
    </Card>
  );
}

function RuleList<R extends { when?: unknown[]; any?: unknown[] }>({ title, help, rules, onChange, render, blank, suggestions, readOnly }: {
  title: string;
  help: string;
  rules: R[];
  onChange: (next: R[]) => void;
  render: (rule: R, set: (patch: Partial<R>) => void, index: number) => ReactNode;
  blank: R;
  suggestions: string[];
  readOnly: boolean;
}) {
  const t = useT();
  return (
    <Card title={title} actions={!readOnly ? <Button sm kind="soft" icon="plus" label={t("إضافة", "Add")} onClick={() => onChange([...rules, blank])} /> : null}>
      <p className="ma-help">{help}</p>
      {rules.map((rule, index) => {
        const set = (patch: Partial<R>) => onChange(rules.map((item, i) => (i === index ? { ...item, ...patch } : item)));
        return (
          <div key={index} style={{ borderBlockStart: index ? "1px solid var(--line)" : undefined, paddingBlock: 8, display: "grid", gap: 8 }}>
            {render(rule, set, index)}
            <ConditionEditor label={t("كل هذه الشروط", "All of")} value={(rule.when ?? []) as never} suggestions={suggestions} readOnly={readOnly} onChange={(when) => set({ when } as Partial<R>)} />
            <ConditionEditor label={t("وواحد على الأقل من (اختياري)", "And at least one of (optional)")} value={(rule.any ?? []) as never} suggestions={suggestions} readOnly={readOnly} onChange={(any) => set({ any } as Partial<R>)} />
            {!readOnly ? (
              <div className="ma-cell-flex" style={{ gap: 4 }}>
                <Button sm kind="ghost" icon="up" label={t("أعلى", "Up")} onClick={() => onChange(move(rules, index, -1))} />
                <Button sm kind="ghost" icon="trash" label={t("حذف", "Remove")} onClick={() => onChange(rules.filter((_, i) => i !== index))} />
              </div>
            ) : null}
          </div>
        );
      })}
    </Card>
  );
}

/**
 * The scoring rubric of an engine (or a scenario override): dimensions built from terms, then
 * verdicts, debrief highlights and badge signals. Mirrors `app/modules/labs/domain/rubric.py`.
 */
export function RubricEditor({ value, onChange, suggestions = [], readOnly = false }: {
  value: unknown;
  onChange: (next: Rubric) => void;
  suggestions?: string[];
  readOnly?: boolean;
}) {
  const t = useT();
  const rubric = normalizeRubric(value);
  const set = (patch: Partial<Rubric>) => onChange({ ...rubric, ...patch });
  const totalWeight = rubric.dimensions.reduce((sum, item) => sum + (item.weight || 0), 0);

  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      <Alert kind="info" title={t("كيف يُحسب التقييم", "How scoring works")}>
        {t(
          "كل بُعد = نقطة البداية + مجموع البنود (عدد الحقائق، الوسوم، المؤشرات، الشروط…)، ثم يُحصر بين 0 و100. النتيجة النهائية متوسط موزون للأبعاد ويُحسب على الخادم.",
          "Each dimension = base + sum of its terms (facts, tags, meters, conditions…), clamped to 0–100. The overall score is the weighted average, computed on the server.",
        )}
        {rubric.dimensions.length ? (
          <div className="ma-help" style={{ marginBlockStart: 6 }}>
            {rubric.dimensions.map((d) => `${d.label.ar || d.key} ${totalWeight ? Math.round(((d.weight || 0) / totalWeight) * 100) : 0}%`).join(" · ")}
          </div>
        ) : null}
      </Alert>

      {rubric.dimensions.map((dimension, index) => (
        <DimensionEditor
          key={index}
          dimension={dimension}
          suggestions={suggestions}
          readOnly={readOnly}
          onChange={(next) => set({ dimensions: rubric.dimensions.map((item, i) => (i === index ? next : item)) })}
          onRemove={() => set({ dimensions: rubric.dimensions.filter((_, i) => i !== index) })}
          onMove={(delta) => set({ dimensions: move(rubric.dimensions, index, delta) })}
        />
      ))}
      {!readOnly ? (
        <div>
          <Button
            kind="soft"
            icon="plus"
            label={t("بُعد تقييم", "Scoring dimension")}
            onClick={() =>
              set({
                dimensions: [
                  ...rubric.dimensions,
                  { key: `dimension_${rubric.dimensions.length + 1}`, label: { ar: "بُعد جديد", en: "New dimension" }, skill: "communication", weight: 1, base: 50, terms: [], praise: "", tip: "" },
                ],
              })
            }
          />
        </div>
      ) : null}

      <RuleList
        title={t("الحكم النهائي", "Verdicts")}
        help={t("أول حكم تتحقق شروطه يظهر أعلى التقييم؛ اترك آخر حكم بلا شروط كافتراضي.", "The first verdict whose conditions hold is shown on top; keep a last one without conditions as the default.")}
        rules={rubric.verdicts}
        blank={{ when: [], text: "" }}
        suggestions={suggestions}
        readOnly={readOnly}
        onChange={(verdicts) => set({ verdicts })}
        render={(rule, patch, index) => (
          <Field id={`verdict-${index}`} label={t("النص", "Text")} value={rule.text} onChange={(text) => patch({ text })} />
        )}
      />
      <RuleList
        title={t("ملاحظات التقييم", "Debrief highlights")}
        help={t("تُضاف بعد ملاحظات الخيارات في الحوار عندما تتحقق شروطها.", "Added after the choice notes from the dialogue when their conditions hold.")}
        rules={rubric.highlights}
        blank={{ when: [], at: "", tone: "bad", text: "" }}
        suggestions={suggestions}
        readOnly={readOnly}
        onChange={(highlights) => set({ highlights })}
        render={(rule, patch, index) => (
          <div className="ma-form-grid">
            <Field id={`hl-at-${index}`} label={t("الموضع", "Where")} value={rule.at ?? ""} onChange={(at) => patch({ at })} />
            <Field id={`hl-tone-${index}`} label={t("النبرة", "Tone")} value={rule.tone ?? "info"} options={[["good", t("جيد", "Good")], ["bad", t("ضعف", "Bad")], ["info", t("معلومة", "Info")]]} onChange={(tone) => patch({ tone: tone as "good" })} />
            <Field id={`hl-text-${index}`} label={t("النص", "Text")} value={rule.text} onChange={(text) => patch({ text })} />
          </div>
        )}
      />
      <RuleList
        title={t("إشارات الشارات", "Badge signals")}
        help={t("إشارة صحيحة تمنح الشارة المرتبطة (مثل dealClosed أو badge:excellence).", "A true signal awards its badge (e.g. dealClosed or badge:excellence).")}
        rules={rubric.signals}
        blank={{ key: "", when: [] }}
        suggestions={suggestions}
        readOnly={readOnly}
        onChange={(signals) => set({ signals })}
        render={(rule, patch, index) => <Field id={`sig-${index}`} label={t("المفتاح", "Key")} dir="ltr" value={rule.key} onChange={(key) => patch({ key })} />}
      />
    </div>
  );
}
