import { useEffect, useId, useMemo, useState } from "react";

import type { LabPersona } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Alert, Badge, Button, Card, Field } from "@/components/ui/kit";

import type { Condition } from "../engine-model";
import { ConditionEditor } from "./condition-editor";
import { RubricEditor } from "./rubric-editor";

// ------------------------------------------------------------------ document types (mirror of the backend)

type Localized = { ar: string; en?: string | null };
type Speaker = { slot?: string | null; persona?: string | null; name?: string | null; role?: string | null; initials?: string | null; tone?: string | null };
type Meter = { key: string; label: Localized; initial: number; visible?: boolean; min?: number; max?: number };
type Fact = { id: string; label: string };
type Guard = { when?: Condition[]; any?: Condition[]; to: string };
type Choice = {
  id: string;
  label: string;
  tags?: string[];
  effects?: Record<string, number>;
  reveals?: string[];
  requires?: string[];
  next: string;
  note?: { tone: "good" | "bad" | "info"; text: string } | null;
  seconds?: number | null;
};
type DNode = {
  id: string;
  speaker: string;
  line: string;
  reveals?: string[];
  effects?: Record<string, number>;
  choices?: Choice[];
  next?: string | null;
  redirect?: Guard[];
  end?: "success" | "neutral" | "fail" | null;
};
type BriefStage = { id: string; type: "brief"; title: string; body?: string; documents?: { title: string; body: string }[] };
type SelectStage = {
  id: string;
  type: "select";
  title: string;
  prompt?: string;
  multiple?: boolean;
  min_select?: number;
  max_select?: number | null;
  options: { id: string; label: string; detail?: string | null; tags?: string[]; correct?: boolean | null }[];
};
type FormField = { id: string; label: string; kind?: "text" | "textarea" | "number" | "select" | "multiselect"; options?: { id: string; label: string }[]; unit?: string | null; required?: boolean };
type FormStage = { id: string; type: "form"; title: string; prompt?: string; fields: FormField[] };
type DialogueStage = {
  id: string;
  type: "dialogue";
  title: string;
  note_prefix?: string | null;
  start: string;
  nodes: Record<string, DNode>;
  initial?: Record<string, number>;
  visible_meters?: string[] | null;
  turn_cost?: Record<string, number>;
  breakpoints?: Guard[];
};
type Stage = BriefStage | SelectStage | FormStage | DialogueStage;
export type DialogueDoc = {
  intro?: string | null;
  speakers: Record<string, Speaker>;
  meters?: Meter[];
  facts?: Fact[];
  stages: Stage[];
  constraints?: Record<string, unknown>;
  rubric?: Record<string, unknown> | null;
  notes?: string | null;
  engine?: unknown;
};

const list = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
const num = (value: string) => (value.trim() === "" ? undefined : Number(value));

