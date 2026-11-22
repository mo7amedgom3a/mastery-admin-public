import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import {
  deleteEngineDef,
  getEngineDefVersion,
  labEngineKeys,
  labEngineQueries,
  publishEngineDef,
  restoreEngineDef,
  saveEngineDraft,
  setEngineDefStatus,
  testEngineDef,
  updateEngineDef,
  validateEngineDef,
  type EngineConstraint,
  type EngineDefDetail,
  type EngineDefinitionDoc,
  type EngineTestResult,
  type LabPersona,
} from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { formatDateTime } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { AppLink } from "@/components/ui/app-link";
import { Alert, Badge, Button, Card, Dl, Empty, ErrorAlert, Field, FormActions, Loading, PageHead } from "@/components/ui/kit";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { toast } from "@/components/ui/toast";

import { COLORS } from "../model";
import { CONSTRAINT_TYPES, ENGINE_STATUS, ICONS, SYSTEM_BADGE, engineName, normalizeDefinition } from "../engine-model";
import { IssueList, SchemaForm, type JsonSchema, type SchemaIssue } from "../schema-form";
import { DialogueEditor } from "../components/dialogue-editor";
import { EngineFlowPanel } from "../graph/engine-flow-panel";
import { OpenReviewLink, QualityCheckButton } from "../components/quality-report";
import { RubricEditor } from "../components/rubric-editor";

const TABS = [
  ["basics", { ar: "البطاقة", en: "Basics" }],
  ["flow", { ar: "المسار", en: "Flow" }],
  ["context", { ar: "السياق", en: "Context" }],
  ["runtime", { ar: "إعدادات التشغيل", en: "Runtime config" }],
  ["personas", { ar: "الشخصيات", en: "Personas" }],
  ["constraints", { ar: "القيود", en: "Constraints" }],
  ["scoring", { ar: "التقييم", en: "Scoring" }],
  ["starter", { ar: "سيناريو البداية", en: "Starter scenario" }],
  ["test", { ar: "اختبار التقييم", en: "Test scoring" }],
  ["versions", { ar: "الإصدارات", en: "Versions" }],
  ["usage", { ar: "المختبرات", en: "Labs" }],
] as const;
type Tab = (typeof TABS)[number][0];
const DEFINITION_TABS: Tab[] = ["flow", "context", "runtime", "personas", "constraints", "scoring", "starter"];

export function EngineStudioPage() {
  const { engineId = "" } = useParams();
  const detail = useQuery(labEngineQueries.detail(engineId));
  if (detail.error) return <ErrorAlert error={detail.error} />;
  if (!detail.data) return <Loading />;
  return <Studio key={`${detail.data.engine.engine_id}:${detail.data.engine.draft_revision}`} detail={detail.data} />;
}

