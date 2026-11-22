import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getLab,
  labEngineQueries,
  labsKeys,
  previewLab,
  updateScenario,
  validateScenario,
  type LabEngine,
  type LabScenario,
  type LabValidation,
} from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Alert, Button, Card, Field, PageHead } from "@/components/ui/kit";
import { SelectField } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";

import { SchemaForm, type JsonSchema, type SchemaIssue } from "../schema-form";
import { SCENARIO_STATUS, storefrontUrl } from "../model";
import { HistoryPanel } from "./history-panel";
import { DialogueEditor } from "./dialogue-editor";
import { normalizeDefinition } from "../engine-model";
import { ScenarioFlowPanel } from "../graph/scenario-flow-panel";
import type { NodeFocus } from "../graph/types";

type Props = {
  labId: string;
  labSlug: string;
  scenario: LabScenario;
  engine: LabEngine | undefined;
  /** The admin engine the lab is built on (persona slots, meters) for the dialogue designer. */
  engineId?: string | null;
  canWrite: boolean;
  onClose: () => void;
};

/** One scenario document: generated form, raw JSON, validation and metadata. */
export function ScenarioEditor({ labId, labSlug, scenario, engine, engineId, canWrite, onClose }: Props) {
  const t = useT();
  const queryClient = useQueryClient();
  const schema = (engine?.scenario_schema ?? { type: "object" }) as JsonSchema;
  const dialogue = engine?.key === "dialogue";
  const engineDef = useQuery({ ...labEngineQueries.detail(engineId ?? ""), enabled: dialogue && Boolean(engineId) });
  const personas = useQuery({ ...labEngineQueries.personas({ status: "active" }), enabled: dialogue });
  const engineDoc = normalizeDefinition(engineDef.data?.definition);
  const engineMeters = ((engineDoc.config.meters as { key: string }[] | undefined) ?? [{ key: "trust" }, { key: "patience" }, { key: "tension" }]).map((meter) => meter.key);
  // Engines without a typed document schema are edited in raw JSON by default.
  const openSchema =
    (schema.additionalProperties === true || typeof schema.additionalProperties === "object") &&
    Object.keys(schema.properties ?? {}).length <= 1;
  // The engine catalog may still be loading: derive the default tab at render time.
  const [picked, setTab] = useState<"designer" | "form" | "json" | null>(null);
  const tab = picked ?? (dialogue ? "designer" : openSchema ? "json" : "form");
  const [content, setContent] = useState<Record<string, unknown>>(scenario.content ?? {});
  const [title, setTitle] = useState(scenario.title);
  const [key, setKey] = useState(scenario.key);
  const [weight, setWeight] = useState(String(scenario.weight));
  const [status, setStatus] = useState<LabScenario["status"]>(scenario.status);
  const [issues, setIssues] = useState<SchemaIssue[]>([]);
  const [report, setReport] = useState<LabValidation | null>(null);
  const [revision, setRevision] = useState(scenario.draft_revision);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [focus, setFocus] = useState<{ stageId?: string; nodeId?: string; token: number } | null>(null);
  const [base, setBase] = useState(() => ({
    content: scenario.content ?? {},
    title: scenario.title,
    key: scenario.key,
    weight: scenario.weight,
    status: scenario.status,
  }));

  const dirty =
    JSON.stringify(content) !== JSON.stringify(base.content) ||
    title !== base.title ||
    key !== base.key ||
    status !== base.status ||
    Number(weight) !== base.weight;

  const refresh = () => queryClient.invalidateQueries({ queryKey: labsKeys.detail(labId) });

  const save = useMutation({
    mutationFn: () =>
      updateScenario(labId, scenario.scenario_id, {
        key: key.trim(),
        title: title.trim() || key.trim(),
        status,
        weight: Number.parseInt(weight || "1", 10),
        content,
        base_revision: revision,
      }),
    onSuccess: (saved) => {
      setRevision(saved.draft_revision);
      setBase({
        content: saved.content ?? content,
        title: saved.title,
        key: saved.key,
        weight: saved.weight,
        status: saved.status,
      });
      toast.success(t("حُفظ السيناريو", "Scenario saved"));
      void refresh();
      void queryClient.invalidateQueries({ queryKey: labsKeys.history(labId, scenario.scenario_id) });
    },
  });

  const validate = useMutation({
    mutationFn: () => validateScenario(labId, { content, schema_version: scenario.schema_version }),
    onSuccess: (result) => {
      setReport(result);
      setIssues([
        ...result.errors.map((issue) => ({ path: issue.path, message: issue.message, level: "error" as const })),
        ...result.warnings.map((issue) => ({ path: issue.path, message: issue.message, level: "warning" as const })),
      ]);
      if (result.valid) toast.success(t("المستند صالح", "Document is valid"));
    },
  });

  const preview = useMutation({
    mutationFn: () => previewLab(labId, scenario.key),
    onSuccess: (result) => window.open(storefrontUrl(result.path), "_blank", "noopener,noreferrer"),
    onError: (error) => toast.error(error instanceof Error ? error.message : String(error)),
  });

  const errorCount = useMemo(() => issues.filter((issue) => issue.level === "error").length, [issues]);

  const meta = (
    <>
              <Card title={t("بيانات السيناريو", "Scenario meta")}>
                <Field id="scn-key" label={t("المفتاح", "Key")} value={key} dir="ltr" onChange={setKey} />
                <Field id="scn-title" label={t("العنوان", "Title")} value={title} onChange={setTitle} />
                <div className="ma-field">
                  <span className="ma-label">{t("الحالة", "Status")}</span>
                  <SelectField
                    label={t("الحالة", "Status")}
                    size="md"
                    fullWidth
                    value={status}
                    onChange={(value) => setStatus(value as LabScenario["status"])}
                    options={(Object.keys(SCENARIO_STATUS) as LabScenario["status"][]).map((value) => ({
                      value,
                      label: t(SCENARIO_STATUS[value].label.ar, SCENARIO_STATUS[value].label.en),
                    }))}
                  />
                </div>
                <Field
                  id="scn-weight"
                  label={t("الوزن", "Weight")}
                  type="number"
                  value={weight}
                  onChange={setWeight}
                  hint={t("الاختيار العشوائي يوزّع حسب الوزن.", "Random selection is weighted.")}
                />
                <dl className="ma-help" style={{ display: "grid", gap: 4 }}>
                  <div>{t("المراجعة", "Revision")}: {revision}</div>
                  <div>{t("آخر تحديث", "Updated")}: {new Date(scenario.updated_at).toLocaleString()}</div>
                </dl>
              </Card>
              <HistoryPanel
                labId={labId}
                scenarioId={scenario.scenario_id}
                baseRevision={revision}
                canWrite={canWrite && !dirty}
                onRestored={async () => {
                  const lab = await getLab(labId);
                  const restored = lab.scenarios.find((item) => item.scenario_id === scenario.scenario_id);
                  if (!restored) return;
                  setContent(restored.content ?? {});
                  setRevision(restored.draft_revision);
                  setBase({
                    content: restored.content ?? {},
                    title: restored.title,
                    key: restored.key,
                    weight: restored.weight,
                    status: restored.status,
                  });
                  void refresh();
                }}
              />
              {dirty ? (
                <p className="ma-help">{t("احفظ تعديلاتك أولًا لتتمكن من الاستعادة.", "Save your edits before restoring a snapshot.")}</p>
              ) : null}
            </>
  );

  const focusFromCanvas = (next: NodeFocus) => {
    if (!next.stageId && !next.nodeId) return;
    setFocus((previous) => ({
      stageId: next.stageId,
      nodeId: next.nodeId,
      token: (previous?.token ?? 0) + 1,
    }));
    if (dialogue && tab !== "designer") setTab("designer");
  };

  return (
    <>
      <PageHead
        back={{ href: `/learning/labs/${labId}/edit?tab=scenarios`, label: t("السيناريوهات", "Scenarios") }}
        title={t(`السيناريو: ${title || key}`, `Scenario: ${title || key}`)}
        sub={
          <span>
            <bdi>{scenario.key}</bdi> · {engine?.label ?? "—"} · {t(`مخطط v${scenario.schema_version}`, `schema v${scenario.schema_version}`)}
            {" · "}
            {labSlug}
          </span>
        }
        actions={
          <>
            <Button
              sm
              kind={previewOpen ? "soft" : "ghost"}
              icon="layers"
              label={t("معاينة المسار", "Flow preview")}
              onClick={() => setPreviewOpen((value) => !value)}
            />
            <Button sm kind="ghost" icon="eye" label={t("معاينة", "Preview")} disabled={preview.isPending} onClick={() => preview.mutate()} />
            <Button
              sm
              kind="ghost"
              label={validate.isPending ? t("جارٍ التحقق…", "Validating…") : t("تحقق", "Validate")}
              disabled={validate.isPending}
              onClick={() => validate.mutate()}
            />
            <Button
              sm
              kind="primary"
              label={save.isPending ? t("جارٍ الحفظ…", "Saving…") : t("حفظ", "Save")}
              disabled={!canWrite || !dirty || save.isPending}
              onClick={() => save.mutate()}
            />
            <Button sm kind="ghost" label={t("رجوع", "Back")} onClick={onClose} />
          </>
        }
      />

      {!canWrite ? (
        <Alert kind="warning" title={t("قراءة فقط", "Read only")}>
          {t("تحتاج صلاحية تعديل المختبرات لحفظ السيناريو.", "You need the labs write scope to save scenarios.")}
        </Alert>
      ) : null}

      {report ? (
        <Alert
          kind={errorCount ? "danger" : "success"}
          title={
            errorCount
              ? t(`${errorCount} خطأ`, `${errorCount} error(s)`)
              : t("المستند صالح", "Document is valid")
          }
        >
          {issues.length ? (
            <ul style={{ margin: 0, paddingInlineStart: "1.2em" }}>
              {issues.map((issue, index) => (
                <li key={`${issue.path}-${index}`} style={{ color: issue.level === "error" ? "var(--danger)" : "var(--warning)" }}>
                  <bdi>{issue.path || "/"}</bdi> — {issue.message}
                </li>
              ))}
            </ul>
          ) : (
            t("لا أخطاء ولا تنبيهات.", "No errors or warnings.")
          )}
        </Alert>
      ) : null}

      {previewOpen ? (
        <ScenarioFlowPanel
          labId={labId}
          scenarioId={scenario.scenario_id}
          title={t("مسار السيناريو", "Scenario flow")}
          content={content}
          dirty={dirty}
          height={720}
          onFocus={focusFromCanvas}
        />
      ) : null}

      <div className={tab === "designer" ? "ma-cols" : "ma-cols ma-cols--main-side"}>
        <Card
          title={tab === "designer" ? t("مصمّم السيناريو", "Scenario designer") : tab === "form" ? t("نموذج السيناريو", "Scenario form") : t("JSON الخام", "Raw JSON")}
          actions={
            <span className="ma-cell-flex" style={{ gap: 6 }}>
              {dialogue ? <Button sm kind={tab === "designer" ? "soft" : "ghost"} label={t("المصمّم", "Designer")} onClick={() => setTab("designer")} /> : null}
              <Button sm kind={tab === "form" ? "soft" : "ghost"} label={t("نموذج", "Form")} onClick={() => setTab("form")} />
              <Button sm kind={tab === "json" ? "soft" : "ghost"} label="JSON" onClick={() => setTab("json")} />
            </span>
          }
        >
          {tab === "designer" ? (
            <DialogueEditor
              value={content}
              personas={personas.data?.items ?? []}
              slots={engineDoc.persona_slots}
              engineMeters={engineMeters}
              readOnly={!canWrite}
              focus={focus}
              onChange={(next) => setContent(next as unknown as Record<string, unknown>)}
            />
          ) : tab === "form" ? (
            <SchemaForm schema={schema} value={content} onChange={(next) => setContent(next as Record<string, unknown>)} issues={issues} />
          ) : (
            <SchemaForm
              schema={{ type: "object", additionalProperties: true }}
              value={content}
              onChange={(next) => setContent(next as Record<string, unknown>)}
              issues={issues}
            />
          )}
          <p className="ma-help" style={{ marginBlockStart: "var(--space-3)" }}>
            {t(
              "النموذج مبني من مخطط المحرّك. الحقول المخفية عن الطلاب معلّمة، ويمكن دائمًا التبديل إلى JSON.",
              "The form is generated from the engine schema. Learner-hidden fields are marked, and you can always switch to raw JSON.",
            )}
          </p>
          {save.error ? <Alert kind="danger" title={t("تعذّر الحفظ", "Save failed")}>{String((save.error as Error).message)}</Alert> : null}
        </Card>

        <div>{meta}</div>
      </div>
    </>
  );
}