function uniqueId(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let index = 2;
  while (used.has(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}

function move<T>(items: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (target < 0 || target >= items.length) return items;
  const copy = [...items];
  [copy[index], copy[target]] = [copy[target], copy[index]];
  return copy;
}

function normalize(raw: unknown): DialogueDoc {
  const value = (raw ?? {}) as Partial<DialogueDoc>;
  return { ...value, speakers: value.speakers ?? {}, stages: value.stages ?? [] } as DialogueDoc;
}

// ------------------------------------------------------------------ graph checks (mirror of the runtime validator)

function edges(stage: DialogueStage, node: DNode): string[] {
  return [
    ...(node.choices ?? []).map((choice) => choice.next),
    ...(node.redirect ?? []).map((rule) => rule.to),
    ...(node.next ? [node.next] : []),
    ...(node.choices?.length ? (stage.breakpoints ?? []).map((rule) => rule.to) : []),
  ];
}

function graphIssues(stage: DialogueStage, speakers: string[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const add = (id: string, text: string) => (out[id] ??= []).push(text);
  if (!stage.nodes[stage.start]) add("_stage", `start "${stage.start}" missing`);
  for (const [id, node] of Object.entries(stage.nodes)) {
    if (!speakers.includes(node.speaker)) add(id, `speaker "${node.speaker}" unknown`);
    if (!node.end && !node.choices?.length && !node.next && !node.redirect?.length) add(id, "dead end");
    for (const to of edges(stage, node)) if (!stage.nodes[to]) add(id, `→ "${to}" missing`);
  }
  const seen = new Set<string>();
  const visit = (id: string) => {
    if (seen.has(id) || !stage.nodes[id]) return;
    seen.add(id);
    for (const to of edges(stage, stage.nodes[id])) visit(to);
  };
  visit(stage.start);
  for (const id of Object.keys(stage.nodes)) if (!seen.has(id)) add(id, "unreachable");
  if (!Object.values(stage.nodes).some((node) => node.end)) add("_stage", "no ending node");
  return out;
}

// ------------------------------------------------------------------ small editors

function NumberMap({ label, meters, value, onChange, readOnly }: { label: string; meters: string[]; value: Record<string, number> | undefined; onChange: (next: Record<string, number>) => void; readOnly: boolean }) {
  const uid = useId();
  const current = value ?? {};
  return (
    <div className="ma-field">
      <span className="ma-label">{label}</span>
      <div className="ma-cell-flex" style={{ gap: 8, flexWrap: "wrap" }}>
        {meters.map((meter) => (
          <label key={meter} className="ma-cell-flex" style={{ gap: 4 }} htmlFor={`${uid}-${meter}`}>
            <bdi className="ma-help">{meter}</bdi>
            <input
              id={`${uid}-${meter}`}
              className="ma-input"
              type="number"
              dir="ltr"
              style={{ width: "5.5rem" }}
              disabled={readOnly}
              value={current[meter] ?? ""}
              onChange={(event) => {
                const next = { ...current };
                const parsed = num(event.target.value);
                if (parsed === undefined || Number.isNaN(parsed)) delete next[meter];
                else next[meter] = parsed;
                onChange(next);
              }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function NodeSelect({ id, label, nodes, value, onChange, allowEmpty = false, readOnly }: { id: string; label: string; nodes: string[]; value: string | null | undefined; onChange: (next: string | null) => void; allowEmpty?: boolean; readOnly: boolean }) {
  return (
    <div className="ma-field">
      <label className="ma-label" htmlFor={id}>
        {label}
      </label>
      <select id={id} className="ma-input" dir="ltr" value={value ?? ""} disabled={readOnly} onChange={(event) => onChange(event.target.value || null)}>
        {allowEmpty ? <option value="">—</option> : null}
        {value && !nodes.includes(value) ? <option value={value}>{value} (missing)</option> : null}
        {nodes.map((node) => (
          <option key={node} value={node}>
            {node}
          </option>
        ))}
      </select>
    </div>
  );
}

function GuardList({ title, help, guards, nodes, onChange, suggestions, readOnly }: { title: string; help: string; guards: Guard[]; nodes: string[]; onChange: (next: Guard[]) => void; suggestions: string[]; readOnly: boolean }) {
  const t = useT();
  const uid = useId();
  return (
    <div className="ma-field" style={{ border: "1px dashed var(--line)", borderRadius: "var(--radius-control)", padding: "var(--space-3)" }}>
      <span className="ma-label">{title}</span>
      <span className="ma-help">{help}</span>
      {guards.map((guard, index) => (
        <div key={index} style={{ display: "grid", gap: 6, paddingBlock: 6, borderBlockStart: index ? "1px solid var(--line)" : undefined }}>
          <ConditionEditor value={guard.when ?? []} suggestions={suggestions} readOnly={readOnly} onChange={(when) => onChange(guards.map((g, i) => (i === index ? { ...g, when } : g)))} />
          <div className="ma-cell-flex" style={{ gap: 6, alignItems: "end" }}>
            <NodeSelect id={`${uid}-${index}`} label={t("انتقل إلى", "Jump to")} nodes={nodes} value={guard.to} readOnly={readOnly} onChange={(to) => onChange(guards.map((g, i) => (i === index ? { ...g, to: to ?? "" } : g)))} />
            {!readOnly ? <Button sm kind="ghost" icon="trash" label={t("حذف", "Remove")} onClick={() => onChange(guards.filter((_, i) => i !== index))} /> : null}
          </div>
        </div>
      ))}
      {!readOnly ? (
        <div>
          <Button sm kind="soft" icon="plus" label={t("قاعدة", "Rule")} onClick={() => onChange([...guards, { when: [{ left: "meters.patience", op: "lte", right: 0 }], to: nodes[0] ?? "" }])} />
        </div>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------ dialogue stage

function ChoiceEditor({ choice, nodes, meters, facts, onChange, onRemove, onMove, readOnly }: {
  choice: Choice;
  nodes: string[];
  meters: string[];
  facts: string[];
  onChange: (next: Choice) => void;
  onRemove: () => void;
  onMove: (delta: number) => void;
  readOnly: boolean;
}) {
  const t = useT();
  const uid = useId();
  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-control)", padding: "var(--space-3)", display: "grid", gap: 8 }}>
      <Field id={`${uid}-label`} type="textarea" rows={2} label={t("رد المتعلم", "Learner reply")} value={choice.label} onChange={(label) => onChange({ ...choice, label })} />
      <div className="ma-form-grid">
        <Field id={`${uid}-id`} label={t("المعرّف", "Id")} dir="ltr" value={choice.id} onChange={(id) => onChange({ ...choice, id })} />
        <NodeSelect id={`${uid}-next`} label={t("الرد التالي", "Next node")} nodes={nodes} value={choice.next} readOnly={readOnly} onChange={(next) => onChange({ ...choice, next: next ?? "" })} />
        <Field id={`${uid}-tags`} label={t("الوسوم (للتقييم)", "Tags (for scoring)")} dir="ltr" value={(choice.tags ?? []).join(", ")} hint="empathy, open-question" onChange={(v) => onChange({ ...choice, tags: list(v) })} />
        <Field id={`${uid}-reveals`} label={t("يكشف حقائق", "Reveals facts")} dir="ltr" value={(choice.reveals ?? []).join(", ")} hint={facts.join(", ")} onChange={(v) => onChange({ ...choice, reveals: list(v) })} />
        <Field id={`${uid}-requires`} label={t("يظهر فقط بعد اكتشاف", "Only after discovering")} dir="ltr" value={(choice.requires ?? []).join(", ")} onChange={(v) => onChange({ ...choice, requires: list(v) })} />
        <Field id={`${uid}-seconds`} label={t("مدة الحديث (ث)", "Talk time (s)")} type="number" value={choice.seconds ?? ""} hint={t("فارغ = تقدير من طول النص", "Empty = estimated from length")} onChange={(v) => onChange({ ...choice, seconds: num(v) ?? null })} />
      </div>
      <NumberMap label={t("أثر على المؤشرات", "Meter effects")} meters={meters} value={choice.effects} readOnly={readOnly} onChange={(effects) => onChange({ ...choice, effects })} />
      <div className="ma-form-grid">
        <Field
          id={`${uid}-note-tone`}
          label={t("ملاحظة المراقب", "Observer note")}
          value={choice.note?.tone ?? "none"}
          options={[["none", t("بلا ملاحظة", "No note")], ["good", t("جيد", "Good")], ["bad", t("ضعف", "Bad")], ["info", t("معلومة", "Info")]]}
          onChange={(tone) => onChange({ ...choice, note: tone !== "none" ? { tone: tone as "good", text: choice.note?.text ?? "" } : null })}
        />
        {choice.note ? <Field id={`${uid}-note`} label={t("نص الملاحظة", "Note text")} value={choice.note.text} onChange={(text) => onChange({ ...choice, note: { ...choice.note!, text } })} /> : null}
      </div>
      {!readOnly ? (
        <div className="ma-cell-flex" style={{ gap: 4 }}>
          <Button sm kind="ghost" icon="up" label={t("أعلى", "Up")} onClick={() => onMove(-1)} />
          <Button sm kind="ghost" icon="down" label={t("أسفل", "Down")} onClick={() => onMove(1)} />
          <Button sm kind="ghost" icon="trash" label={t("حذف الرد", "Remove reply")} onClick={onRemove} />
        </div>
      ) : null}
    </div>
  );
}

function DialogueStageEditor({ stage, onChange, speakers, meters, facts, suggestions, readOnly, focusNode, focusToken }: {
  stage: DialogueStage;
  onChange: (next: DialogueStage) => void;
  speakers: string[];
  meters: string[];
  facts: string[];
  suggestions: string[];
  readOnly: boolean;
  focusNode?: string | null;
  focusToken?: number;
}) {
  const t = useT();
  const uid = useId();
  const nodeIds = Object.keys(stage.nodes);
  const [selected, setSelected] = useState<string>(stage.start in stage.nodes ? stage.start : nodeIds[0] ?? "");
  const issues = useMemo(() => graphIssues(stage, speakers), [stage, speakers]);
  const node = stage.nodes[selected];

  useEffect(() => {
    if (!focusToken || !focusNode) return;
    if (stage.nodes[focusNode]) setSelected(focusNode);
  }, [focusNode, focusToken, stage.nodes]);

  const setNode = (next: DNode) => {
    const nodes = { ...stage.nodes };
    if (next.id !== selected) {
      // Rename: move the key and repoint every reference.
      delete nodes[selected];
      const repoint = (to: string) => (to === selected ? next.id : to);
      for (const [key, item] of Object.entries(nodes)) {
        nodes[key] = {
          ...item,
          next: item.next ? repoint(item.next) : item.next,
          choices: item.choices?.map((choice) => ({ ...choice, next: repoint(choice.next) })),
          redirect: item.redirect?.map((rule) => ({ ...rule, to: repoint(rule.to) })),
        };
      }
      nodes[next.id] = { ...next, next: next.next ? repoint(next.next) : next.next };
      onChange({
        ...stage,
        nodes,
        start: repoint(stage.start),
        breakpoints: stage.breakpoints?.map((rule) => ({ ...rule, to: repoint(rule.to) })),
      });
      setSelected(next.id);
      return;
    }
    nodes[selected] = next;
    onChange({ ...stage, nodes });
  };

  const addNode = () => {
    const id = uniqueId("node", nodeIds);
    const nodes = { ...stage.nodes, [id]: { id, speaker: speakers[0] ?? "", line: "", choices: [] } as DNode };
    onChange({ ...stage, nodes, start: stage.start || id });
    setSelected(id);
  };

  const removeNode = () => {
    if (!node) return;
    const nodes = { ...stage.nodes };
    delete nodes[selected];
    onChange({ ...stage, nodes });
    setSelected(Object.keys(nodes)[0] ?? "");
  };

  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      <div className="ma-form-grid">
        <Field id={`${uid}-title`} label={t("عنوان المرحلة", "Stage title")} value={stage.title} onChange={(title) => onChange({ ...stage, title })} />
        <Field id={`${uid}-prefix`} label={t("بادئة الملاحظات", "Note prefix")} value={stage.note_prefix ?? ""} hint={t("مثال: «خالد» ← «خالد · 01:20»", "e.g. «Khaled» → «Khaled · 01:20»")} onChange={(v) => onChange({ ...stage, note_prefix: v || null })} />
        <NodeSelect id={`${uid}-start`} label={t("عقدة البداية", "Start node")} nodes={nodeIds} value={stage.start} readOnly={readOnly} onChange={(start) => onChange({ ...stage, start: start ?? "" })} />
        <Field id={`${uid}-visible`} label={t("المؤشرات الظاهرة", "Visible meters")} dir="ltr" value={(stage.visible_meters ?? []).join(", ")} hint={t("فارغ = حسب المحرّك", "Empty = engine default")} onChange={(v) => onChange({ ...stage, visible_meters: v.trim() ? list(v) : null })} />
      </div>
      <NumberMap label={t("قيم المؤشرات عند البداية", "Meter values at start")} meters={meters} value={stage.initial} readOnly={readOnly} onChange={(initial) => onChange({ ...stage, initial })} />
      <NumberMap label={t("كلفة كل رد (ضغط الوقت)", "Cost of every reply (time pressure)")} meters={meters} value={stage.turn_cost} readOnly={readOnly} onChange={(turn_cost) => onChange({ ...stage, turn_cost })} />
      <GuardList
        title={t("نقاط القطع", "Breakpoints")}
        help={t("تُفحص بعد كل رد؛ أول قاعدة تتحقق تنقل الحوار (مثل: الصبر ≤ 0 ← إنهاء المكالمة).", "Checked after every reply; the first matching rule jumps (e.g. patience ≤ 0 → hang up).")}
        guards={stage.breakpoints ?? []}
        nodes={nodeIds}
        suggestions={suggestions}
        readOnly={readOnly}
        onChange={(breakpoints) => onChange({ ...stage, breakpoints })}
      />
      {issues._stage ? (
        <Alert kind="danger" title={t("مشكلات المرحلة", "Stage problems")}>
          {issues._stage.join(" · ")}
        </Alert>
      ) : null}

      <div className="ma-cols ma-cols--side-main">
        <Card title={t(`العُقد (${nodeIds.length})`, `Nodes (${nodeIds.length})`)} actions={!readOnly ? <Button sm kind="soft" icon="plus" label={t("عقدة", "Node")} onClick={() => addNode()} /> : null}>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 4, maxHeight: "60vh", overflowY: "auto" }}>
            {nodeIds.map((id) => {
              const item = stage.nodes[id];
              const problems = issues[id];
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => setSelected(id)}
                    aria-current={id === selected ? "true" : undefined}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      textAlign: "start",
                      font: "inherit",
                      cursor: "pointer",
                      padding: "6px 8px",
                      borderRadius: "var(--radius-control)",
                      border: `1px solid ${id === selected ? "var(--accent)" : problems ? "var(--danger)" : "var(--line)"}`,
                      background: id === selected ? "var(--surface-alt, transparent)" : "transparent",
                      color: "inherit",
                    }}
                  >
                    <span className="ma-cell-flex" style={{ gap: 6, justifyContent: "space-between" }}>
                      <bdi style={{ fontWeight: 600 }}>{id}</bdi>
                      <span className="ma-cell-flex" style={{ gap: 4 }}>
                        {id === stage.start ? <Badge def={{ label: { ar: "بداية", en: "start" }, tone: "info" }} /> : null}
                        {item.end ? <Badge def={{ label: { ar: item.end, en: item.end }, tone: item.end === "success" ? "success" : item.end === "fail" ? "danger" : "warning" }} /> : null}
                      </span>
                    </span>
                    <span className="ma-help" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.speaker}: {item.line || "…"}
                    </span>
                    {problems ? <span style={{ color: "var(--danger)", fontSize: 12 }}>{problems.join(" · ")}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>

        {node ? (
          <Card
            title={t(`العقدة: ${node.id}`, `Node: ${node.id}`)}
            actions={!readOnly ? <Button sm kind="ghost" icon="trash" label={t("حذف العقدة", "Delete node")} onClick={removeNode} /> : null}
          >
            <div className="ma-form-grid">
              <Field id={`${uid}-node-id`} label={t("المعرّف", "Id")} dir="ltr" value={node.id} hint={t("إعادة التسمية تحدّث كل الروابط", "Renaming updates every link")} onChange={(id) => id && !stage.nodes[id] && setNode({ ...node, id })} />
              <Field id={`${uid}-speaker`} label={t("المتحدث", "Speaker")} value={node.speaker} options={speakers.map((id) => [id, id])} onChange={(speaker) => setNode({ ...node, speaker })} />
              <Field
                id={`${uid}-end`}
                label={t("نهاية الحوار", "Ends the dialogue")}
                value={node.end ?? "none"}
                options={[["none", t("لا", "No")], ["success", t("نجاح", "Success")], ["neutral", t("محايد", "Neutral")], ["fail", t("فشل", "Fail")]]}
                onChange={(end) => setNode({ ...node, end: (end === "none" ? null : end) as DNode["end"] })}
              />
              <NodeSelect id={`${uid}-node-next`} label={t("يتابع إلى (بلا ردود)", "Continues to (no replies)")} nodes={nodeIds.filter((id) => id !== node.id)} value={node.next} allowEmpty readOnly={readOnly} onChange={(next) => setNode({ ...node, next })} />
            </div>
            <Field id={`${uid}-line`} type="textarea" rows={3} label={t("ما يقوله المتحدث", "What the speaker says")} value={node.line} onChange={(line) => setNode({ ...node, line })} />
            <div className="ma-form-grid">
              <Field id={`${uid}-node-reveals`} label={t("يكشف حقائق", "Reveals facts")} dir="ltr" value={(node.reveals ?? []).join(", ")} hint={facts.join(", ")} onChange={(v) => setNode({ ...node, reveals: list(v) })} />
            </div>
            <NumberMap label={t("أثر على المؤشرات عند الوصول", "Meter effects on arrival")} meters={meters} value={node.effects} readOnly={readOnly} onChange={(effects) => setNode({ ...node, effects })} />
            <GuardList
              title={t("تحويل عند الدخول", "Redirect on entry")}
              help={t("قبل عرض العقدة: أول قاعدة تتحقق تحوّل إلى عقدة أخرى (مثل: أقل من 3 أسئلة مفتوحة ← رد عام).", "Before showing the node, the first matching rule redirects (e.g. fewer than 3 open questions → generic reply).")}
              guards={node.redirect ?? []}
              nodes={nodeIds.filter((id) => id !== node.id)}
              suggestions={suggestions}
              readOnly={readOnly}
              onChange={(redirect) => setNode({ ...node, redirect })}
            />
            {!node.end ? (
              <div className="ma-field">
                <span className="ma-label">{t(`ردود المتعلم (${node.choices?.length ?? 0})`, `Learner replies (${node.choices?.length ?? 0})`)}</span>
                <div style={{ display: "grid", gap: 8 }}>
                  {(node.choices ?? []).map((choice, index) => (
                    <ChoiceEditor
                      key={index}
                      choice={choice}
                      nodes={nodeIds}
                      meters={meters}
                      facts={facts}
                      readOnly={readOnly}
                      onChange={(next) => setNode({ ...node, choices: (node.choices ?? []).map((item, i) => (i === index ? next : item)) })}
                      onRemove={() => setNode({ ...node, choices: (node.choices ?? []).filter((_, i) => i !== index) })}
                      onMove={(delta) => setNode({ ...node, choices: move(node.choices ?? [], index, delta) })}
                    />
                  ))}
                </div>
                {!readOnly ? (
                  <div className="ma-cell-flex" style={{ gap: 6 }}>
                    <Button
                      sm
                      kind="soft"
                      icon="plus"
                      label={t("رد", "Reply")}
                      onClick={() =>
                        setNode({
                          ...node,
                          choices: [...(node.choices ?? []), { id: uniqueId("c", (node.choices ?? []).map((c) => c.id)), label: "", next: nodeIds.find((id) => id !== node.id) ?? node.id }],
                        })
                      }
                    />
                    <Button
                      sm
                      kind="ghost"
                      label={t("رد + عقدة جديدة", "Reply + new node")}
                      onClick={() => {
                        const id = uniqueId("node", nodeIds);
                        const choice: Choice = { id: uniqueId("c", (node.choices ?? []).map((c) => c.id)), label: "", next: id };
                        onChange({
                          ...stage,
                          nodes: {
                            ...stage.nodes,
                            [node.id]: { ...node, choices: [...(node.choices ?? []), choice] },
                            [id]: { id, speaker: node.speaker, line: "", choices: [] },
                          },
                        });
                      }}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
          </Card>
        ) : (
          <Card>
            <p className="ma-help">{t("أضف عقدة لبدء الحوار.", "Add a node to start the dialogue.")}</p>
          </Card>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ other stages

function SelectStageEditor({ stage, onChange, readOnly }: { stage: SelectStage; onChange: (next: SelectStage) => void; readOnly: boolean }) {
  const t = useT();
  const uid = useId();
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div className="ma-form-grid">
        <Field id={`${uid}-title`} label={t("العنوان", "Title")} value={stage.title} onChange={(title) => onChange({ ...stage, title })} />
        <Field id={`${uid}-prompt`} label={t("التعليمات", "Prompt")} value={stage.prompt ?? ""} onChange={(prompt) => onChange({ ...stage, prompt })} />
        <Field id={`${uid}-multiple`} label={t("نوع الاختيار", "Selection")} value={stage.multiple === false ? "one" : "many"} options={[["many", t("متعدد", "Multiple")], ["one", t("واحد", "Single")]]} onChange={(v) => onChange({ ...stage, multiple: v !== "one" })} />
        <Field id={`${uid}-min`} label={t("الحد الأدنى", "Min")} type="number" value={stage.min_select ?? 0} onChange={(v) => onChange({ ...stage, min_select: num(v) ?? 0 })} />
        <Field id={`${uid}-max`} label={t("الحد الأعلى", "Max")} type="number" value={stage.max_select ?? ""} onChange={(v) => onChange({ ...stage, max_select: num(v) ?? null })} />
      </div>
      {stage.options.map((option, index) => {
        const set = (patch: Partial<SelectStage["options"][number]>) => onChange({ ...stage, options: stage.options.map((o, i) => (i === index ? { ...o, ...patch } : o)) });
        return (
          <div key={index} className="ma-form-grid" style={{ borderBlockStart: "1px solid var(--line)", paddingBlockStart: 8 }}>
            <Field id={`${uid}-o${index}-id`} label={t("المعرّف", "Id")} dir="ltr" value={option.id} onChange={(id) => set({ id })} />
            <Field id={`${uid}-o${index}-label`} label={t("النص", "Label")} value={option.label} onChange={(label) => set({ label })} />
            <Field id={`${uid}-o${index}-tags`} label={t("الوسوم", "Tags")} dir="ltr" value={(option.tags ?? []).join(", ")} onChange={(v) => set({ tags: list(v) })} />
            <Field
              id={`${uid}-o${index}-correct`}
              label={t("مفتاح الإجابة (مخفي)", "Answer key (hidden)")}
              value={option.correct === true ? "yes" : option.correct === false ? "no" : "none"}
              options={[["none", "—"], ["yes", t("صحيح", "Correct")], ["no", t("خطأ", "Wrong")]]}
              onChange={(v) => set({ correct: v === "yes" ? true : v === "no" ? false : null })}
            />
            {!readOnly ? <Button sm kind="ghost" icon="trash" label={t("حذف", "Remove")} onClick={() => onChange({ ...stage, options: stage.options.filter((_, i) => i !== index) })} /> : null}
          </div>
        );
      })}
      {!readOnly ? (
        <div>
          <Button sm kind="soft" icon="plus" label={t("خيار", "Option")} onClick={() => onChange({ ...stage, options: [...stage.options, { id: uniqueId("o", stage.options.map((o) => o.id)), label: "" }] })} />
        </div>
      ) : null}
    </div>
  );
}

function FormStageEditor({ stage, onChange, readOnly }: { stage: FormStage; onChange: (next: FormStage) => void; readOnly: boolean }) {
  const t = useT();
  const uid = useId();
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div className="ma-form-grid">
        <Field id={`${uid}-title`} label={t("العنوان", "Title")} value={stage.title} onChange={(title) => onChange({ ...stage, title })} />
        <Field id={`${uid}-prompt`} label={t("التعليمات", "Prompt")} value={stage.prompt ?? ""} onChange={(prompt) => onChange({ ...stage, prompt })} />
      </div>
      {stage.fields.map((field, index) => {
        const set = (patch: Partial<FormField>) => onChange({ ...stage, fields: stage.fields.map((f, i) => (i === index ? { ...f, ...patch } : f)) });
        return (
          <div key={index} className="ma-form-grid" style={{ borderBlockStart: "1px solid var(--line)", paddingBlockStart: 8 }}>
            <Field id={`${uid}-f${index}-id`} label={t("المعرّف", "Id")} dir="ltr" value={field.id} onChange={(id) => set({ id })} />
            <Field id={`${uid}-f${index}-label`} label={t("التسمية", "Label")} value={field.label} onChange={(label) => set({ label })} />
            <Field
              id={`${uid}-f${index}-kind`}
              label={t("النوع", "Kind")}
              value={field.kind ?? "text"}
              options={[["text", t("نص", "Text")], ["textarea", t("نص طويل", "Long text")], ["number", t("رقم", "Number")], ["select", t("اختيار", "Select")], ["multiselect", t("اختيار متعدد", "Multi-select")]]}
              onChange={(kind) => set({ kind: kind as FormField["kind"] })}
            />
            <Field id={`${uid}-f${index}-unit`} label={t("الوحدة", "Unit")} value={field.unit ?? ""} onChange={(unit) => set({ unit: unit || null })} />
            {field.kind === "select" || field.kind === "multiselect" ? (
              <Field
                id={`${uid}-f${index}-options`}
                type="textarea"
                rows={3}
                label={t("الخيارات (معرّف=نص لكل سطر)", "Options (id=label per line)")}
                value={(field.options ?? []).map((o) => `${o.id}=${o.label}`).join("\n")}
                onChange={(v) =>
                  set({
                    options: v
                      .split("\n")
                      .map((line) => line.split("="))
                      .filter(([id]) => id?.trim())
                      .map(([id, ...label]) => ({ id: id.trim(), label: label.join("=").trim() || id.trim() })),
                  })
                }
              />
            ) : null}
            {!readOnly ? <Button sm kind="ghost" icon="trash" label={t("حذف", "Remove")} onClick={() => onChange({ ...stage, fields: stage.fields.filter((_, i) => i !== index) })} /> : null}
          </div>
        );
      })}
      {!readOnly ? (
        <div>
          <Button sm kind="soft" icon="plus" label={t("حقل", "Field")} onClick={() => onChange({ ...stage, fields: [...stage.fields, { id: uniqueId("field", stage.fields.map((f) => f.id)), label: "", kind: "text" }] })} />
        </div>
      ) : null}
    </div>
  );
}

function BriefStageEditor({ stage, onChange, readOnly }: { stage: BriefStage; onChange: (next: BriefStage) => void; readOnly: boolean }) {
  const t = useT();
  const uid = useId();
  const documents = stage.documents ?? [];
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <Field id={`${uid}-title`} label={t("العنوان", "Title")} value={stage.title} onChange={(title) => onChange({ ...stage, title })} />
      <Field id={`${uid}-body`} type="textarea" rows={4} label={t("النص", "Body")} value={stage.body ?? ""} onChange={(body) => onChange({ ...stage, body })} />
      {documents.map((doc, index) => (
        <div key={index} className="ma-form-grid" style={{ borderBlockStart: "1px solid var(--line)", paddingBlockStart: 8 }}>
          <Field id={`${uid}-d${index}-title`} label={t("عنوان المستند", "Document title")} value={doc.title} onChange={(title) => onChange({ ...stage, documents: documents.map((d, i) => (i === index ? { ...d, title } : d)) })} />
          <Field id={`${uid}-d${index}-body`} type="textarea" rows={3} label={t("المحتوى", "Content")} value={doc.body} onChange={(body) => onChange({ ...stage, documents: documents.map((d, i) => (i === index ? { ...d, body } : d)) })} />
          {!readOnly ? <Button sm kind="ghost" icon="trash" label={t("حذف", "Remove")} onClick={() => onChange({ ...stage, documents: documents.filter((_, i) => i !== index) })} /> : null}
        </div>
      ))}
      {!readOnly ? (
        <div>
          <Button sm kind="soft" icon="plus" label={t("مستند", "Document")} onClick={() => onChange({ ...stage, documents: [...documents, { title: "", body: "" }] })} />
        </div>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------ the designer

const STAGE_TYPES: [Stage["type"], { ar: string; en: string }][] = [
  ["brief", { ar: "إحاطة", en: "Brief" }],
  ["select", { ar: "اختيار", en: "Pick-list" }],
  ["dialogue", { ar: "حوار", en: "Dialogue" }],
  ["form", { ar: "نموذج", en: "Form" }],
];

function newStage(type: Stage["type"], taken: string[], speaker: string): Stage {
  const id = uniqueId(type, taken);
  switch (type) {
    case "brief":
      return { id, type, title: "إحاطة", body: "" };
    case "select":
      return { id, type, title: "اختر", multiple: true, options: [{ id: "a", label: "" }] };
    case "form":
      return { id, type, title: "نموذج", fields: [{ id: "notes", label: "ملاحظات", kind: "textarea" }] };
    case "dialogue":
      return {
        id,
        type,
        title: "حوار",
        start: "open",
        nodes: {
          open: { id: "open", speaker, line: "", choices: [{ id: "c1", label: "", next: "end" }] },
          end: { id: "end", speaker, line: "", end: "success" },
        },
      };
  }
}

/**
 * Visual designer for scenarios of the `dialogue` runtime: speakers (engine slots, library
 * personas or inline), facts, stages (briefs, pick-lists, dialogues, forms) and the per-scenario
 * overrides. Guards are conditions, never code; the server re-validates on save and publish.
 */
export function DialogueEditor({
  value,
  onChange,
  personas,
  slots,
  engineMeters,
  readOnly = false,
  focus = null,
}: {
  value: unknown;
  onChange: (next: DialogueDoc) => void;
  personas: LabPersona[];
  slots: { slot: string; label: Localized }[];
  engineMeters: string[];
  readOnly?: boolean;
  focus?: { stageId?: string | null; nodeId?: string | null; token: number } | null;
}) {
  const t = useT();
  const uid = useId();
  const doc = normalize(value);
  const [stageIndex, setStageIndex] = useState(0);
  const [stageType, setStageType] = useState<Stage["type"]>("dialogue");
  const set = (patch: Partial<DialogueDoc>) => onChange({ ...doc, ...patch });
  const speakerIds = Object.keys(doc.speakers);
  const meterKeys = doc.meters?.length ? doc.meters.map((meter) => meter.key) : engineMeters;
  const factIds = (doc.facts ?? []).map((fact) => fact.id);
  const stage = doc.stages[stageIndex] as Stage | undefined;

  useEffect(() => {
    if (!focus?.token) return;
    if (!focus.stageId) return;
    const index = doc.stages.findIndex((item) => item.id === focus.stageId);
    if (index >= 0) setStageIndex(index);
  }, [focus?.stageId, focus?.token, doc.stages]);
  const tagSet = new Set<string>();
  for (const item of doc.stages) {
    if (item.type === "dialogue") for (const node of Object.values(item.nodes)) for (const choice of node.choices ?? []) for (const tag of choice.tags ?? []) tagSet.add(tag);
    if (item.type === "select") for (const option of item.options) for (const tag of option.tags ?? []) tagSet.add(tag);
  }
  const allTags = [...tagSet];
  const suggestions = [
    ...meterKeys.map((key) => `meters.${key}`),
    ...factIds.map((id) => `fact.${id}`),
    ...allTags.map((tag) => `tags.${tag}`),
    ...doc.stages.map((item) => `answers.${item.id}`),
    ...doc.stages.filter((item) => item.type === "dialogue").map((item) => `stages.${item.id}.outcome`),
  ];
  const setStage = (next: Stage) => set({ stages: doc.stages.map((item, i) => (i === stageIndex ? next : item)) });

  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      <Card title={t("الشخصيات المتحدثة", "Speakers")}>
        <p className="ma-help">
          {t(
            "كل متحدث يأخذ شخصيته من خانة في المحرّك (يختارها المختبر)، أو من مكتبة الشخصيات مباشرة، أو باسم مكتوب هنا.",
            "Each speaker takes its persona from an engine slot (cast per lab), straight from the persona library, or from a name typed here.",
          )}
        </p>
        {speakerIds.map((id) => {
          const speaker = doc.speakers[id];
          const source = speaker.slot ? "slot" : speaker.persona ? "persona" : "inline";
          const setSpeaker = (next: Speaker) => set({ speakers: { ...doc.speakers, [id]: next } });
          return (
            <div key={id} className="ma-form-grid" style={{ borderBlockEnd: "1px solid var(--line)", paddingBlockEnd: 8 }}>
              <Field id={`${uid}-sp-${id}`} label={t("المعرّف في الحوار", "Id in the dialogue")} dir="ltr" value={id} readOnly />
              <Field
                id={`${uid}-sp-${id}-source`}
                label={t("المصدر", "Source")}
                value={source}
                options={[["slot", t("خانة المحرّك", "Engine slot")], ["persona", t("شخصية من المكتبة", "Library persona")], ["inline", t("مكتوب هنا", "Inline")]]}
                onChange={(v) => setSpeaker(v === "slot" ? { slot: slots[0]?.slot ?? "" } : v === "persona" ? { persona: personas[0]?.key ?? "" } : { name: id })}
              />
              {source === "slot" ? (
                <Field id={`${uid}-sp-${id}-slot`} label={t("الخانة", "Slot")} value={speaker.slot ?? ""} options={slots.map((slot) => [slot.slot, `${slot.label.ar} (${slot.slot})`])} onChange={(slot) => setSpeaker({ slot })} />
              ) : source === "persona" ? (
                <Field id={`${uid}-sp-${id}-persona`} label={t("الشخصية", "Persona")} value={speaker.persona ?? ""} options={personas.map((p) => [p.key, `${p.name} · ${p.role}`])} onChange={(persona) => setSpeaker({ persona })} />
              ) : (
                <>
                  <Field id={`${uid}-sp-${id}-name`} label={t("الاسم", "Name")} value={speaker.name ?? ""} onChange={(name) => setSpeaker({ ...speaker, name })} />
                  <Field id={`${uid}-sp-${id}-role`} label={t("الدور", "Role")} value={speaker.role ?? ""} onChange={(role) => setSpeaker({ ...speaker, role })} />
                </>
              )}
              {!readOnly ? (
                <Button
                  sm
                  kind="ghost"
                  icon="trash"
                  label={t("حذف", "Remove")}
                  onClick={() => {
                    const speakers = { ...doc.speakers };
                    delete speakers[id];
                    set({ speakers });
                  }}
                />
              ) : null}
            </div>
          );
        })}
        {!readOnly ? (
          <div>
            <Button sm kind="soft" icon="plus" label={t("متحدث", "Speaker")} onClick={() => set({ speakers: { ...doc.speakers, [uniqueId("speaker", speakerIds)]: slots[0] ? { slot: slots[0].slot } : { name: "شخصية" } } })} />
          </div>
        ) : null}
      </Card>

      <div className="ma-cols ma-cols--2">
        <Card title={t("الحقائق القابلة للاكتشاف", "Discoverable facts")}>
          {(doc.facts ?? []).map((fact, index) => (
            <div key={index} className="ma-cell-flex" style={{ gap: 6, alignItems: "end" }}>
              <Field id={`${uid}-fact-${index}-id`} label={t("المعرّف", "Id")} dir="ltr" value={fact.id} onChange={(id) => set({ facts: (doc.facts ?? []).map((f, i) => (i === index ? { ...f, id } : f)) })} />
              <Field id={`${uid}-fact-${index}-label`} label={t("النص", "Label")} value={fact.label} onChange={(label) => set({ facts: (doc.facts ?? []).map((f, i) => (i === index ? { ...f, label } : f)) })} />
              {!readOnly ? <Button sm kind="ghost" icon="trash" label={t("حذف", "Remove")} onClick={() => set({ facts: (doc.facts ?? []).filter((_, i) => i !== index) })} /> : null}
            </div>
          ))}
          {!readOnly ? <Button sm kind="soft" icon="plus" label={t("حقيقة", "Fact")} onClick={() => set({ facts: [...(doc.facts ?? []), { id: uniqueId("fact", factIds), label: "" }] })} /> : null}
        </Card>
        <Card title={t("المؤشرات (تجاوز المحرّك)", "Meters (override the engine)")}>
          <p className="ma-help">{t(`فارغ = مؤشرات المحرّك: ${engineMeters.join("، ")}`, `Empty = the engine's meters: ${engineMeters.join(", ")}`)}</p>
          {(doc.meters ?? []).map((meter, index) => (
            <div key={index} className="ma-cell-flex" style={{ gap: 6, alignItems: "end", flexWrap: "wrap" }}>
              <Field id={`${uid}-m-${index}-key`} label={t("المفتاح", "Key")} dir="ltr" value={meter.key} onChange={(key) => set({ meters: (doc.meters ?? []).map((m, i) => (i === index ? { ...m, key } : m)) })} />
              <Field id={`${uid}-m-${index}-label`} label={t("الاسم", "Label")} value={meter.label.ar} onChange={(ar) => set({ meters: (doc.meters ?? []).map((m, i) => (i === index ? { ...m, label: { ...m.label, ar } } : m)) })} />
              <Field id={`${uid}-m-${index}-initial`} label={t("البداية", "Initial")} type="number" value={meter.initial} onChange={(v) => set({ meters: (doc.meters ?? []).map((m, i) => (i === index ? { ...m, initial: num(v) ?? 0 } : m)) })} />
              {!readOnly ? <Button sm kind="ghost" icon="trash" label={t("حذف", "Remove")} onClick={() => set({ meters: (doc.meters ?? []).filter((_, i) => i !== index) })} /> : null}
            </div>
          ))}
          {!readOnly ? <Button sm kind="soft" icon="plus" label={t("مؤشر", "Meter")} onClick={() => set({ meters: [...(doc.meters ?? []), { key: uniqueId("meter", meterKeys), label: { ar: "مؤشر" }, initial: 50, visible: true }] })} /> : null}
        </Card>
      </div>

      <Card
        title={t("مراحل السيناريو", "Scenario stages")}
        actions={
          !readOnly ? (
            <span className="ma-cell-flex" style={{ gap: 6 }}>
              <select className="ma-input" aria-label={t("نوع المرحلة", "Stage type")} value={stageType} onChange={(event) => setStageType(event.target.value as Stage["type"])}>
                {STAGE_TYPES.map(([type, label]) => (
                  <option key={type} value={type}>
                    {t(label.ar, label.en)}
                  </option>
                ))}
              </select>
              <Button
                sm
                kind="soft"
                icon="plus"
                label={t("مرحلة", "Stage")}
                onClick={() => {
                  set({ stages: [...doc.stages, newStage(stageType, doc.stages.map((s) => s.id), speakerIds[0] ?? "")] });
                  setStageIndex(doc.stages.length);
                }}
              />
            </span>
          ) : null
        }
      >
        <ol style={{ margin: 0, paddingInlineStart: "1.4em", display: "grid", gap: 4 }}>
          {doc.stages.map((item, index) => {
            const typeLabel = STAGE_TYPES.find(([type]) => type === item.type)?.[1];
            return (
              <li key={`${item.id}-${index}`}>
                <span className="ma-cell-flex" style={{ gap: 6, flexWrap: "wrap" }}>
                  <Button sm kind={index === stageIndex ? "primary" : "ghost"} label={item.title || item.id} onClick={() => setStageIndex(index)} />
                  <Badge def={{ label: typeLabel ?? { ar: item.type, en: item.type }, tone: item.type === "dialogue" ? "info" : "neutral" }} />
                  <bdi className="ma-help">{item.id}</bdi>
                  {!readOnly ? (
                    <>
                      <Button sm kind="ghost" icon="up" label={t("أعلى", "Up")} onClick={() => { set({ stages: move(doc.stages, index, -1) }); setStageIndex(Math.max(0, index - 1)); }} />
                      <Button sm kind="ghost" icon="down" label={t("أسفل", "Down")} onClick={() => { set({ stages: move(doc.stages, index, 1) }); setStageIndex(Math.min(doc.stages.length - 1, index + 1)); }} />
                      <Button sm kind="ghost" icon="trash" label={t("حذف", "Remove")} onClick={() => { set({ stages: doc.stages.filter((_, i) => i !== index) }); setStageIndex(0); }} />
                    </>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ol>
      </Card>

      {stage ? (
        <Card title={t(`المرحلة: ${stage.title || stage.id}`, `Stage: ${stage.title || stage.id}`)}>
          <Field
            id={`${uid}-stage-id`}
            label={t("معرّف المرحلة (يُستخدم في التقييم)", "Stage id (used by the rubric)")}
            dir="ltr"
            value={stage.id}
            onChange={(id) => id && !doc.stages.some((s, i) => s.id === id && i !== stageIndex) && setStage({ ...stage, id } as Stage)}
          />
          {stage.type === "dialogue" ? (
            <DialogueStageEditor
              key={`${stageIndex}-${stage.id}`}
              stage={stage}
              speakers={speakerIds}
              meters={meterKeys}
              facts={factIds}
              suggestions={suggestions}
              readOnly={readOnly}
              focusNode={focus?.nodeId}
              focusToken={focus?.token}
              onChange={setStage}
            />
          ) : stage.type === "select" ? (
            <SelectStageEditor stage={stage} readOnly={readOnly} onChange={setStage} />
          ) : stage.type === "form" ? (
            <FormStageEditor stage={stage} readOnly={readOnly} onChange={setStage} />
          ) : (
            <BriefStageEditor stage={stage} readOnly={readOnly} onChange={setStage} />
          )}
        </Card>
      ) : null}

      <Card title={t("تجاوزات هذا السيناريو", "Overrides for this scenario")}>
        <Field id={`${uid}-intro`} type="textarea" rows={2} label={t("مقدمة السيناريو", "Scenario intro")} value={doc.intro ?? ""} onChange={(intro) => set({ intro: intro || null })} />
        <Field
          id={`${uid}-constraints`}
          type="textarea"
          rows={2}
          dir="ltr"
          label={t("قيم القيود (مفتاح=قيمة لكل سطر)", "Constraint values (key=value per line)")}
          value={Object.entries(doc.constraints ?? {}).map(([key, val]) => `${key}=${String(val)}`).join("\n")}
          onChange={(v) =>
            set({
              constraints: Object.fromEntries(
                v
                  .split("\n")
                  .map((line) => line.split("="))
                  .filter(([key]) => key?.trim())
                  .map(([key, ...rest]) => {
                    const raw = rest.join("=").trim();
                    return [key.trim(), /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw === "true" ? true : raw === "false" ? false : raw];
                  }),
              ),
            })
          }
        />
        <label className="ma-check" style={{ justifyContent: "flex-start", gap: 8 }}>
          <input type="checkbox" checked={Boolean(doc.rubric)} disabled={readOnly} onChange={(event) => set({ rubric: event.target.checked ? { dimensions: [], verdicts: [], highlights: [], signals: [] } : null })} />
          {t("تقييم خاص بهذا السيناريو بدل تقييم المحرّك", "Use a scenario-specific rubric instead of the engine's")}
        </label>
        {doc.rubric ? <RubricEditor value={doc.rubric} suggestions={suggestions} readOnly={readOnly} onChange={(rubric) => set({ rubric })} /> : null}
        <Field id={`${uid}-notes`} type="textarea" rows={2} label={t("ملاحظات إدارية (لا تصل للطالب)", "Admin notes (never sent to learners)")} value={doc.notes ?? ""} onChange={(notes) => set({ notes: notes || null })} />
      </Card>
    </div>
  );
}