function Studio({ detail }: { detail: EngineDefDetail }) {
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const engine = detail.engine;
  const system = engine.is_system;
  const tab = (params.get("tab") as Tab | null) ?? (system ? "basics" : "context");
  const canWrite = can("labs.write") && !system;
  const canPublish = can("labs.publish") && !system;
  const personas = useQuery(labEngineQueries.personas({ status: "active" }));

  const [definition, setDefinition] = useState<EngineDefinitionDoc>(() => normalizeDefinition(detail.definition));
  const [baseline, setBaseline] = useState(() => JSON.stringify(normalizeDefinition(detail.definition)));
  const [report, setReport] = useState<SchemaIssue[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dirty = JSON.stringify(definition) !== baseline;
  const set = (patch: Partial<EngineDefinitionDoc>) => setDefinition((current) => ({ ...current, ...patch }));
  const issues: SchemaIssue[] = report ?? (detail.issues ?? []).map((issue) => ({ path: issue.path, message: issue.message, level: issue.level }));
  const errors = issues.filter((issue) => issue.level === "error");
  const warnings = issues.filter((issue) => issue.level === "warning");
  const refresh = () => queryClient.invalidateQueries({ queryKey: labEngineKeys.all });

  const setTab = (next: Tab) => setParams((prev) => {
    const copy = new URLSearchParams(prev);
    copy.set("tab", next);
    return copy;
  });

  const save = useMutation({
    mutationFn: () => saveEngineDraft(engine.engine_id, definition, engine.draft_revision),
    onSuccess: (next) => {
      const normalized = normalizeDefinition(next.definition);
      setDefinition(normalized);
      setBaseline(JSON.stringify(normalized));
      setReport(null);
      toast.success(t("حُفظت مسودة المحرّك", "Engine draft saved"));
      void refresh();
    },
  });
  const validate = useMutation({
    mutationFn: () => validateEngineDef(engine.engine_id, definition),
    onSuccess: (result) => {
      setReport([
        ...result.errors.map((issue) => ({ path: issue.path, message: issue.message, level: "error" as const })),
        ...result.warnings.map((issue) => ({ path: issue.path, message: issue.message, level: "warning" as const })),
      ]);
      toast[result.valid ? "success" : "error"](result.valid ? t("المحرّك صالح", "Engine is valid") : t(`${result.errors.length} خطأ`, `${result.errors.length} error(s)`));
    },
  });
  const publish = useMutation({
    mutationFn: () => publishEngineDef(engine.engine_id),
    onSuccess: (version) => {
      toast.success(t(`نُشر الإصدار ${version.version}`, `Published version ${version.version}`));
      void refresh();
    },
  });
  const archive = useMutation({
    mutationFn: () => setEngineDefStatus(engine.engine_id, engine.status === "archived" ? "draft" : "archived"),
    onSuccess: () => void refresh(),
  });
  const remove = useMutation({
    mutationFn: () => deleteEngineDef(engine.engine_id),
    onSuccess: () => {
      void refresh();
      navigate("/learning/labs/engines");
    },
  });

  const conflict = save.error instanceof ApiError && save.error.status === 409;
  const meterKeys = useMemo(
    () => ((definition.config.meters as { key: string }[] | undefined) ?? []).map((meter) => meter.key),
    [definition.config.meters],
  );

  return (
    <>
      <PageHead
        back={{ href: "/learning/labs/engines", label: t("المحرّكات", "Engines") }}
        title={engineName(engine)}
        status={<Badge def={system ? SYSTEM_BADGE : ENGINE_STATUS[engine.status]} />}
        sub={
          <span>
            <bdi>{engine.key}</bdi> · {detail.runtime.label}
            {engine.published_version ? ` · v${engine.published_version}` : ""}
            {detail.has_unpublished_changes ? ` · ${t("تغييرات غير منشورة", "unpublished changes")}` : ""}
          </span>
        }
        actions={
          <span className="ma-cell-flex" style={{ gap: 6, flexWrap: "wrap" }}>
            {!system ? <OpenReviewLink targetId={engine.engine_id} /> : null}
            {!system ? <Button sm kind="ghost" label={t("تحقق", "Validate")} disabled={validate.isPending} onClick={() => validate.mutate()} /> : null}
            {!system ? <QualityCheckButton target="engine" id={engine.engine_id} /> : null}
            {canWrite ? <Button sm kind="primary" label={save.isPending ? t("جارٍ الحفظ…", "Saving…") : t("حفظ المسودة", "Save draft")} disabled={!dirty || save.isPending} onClick={() => save.mutate()} /> : null}
            {canPublish ? (
              <Button sm kind="soft" icon="send" label={publish.isPending ? t("جارٍ النشر…", "Publishing…") : t("نشر", "Publish")} disabled={dirty || publish.isPending || !detail.has_unpublished_changes} onClick={() => publish.mutate()} />
            ) : null}
            <Button sm kind="ghost" icon="copy" label={t("نسخ كمحرّك جديد", "Duplicate")} href={`/learning/labs/engines/new?copy=${engine.engine_id}`} />
            <Button sm kind="ghost" icon="plus" label={t("مختبر بهذا المحرّك", "New lab on it")} href={`/learning/labs/new?engine_id=${engine.engine_id}`} />
          </span>
        }
      />

      {system ? (
        <Alert kind="info" title={t("محرّك نظام", "System engine")}>
          {t("يمثل آلية تشغيل برمجية ولا يُعدّل. انسخه لبناء محرّك خاص بك.", "It mirrors a code runtime and cannot be edited. Duplicate it to build your own.")}
        </Alert>
      ) : null}

      <nav className="ma-pagetabs" aria-label={t("أقسام المحرّك", "Engine sections")}>
        {TABS.filter(([slug]) => !system || slug === "basics" || slug === "flow" || slug === "usage").map(([slug, label]) => (
          <button
            key={slug}
            type="button"
            className="ma-pagetabs__btn"
            aria-current={slug === tab ? "page" : undefined}
            onClick={() => setTab(slug)}
            style={{ background: "none", border: 0, cursor: "pointer", font: "inherit", color: "inherit", padding: "inherit", borderBlockEnd: slug === tab ? "2px solid var(--accent)" : "2px solid transparent" }}
          >
            {t(label.ar, label.en)}
          </button>
        ))}
      </nav>

      {errors.length ? (
        <Alert kind="danger" title={t(`${errors.length} خطأ يمنع النشر`, `${errors.length} error(s) block publishing`)}>
          <IssueList issues={errors.slice(0, 30)} />
        </Alert>
      ) : null}
      {warnings.length ? (
        <Alert kind="warning" title={t(`${warnings.length} تنبيه`, `${warnings.length} warning(s)`)}>
          <IssueList issues={warnings.slice(0, 30)} />
        </Alert>
      ) : null}
      {conflict ? (
        <Alert kind="danger" title={t("تعارض في المراجعة", "Revision conflict")}>
          {t("عُدّل المحرّك منذ فتحه. أعد التحميل لترى أحدث نسخة.", "The engine changed since you opened it. Reload to get the latest revision.")}
          <div style={{ marginBlockStart: 8 }}>
            <Button sm kind="soft" label={t("إعادة التحميل", "Reload")} onClick={() => window.location.reload()} />
          </div>
        </Alert>
      ) : save.error ? (
        <ErrorAlert error={save.error} />
      ) : null}
      {publish.error ? <ErrorAlert error={publish.error} /> : null}
      {dirty && DEFINITION_TABS.includes(tab) ? <p className="ma-help">{t("لديك تغييرات غير محفوظة.", "You have unsaved changes.")}</p> : null}

      {tab === "basics" ? <BasicsTab detail={detail} canWrite={canWrite} onArchive={() => archive.mutate()} onDelete={() => setConfirmDelete(true)} /> : null}

      {tab === "flow" ? (
        <EngineFlowPanel
          engineId={engine.engine_id}
          definition={definition}
          dirty={dirty}
          onTab={(next) => setTab(next as Tab)}
        />
      ) : null}

      {tab === "context" ? (
        <Card title={t("سياق المحرّك", "Engine context")}>
          <p className="ma-help">
            {t(
              "يظهر المجال والإعداد ودور المتعلم في إحاطة كل مختبر مبني على هذا المحرّك (ما لم يكتب المختبر نصه الخاص).",
              "The domain, setting and learner role appear in the briefing of every lab built on this engine (unless the lab writes its own).",
            )}
          </p>
          <div className="ma-form-grid">
            <Field id="ctx-domain" label={t("المجال", "Domain")} value={definition.context.domain ?? ""} readOnly={!canWrite} onChange={(domain) => set({ context: { ...definition.context, domain } })} />
            <Field id="ctx-role" label={t("دور المتعلم", "Learner role")} value={definition.context.learner_role ?? ""} readOnly={!canWrite} onChange={(learner_role) => set({ context: { ...definition.context, learner_role } })} />
            <Field id="ctx-tone" label={t("نبرة المحاكاة", "Simulation tone")} value={definition.context.tone ?? ""} readOnly={!canWrite} onChange={(tone) => set({ context: { ...definition.context, tone } })} />
            <Field
              id="ctx-glossary"
              label={t("المصطلحات", "Glossary")}
              value={(definition.context.glossary ?? []).join("، ")}
              hint={t("مفصولة بفواصل", "Comma separated")}
              readOnly={!canWrite}
              onChange={(value) => set({ context: { ...definition.context, glossary: value.split(/[,،]/).map((item) => item.trim()).filter(Boolean) } })}
            />
          </div>
          <Field id="ctx-setting" type="textarea" rows={4} label={t("الإعداد (العالم الذي يدخله المتعلم)", "Setting (the world the learner steps into)")} value={definition.context.setting ?? ""} readOnly={!canWrite} onChange={(setting) => set({ context: { ...definition.context, setting } })} />
          <Alert kind="info" title={t("وضع الذكاء الاصطناعي (لاحقًا)", "AI mode (later)")}>
            {t("هذه التعليمات محفوظة ولا تصل للطالب. ستُستخدم عندما يُفعَّل وضع الشخصيات بالذكاء الاصطناعي.", "These prompts are stored and never sent to learners. They will be used when the AI persona mode is enabled.")}
          </Alert>
          <Field id="ctx-system" type="textarea" rows={4} label={t("تعليمات الشخصيات", "Persona system prompt")} value={definition.context.system_prompt ?? ""} readOnly={!canWrite} onChange={(system_prompt) => set({ context: { ...definition.context, system_prompt } })} />
          <Field id="ctx-observer" type="textarea" rows={3} label={t("تعليمات المقيّم", "Observer prompt")} value={definition.context.observer_prompt ?? ""} readOnly={!canWrite} onChange={(observer_prompt) => set({ context: { ...definition.context, observer_prompt } })} />
          <Field id="ctx-notes" type="textarea" rows={2} label={t("ملاحظات إدارية", "Admin notes")} value={definition.notes ?? ""} readOnly={!canWrite} onChange={(notes) => set({ notes: notes || null })} />
        </Card>
      ) : null}

      {tab === "runtime" ? (
        <Card title={t("إعدادات التشغيل", "Runtime config")}>
          <p className="ma-help">
            {t(
              "المؤشرات (الثقة، الصبر، التوتر… أو مؤشراتك الخاصة)، كلفة كل رد، سرعة الحديث وما يظهر للطالب. تُطبَّق على كل سيناريو ما لم يتجاوزها.",
              "Meters (trust, patience, tension… or your own), the cost of every reply, talk speed and what the learner sees. Every scenario uses them unless it overrides them.",
            )}
          </p>
          {detail.runtime.config_schema ? (
            <SchemaForm schema={detail.runtime.config_schema as JsonSchema} value={definition.config} onChange={(config) => set({ config: config as Record<string, unknown> })} issues={issues.filter((i) => i.path.startsWith("/definition/config")).map((i) => ({ ...i, path: i.path.replace("/definition/config", "") }))} />
          ) : (
            <Empty text={t("هذه الآلية بلا إعدادات.", "This runtime has no settings.")} />
          )}
        </Card>
      ) : null}

      {tab === "personas" ? (
        <PersonaSlotsTab definition={definition} personas={personas.data?.items ?? []} canWrite={canWrite} onChange={(persona_slots) => set({ persona_slots })} />
      ) : null}

      {tab === "constraints" ? <ConstraintsTab constraints={definition.constraints} canWrite={canWrite} onChange={(constraints) => set({ constraints })} /> : null}

      {tab === "scoring" ? (
        <RubricEditor
          value={definition.rubric}
          readOnly={!canWrite}
          suggestions={[...meterKeys.map((key) => `meters.${key}`), ...definition.constraints.map((c) => `constraints.${c.key}`)]}
          onChange={(rubric) => set({ rubric: rubric as unknown as Record<string, unknown> })}
        />
      ) : null}

      {tab === "starter" ? (
        <Card title={t("سيناريو البداية", "Starter scenario")}>
          <p className="ma-help">
            {t("يُنسخ إلى كل مختبر أو سيناريو جديد مبني على هذا المحرّك، فيبدأ المؤلف من مثال صالح.", "Copied into every new lab or scenario built on this engine, so authors start from a valid example.")}
          </p>
          {engine.runtime_key === "dialogue" ? (
            <>
              {!definition.starter_scenario && canWrite ? (
                <Button kind="soft" label={t("إنشاء من مثال المحرّك", "Create from the runtime example")} onClick={() => set({ starter_scenario: { speakers: { client: { slot: definition.persona_slots[0]?.slot ?? "counterpart" } }, stages: [] } })} />
              ) : null}
              {definition.starter_scenario ? (
                <DialogueEditor
                  value={definition.starter_scenario}
                  personas={personas.data?.items ?? []}
                  slots={definition.persona_slots}
                  engineMeters={meterKeys}
                  readOnly={!canWrite}
                  onChange={(starter_scenario) => set({ starter_scenario: starter_scenario as unknown as Record<string, unknown> })}
                />
              ) : null}
            </>
          ) : (
            <SchemaForm schema={{ type: "object", additionalProperties: true }} value={definition.starter_scenario ?? {}} onChange={(value) => set({ starter_scenario: value as Record<string, unknown> })} />
          )}
        </Card>
      ) : null}

      {tab === "test" ? <TestTab engineId={engine.engine_id} definition={definition} dirty={dirty} /> : null}
      {tab === "versions" ? <VersionsTab engineId={engine.engine_id} canWrite={canWrite} /> : null}
      {tab === "usage" ? <UsageTab engineId={engine.engine_id} /> : null}

      <ConfirmModal
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("حذف المحرّك؟", "Delete the engine?")}
        message={t("يُحذف المحرّك نهائيًا إن لم يُنشر ولم يُستخدم، وإلا يُؤرشف.", "The engine is deleted if it was never published or used; otherwise it is archived.")}
        confirmLabel={t("حذف", "Delete")}
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </>
  );
}

// ------------------------------------------------------------------ tabs

function BasicsTab({ detail, canWrite, onArchive, onDelete }: { detail: EngineDefDetail; canWrite: boolean; onArchive: () => void; onDelete: () => void }) {
  const t = useT();
  const queryClient = useQueryClient();
  const engine = detail.engine;
  const name = engine.name as { ar?: string; en?: string | null };
  const description = engine.description as { ar?: string; en?: string | null };
  const [card, setCard] = useState({
    key: engine.key,
    nameAr: name.ar ?? "",
    nameEn: name.en ?? "",
    descAr: description.ar ?? "",
    icon: engine.icon,
    color: engine.color,
    sort: String(engine.sort_order),
    field: engine.field_category_id == null ? "" : String(engine.field_category_id),
  });
  const save = useMutation({
    mutationFn: () =>
      updateEngineDef(engine.engine_id, {
        key: card.key,
        name: { ar: card.nameAr, en: card.nameEn || null },
        description: { ar: card.descAr, en: description.en ?? null },
        icon: card.icon,
        color: card.color,
        sort_order: Number(card.sort || 0),
        field_category_id: card.field ? Number(card.field) : null,
      }),
    onSuccess: () => {
      toast.success(t("حُفظت البطاقة", "Card saved"));
      void queryClient.invalidateQueries({ queryKey: labEngineKeys.all });
    },
  });
  return (
    <Card title={t("بطاقة المحرّك", "Engine card")}>
      <div className="ma-form-grid">
        <Field id="card-ar" label={t("الاسم (عربي)", "Name (Arabic)")} value={card.nameAr} readOnly={!canWrite} onChange={(nameAr) => setCard({ ...card, nameAr })} />
        <Field id="card-en" label={t("الاسم (إنجليزي)", "Name (English)")} value={card.nameEn} readOnly={!canWrite} onChange={(nameEn) => setCard({ ...card, nameEn })} />
        <Field id="card-key" label={t("المفتاح", "Key")} dir="ltr" value={card.key} readOnly={!canWrite || Boolean(engine.published_version)} onChange={(key) => setCard({ ...card, key })} />
        <Field id="card-icon" label={t("الأيقونة", "Icon")} value={card.icon} options={[...new Set([card.icon, ...ICONS])].map((item) => [item, item])} onChange={(icon) => setCard({ ...card, icon })} />
        <Field id="card-color" label={t("اللون", "Colour")} value={card.color} options={[...new Set([card.color, ...COLORS])].map((item) => [item, item])} onChange={(color) => setCard({ ...card, color })} />
        <Field id="card-field" label={t("المجال (رقم الفئة)", "Field (category id)")} type="number" value={card.field} readOnly={!canWrite} onChange={(field) => setCard({ ...card, field })} />
        <Field id="card-sort" label={t("الترتيب", "Sort order")} type="number" value={card.sort} readOnly={!canWrite} onChange={(sort) => setCard({ ...card, sort })} />
      </div>
      <Field id="card-desc" type="textarea" rows={2} label={t("الوصف", "Description")} value={card.descAr} readOnly={!canWrite} onChange={(descAr) => setCard({ ...card, descAr })} />
      <Dl
        rows={[
          [t("آلية التشغيل", "Runtime"), <bdi key="r">{engine.runtime_key}</bdi>],
          [t("المراجعة", "Revision"), engine.draft_revision],
          [t("آخر نشر", "Last published"), engine.published_at ? formatDateTime(engine.published_at) : "—"],
          [t("المختبرات", "Labs"), engine.lab_count],
        ]}
      />
      {save.error ? <ErrorAlert error={save.error} /> : null}
      {canWrite ? (
        <FormActions>
          <Button kind="primary" label={save.isPending ? t("جارٍ الحفظ…", "Saving…") : t("حفظ البطاقة", "Save card")} disabled={save.isPending} onClick={() => save.mutate()} />
          <Button kind="ghost" label={engine.status === "archived" ? t("إلغاء الأرشفة", "Unarchive") : t("أرشفة", "Archive")} onClick={onArchive} />
          <Button kind="ghost" icon="trash" label={t("حذف", "Delete")} onClick={onDelete} />
        </FormActions>
      ) : null}
    </Card>
  );
}

function PersonaSlotsTab({ definition, personas, canWrite, onChange }: { definition: EngineDefinitionDoc; personas: LabPersona[]; canWrite: boolean; onChange: (slots: EngineDefinitionDoc["persona_slots"]) => void }) {
  const t = useT();
  const slots = definition.persona_slots;
  const setSlot = (index: number, patch: Partial<EngineDefinitionDoc["persona_slots"][number]>) => onChange(slots.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)));
  return (
    <Card
      title={t("خانات الشخصيات", "Persona slots")}
      actions={canWrite ? <Button sm kind="soft" icon="plus" label={t("خانة", "Slot")} onClick={() => onChange([...slots, { slot: `role_${slots.length + 1}`, label: { ar: "دور" }, required: true, default_persona_key: null }])} /> : null}
    >
      <p className="ma-help">
        {t(
          "الخانة دور يحتاجه المحرّك (الموظف، المدير، العميل…). تختار شخصية افتراضية من المكتبة، ويمكن لكل مختبر اختيار شخصية أخرى.",
          "A slot is a role the engine needs (employee, manager, customer…). Pick a default persona from the library; each lab may cast another one.",
        )}{" "}
        <AppLink className="ma-link" to="/learning/labs/personas">
          {t("مكتبة الشخصيات", "Persona library")}
        </AppLink>
      </p>
      {slots.length ? null : <Empty text={t("لا خانات بعد.", "No slots yet.")} />}
      {slots.map((slot, index) => {
        const persona = personas.find((item) => item.key === slot.default_persona_key);
        return (
          <div key={index} className="ma-form-grid" style={{ borderBlockStart: index ? "1px solid var(--line)" : undefined, paddingBlockStart: 8 }}>
            <Field id={`slot-${index}-key`} label={t("المفتاح", "Key")} dir="ltr" value={slot.slot} readOnly={!canWrite} onChange={(value) => setSlot(index, { slot: value })} />
            <Field id={`slot-${index}-label`} label={t("الاسم", "Label")} value={slot.label.ar} readOnly={!canWrite} onChange={(ar) => setSlot(index, { label: { ...slot.label, ar } })} />
            <Field
              id={`slot-${index}-persona`}
              label={t("الشخصية الافتراضية", "Default persona")}
              value={slot.default_persona_key ?? "none"}
              options={[["none", t("بلا", "None")], ...personas.map((item): [string, string] => [item.key, `${item.name} · ${item.role}`])]}
              onChange={(value) => setSlot(index, { default_persona_key: value === "none" ? null : value })}
            />
            <Field id={`slot-${index}-req`} label={t("إلزامية", "Required")} value={slot.required === false ? "no" : "yes"} options={[["yes", t("نعم", "Yes")], ["no", t("لا", "No")]]} onChange={(value) => setSlot(index, { required: value === "yes" })} />
            {persona ? <span className="ma-help">{(persona.profile as { personality?: string }).personality}</span> : null}
            {canWrite ? <Button sm kind="ghost" icon="trash" label={t("حذف", "Remove")} onClick={() => onChange(slots.filter((_, i) => i !== index))} /> : null}
          </div>
        );
      })}
    </Card>
  );
}

function ConstraintsTab({ constraints, canWrite, onChange }: { constraints: EngineConstraint[]; canWrite: boolean; onChange: (next: EngineConstraint[]) => void }) {
  const t = useT();
  const setItem = (index: number, patch: Partial<EngineConstraint>) => onChange(constraints.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  const parse = (item: EngineConstraint, raw: string): unknown => {
    if (raw === "" || raw === "none") return null;
    if (item.type === "bool") return raw === "true";
    if (item.type === "text") return raw;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  };
  return (
    <Card
      title={t("القيود وقواعد اللعبة", "Constraints & rules of the game")}
      actions={canWrite ? <Button sm kind="soft" icon="plus" label={t("قيد", "Constraint")} onClick={() => onChange([...constraints, { key: `rule_${constraints.length + 1}`, label: { ar: "قيد جديد" }, type: "number", value: null, lab_overridable: true, learner_visible: true }])} /> : null}
    >
      <p className="ma-help">
        {t(
          "ميزانية، مدة، حد أدنى… القيود الظاهرة تُعرض في إحاطة المختبر، وكلها متاحة للتقييم كـ constraints.<المفتاح>. القيود القابلة للتجاوز يغيّر المختبر قيمتها.",
          "Budget, duration, thresholds… Visible constraints are listed in the lab briefing and all are available to scoring as constraints.<key>. Overridable ones can be changed per lab.",
        )}
      </p>
      {constraints.length ? null : <Empty text={t("لا قيود.", "No constraints.")} />}
      {constraints.map((item, index) => (
        <div key={index} className="ma-form-grid" style={{ borderBlockStart: index ? "1px solid var(--line)" : undefined, paddingBlockStart: 8 }}>
          <Field id={`c-${index}-key`} label={t("المفتاح", "Key")} dir="ltr" value={item.key} readOnly={!canWrite} onChange={(key) => setItem(index, { key })} />
          <Field id={`c-${index}-label`} label={t("الاسم", "Label")} value={item.label.ar} readOnly={!canWrite} onChange={(ar) => setItem(index, { label: { ...item.label, ar } })} />
          <Field id={`c-${index}-type`} label={t("النوع", "Type")} value={item.type} options={CONSTRAINT_TYPES.map(([value, label]) => [value, t(label.ar, label.en)])} onChange={(type) => setItem(index, { type: type as EngineConstraint["type"], value: null })} />
          {item.type === "bool" ? (
            <Field id={`c-${index}-value`} label={t("القيمة", "Value")} value={item.value == null ? "none" : String(item.value)} options={[["none", "—"], ["true", t("نعم", "Yes")], ["false", t("لا", "No")]]} onChange={(raw) => setItem(index, { value: parse(item, raw) })} />
          ) : (
            <Field id={`c-${index}-value`} label={t("القيمة", "Value")} type={item.type === "text" ? "text" : "number"} value={item.value == null ? "" : String(item.value)} readOnly={!canWrite} onChange={(raw) => setItem(index, { value: parse(item, raw) })} />
          )}
          <Field id={`c-${index}-unit`} label={t("الوحدة", "Unit")} value={item.unit ?? ""} readOnly={!canWrite} onChange={(unit) => setItem(index, { unit: unit || null })} />
          {item.type !== "text" && item.type !== "bool" ? (
            <>
              <Field id={`c-${index}-min`} label={t("الحد الأدنى", "Min")} type="number" value={item.min ?? ""} readOnly={!canWrite} onChange={(raw) => setItem(index, { min: raw === "" ? null : Number(raw) })} />
              <Field id={`c-${index}-max`} label={t("الحد الأعلى", "Max")} type="number" value={item.max ?? ""} readOnly={!canWrite} onChange={(raw) => setItem(index, { max: raw === "" ? null : Number(raw) })} />
            </>
          ) : null}
          <Field id={`c-${index}-visible`} label={t("يظهر للطالب", "Learner visible")} value={item.learner_visible === false ? "no" : "yes"} options={[["yes", t("نعم", "Yes")], ["no", t("لا (سري)", "No (hidden)")]]} onChange={(v) => setItem(index, { learner_visible: v === "yes" })} />
          <Field id={`c-${index}-override`} label={t("يعدّله المختبر", "Lab can override")} value={item.lab_overridable === false ? "no" : "yes"} options={[["yes", t("نعم", "Yes")], ["no", t("لا", "No")]]} onChange={(v) => setItem(index, { lab_overridable: v === "yes" })} />
          {canWrite ? <Button sm kind="ghost" icon="trash" label={t("حذف", "Remove")} onClick={() => onChange(constraints.filter((_, i) => i !== index))} /> : null}
        </div>
      ))}
    </Card>
  );
}

function runTemplate(scenario: Record<string, unknown> | null | undefined): string {
  const stages = ((scenario?.stages as { id: string; type: string }[] | undefined) ?? []).map((stage) => [
    stage.id,
    stage.type === "dialogue" ? { choices: [] } : stage.type === "select" ? { selected: [] } : stage.type === "form" ? { values: {} } : {},
  ]);
  return JSON.stringify({ stages: Object.fromEntries(stages) }, null, 2);
}

function TestTab({ engineId, definition, dirty }: { engineId: string; definition: EngineDefinitionDoc; dirty: boolean }) {
  const t = useT();
  const [run, setRun] = useState(() => runTemplate(definition.starter_scenario));
  const [result, setResult] = useState<EngineTestResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const test = useMutation({
    mutationFn: () => testEngineDef(engineId, { scenario: (definition.starter_scenario ?? {}) as Record<string, unknown>, run: JSON.parse(run) as Record<string, unknown> }),
    onSuccess: setResult,
  });
  return (
    <div className="ma-cols ma-cols--main-side">
      <Card title={t("محاولة تجريبية", "Sample run")}>
        <p className="ma-help">
          {t(
            "يُقيَّم سيناريو البداية بالمسودة المحفوظة للمحرّك دون حفظ شيء. اكتب معرّفات الردود لكل مرحلة حوار، والخيارات المختارة، وقيم النماذج.",
            "Scores the starter scenario with the engine's saved draft, without saving anything. List the reply ids per dialogue stage, the picked options and the form values.",
          )}
        </p>
        {dirty ? <Alert kind="warning" title={t("احفظ أولًا", "Save first")}>{t("الاختبار يستخدم آخر مسودة محفوظة.", "The test uses the last saved draft.")}</Alert> : null}
        {!definition.starter_scenario ? <Alert kind="warning" title={t("لا سيناريو بداية", "No starter scenario")}>{t("أضف سيناريو بداية لاختباره.", "Add a starter scenario to test it.")}</Alert> : null}
        <textarea className="ma-input ma-textarea" dir="ltr" rows={14} aria-label={t("المحاولة (JSON)", "Run (JSON)")} value={run} onChange={(event) => setRun(event.target.value)} style={{ fontFamily: "var(--font-mono, monospace)" }} />
        {parseError ? <Alert kind="danger" title="JSON">{parseError}</Alert> : null}
        {test.error ? <ErrorAlert error={test.error} /> : null}
        <FormActions>
          <Button
            kind="primary"
            label={test.isPending ? t("جارٍ التقييم…", "Scoring…") : t("قيّم المحاولة", "Score the run")}
            disabled={test.isPending || !definition.starter_scenario}
            onClick={() => {
              try {
                JSON.parse(run);
                setParseError(null);
                test.mutate();
              } catch (error) {
                setParseError(String((error as Error).message));
              }
            }}
          />
          <Button kind="ghost" label={t("قالب فارغ", "Blank template")} onClick={() => setRun(runTemplate(definition.starter_scenario))} />
        </FormActions>
      </Card>
      <Card title={t("النتيجة", "Result")}>
        {result ? (
          <>
            <Dl
              rows={[
                [t("الإجمالي", "Overall"), <strong key="o">{String((result.scorecard as { overall?: number }).overall ?? "—")}</strong>],
                [t("الحكم", "Verdict"), String((result.scorecard as { verdict?: string }).verdict ?? "")],
                ...((result.scorecard as { dimensions?: { key: string; label: string; score: number }[] }).dimensions ?? []).map((d): [string, string] => [d.label, String(d.score)]),
              ]}
            />
            {result.problems?.length ? <Alert kind="warning" title={t("مشكلات في المحاولة", "Run problems")}>{result.problems.join(" · ")}</Alert> : null}
            <details>
              <summary className="ma-help">{t("سياق التقييم (للمسارات في الشروط)", "Scoring context (paths for conditions)")}</summary>
              <pre dir="ltr" style={{ fontSize: 12, whiteSpace: "pre-wrap", maxHeight: "40vh", overflow: "auto" }}>{JSON.stringify(result.context, null, 2)}</pre>
            </details>
          </>
        ) : (
          <Empty text={t("شغّل التقييم لترى الأبعاد والسياق.", "Run scoring to see the dimensions and the context.")} />
        )}
      </Card>
    </div>
  );
}

function VersionsTab({ engineId, canWrite }: { engineId: string; canWrite: boolean }) {
  const t = useT();
  const queryClient = useQueryClient();
  const versions = useQuery(labEngineQueries.versions(engineId));
  const [peek, setPeek] = useState<{ no: number; json: string } | null>(null);
  const restore = useMutation({
    mutationFn: (no: number) => restoreEngineDef(engineId, no),
    onSuccess: () => {
      toast.success(t("استُعيد الإصدار إلى المسودة", "Version restored into the draft"));
      void queryClient.invalidateQueries({ queryKey: labEngineKeys.all });
    },
  });
  if (versions.error) return <ErrorAlert error={versions.error} />;
  if (!versions.data) return <Loading />;
  return (
    <Card title={t("الإصدارات المنشورة", "Published versions")}>
      {versions.data.length ? null : <Empty text={t("لم يُنشر بعد.", "Not published yet.")} />}
      {versions.data.map((version) => (
        <div key={version.engine_version_id} className="ma-cell-flex" style={{ gap: 8, justifyContent: "space-between", borderBlockEnd: "1px solid var(--line)", paddingBlock: 6, flexWrap: "wrap" }}>
          <span>
            <strong>v{version.version}</strong> · {formatDateTime(version.published_at)}
            {version.changelog ? <span className="ma-help"> · {version.changelog}</span> : null}
          </span>
          <span className="ma-cell-flex" style={{ gap: 4 }}>
            <Button sm kind="ghost" icon="eye" label={t("عرض", "View")} onClick={() => void getEngineDefVersion(engineId, version.version).then((full) => setPeek({ no: version.version, json: JSON.stringify(full.definition, null, 2) }))} />
            {canWrite ? <Button sm kind="ghost" icon="history" label={t("استعادة للمسودة", "Restore to draft")} disabled={restore.isPending} onClick={() => restore.mutate(version.version)} /> : null}
          </span>
        </div>
      ))}
      {peek ? (
        <details open>
          <summary>v{peek.no}</summary>
          <pre dir="ltr" style={{ fontSize: 12, whiteSpace: "pre-wrap", maxHeight: "50vh", overflow: "auto" }}>{peek.json}</pre>
        </details>
      ) : null}
    </Card>
  );
}

function UsageTab({ engineId }: { engineId: string }) {
  const t = useT();
  const usage = useQuery(labEngineQueries.usage(engineId));
  if (usage.error) return <ErrorAlert error={usage.error} />;
  if (!usage.data) return <Loading />;
  const latest = usage.data.published_version;
  return (
    <Card title={t("المختبرات المبنية على هذا المحرّك", "Labs built on this engine")}>
      <p className="ma-help">
        {t(
          "كل مختبر منشور يثبّت إصدار المحرّك الذي نُشر عليه. أعد نشر المختبر ليأخذ أحدث إصدار.",
          "Every published lab pins the engine version it was published with. Republish a lab to pick up the latest version.",
        )}
      </p>
      {usage.data.items.length ? null : <Empty text={t("لا مختبرات بعد.", "No labs yet.")} />}
      {usage.data.items.map((item) => (
        <div key={item.lab_id} className="ma-cell-flex" style={{ gap: 8, justifyContent: "space-between", borderBlockEnd: "1px solid var(--line)", paddingBlock: 6, flexWrap: "wrap" }}>
          <AppLink className="ma-link" to={`/learning/labs/${item.lab_id}/edit`}>
            {item.title} <bdi className="ma-help">{item.slug}</bdi>
          </AppLink>
          <span className="ma-cell-flex" style={{ gap: 4 }}>
            <span className="ma-help">{item.status}</span>
            {item.engine_version_no != null ? (
              <Badge
                def={
                  latest && item.engine_version_no !== latest
                    ? { label: { ar: `محرّك v${item.engine_version_no} (أقدم)`, en: `engine v${item.engine_version_no} (older)` }, tone: "warning" }
                    : { label: { ar: `محرّك v${item.engine_version_no}`, en: `engine v${item.engine_version_no}` }, tone: "success" }
                }
              />
            ) : (
              <Badge def={{ label: { ar: "غير منشور", en: "Not published" }, tone: "neutral" }} />
            )}
          </span>
        </div>
      ))}
    </Card>
  );
}

export default EngineStudioPage;
