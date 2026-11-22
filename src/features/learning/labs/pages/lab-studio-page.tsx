import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useSearchParams } from "react-router-dom";

import {
  labsKeys,
  labsQueries,
  saveLabDraft,
  validateLab,
  type LabDetail,
  type LabEngine,
} from "@/lib/api";
import { useT } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { ApiError } from "@/lib/api/client";
import { Alert, Badge, Button, Card, ErrorAlert, Loading, PageHead } from "@/components/ui/kit";
import { toast } from "@/components/ui/toast";

import { BlockBuilder } from "../components/block-builder";
import { LabActions } from "../components/lab-actions";
import { BasicsTab } from "../components/basics-tab";
import { EngineTab } from "../components/engine-tab";
import { DefinitionTab } from "../components/definition-tab";
import { ScenariosTab } from "../components/scenarios-tab";
import { ScenarioEditor } from "../components/scenario-editor";
import { SettingsTab } from "../components/settings-tab";
import { VersionsTab } from "../components/versions-tab";
import { IssueList, type JsonSchema, type SchemaIssue } from "../schema-form";
import { LabFlowPanel } from "../graph/lab-flow-panel";
import { labStatusBadge, labTitle } from "../model";

const TABS = [
  ["builder", { ar: "المحرّر", en: "Builder" }],
  ["basics", { ar: "البطاقة", en: "Basics" }],
  ["flow", { ar: "المسار", en: "Flow" }],
  ["engine", { ar: "المحرّك", en: "Engine" }],
  ["brief", { ar: "الإحاطة", en: "Briefing" }],
  ["requirements", { ar: "المتطلبات", en: "Requirements" }],
  ["scoring", { ar: "التقييم", en: "Scoring" }],
  ["quizzes", { ar: "الاختبارات", en: "Quizzes" }],
  ["recommendations", { ar: "التوصيات", en: "Recommendations" }],
  ["scenarios", { ar: "السيناريوهات", en: "Scenarios" }],
  ["versions", { ar: "الإصدارات", en: "Versions" }],
  ["settings", { ar: "الإعدادات", en: "Settings" }],
] as const;

type Tab = (typeof TABS)[number][0];

export function LabStudioPage() {
  const { labId = "" } = useParams();
  const detail = useQuery(labsQueries.detail(labId));
  if (detail.error) return <ErrorAlert error={detail.error} />;
  if (!detail.data) return <Loading />;
  return <Studio key={`${detail.data.lab.lab_id}:${detail.data.lab.draft_revision}`} detail={detail.data} />;
}

function Studio({ detail }: { detail: LabDetail }) {
  const t = useT();
  const lab = detail.lab;
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const blocksLab = lab.engine_key === "blocks";
  const fallbackTab: Tab = blocksLab ? "builder" : "basics";
  const requestedTab = params.get("tab") as Tab | null;
  const tab: Tab = requestedTab === "builder" && !blocksLab ? fallbackTab : (requestedTab ?? fallbackTab);
  const tabs = blocksLab ? TABS : TABS.filter(([slug]) => slug !== "builder");
  const scenarioId = params.get("scenario");
  const engines = useQuery(labsQueries.engines());
  const engine: LabEngine | undefined = engines.data?.items.find((item) => item.key === lab.engine_key);
  const definitionSchema = engines.data?.definition_schema as JsonSchema | undefined;
  const canWrite = can("labs.write");
  const canPublish = can("labs.publish");

  const [definition, setDefinition] = useState<Record<string, unknown>>(
    (detail.definition ?? {}) as Record<string, unknown>,
  );
  const [baseline, setBaseline] = useState(() => JSON.stringify(detail.definition ?? {}));
  const [report, setReport] = useState<SchemaIssue[]>([]);
  const dirty = JSON.stringify(definition) !== baseline;

  const issues: SchemaIssue[] = useMemo(() => {
    const fromDetail = (detail.issues ?? []).map((issue) => ({
      path: issue.path,
      message: issue.message,
      level: issue.level,
    }));
    return [...fromDetail, ...report];
  }, [detail.issues, report]);

  const setTab = (next: Tab) => {
    setParams((prev) => {
      const copy = new URLSearchParams(prev);
      copy.set("tab", next);
      copy.delete("scenario");
      return copy;
    });
  };

  const save = useMutation({
    mutationFn: () => saveLabDraft(lab.lab_id, { definition, base_revision: lab.draft_revision }),
    onSuccess: (next) => {
      setDefinition((next.definition ?? {}) as Record<string, unknown>);
      setBaseline(JSON.stringify(next.definition ?? {}));
      toast.success(t("حُفظت المسودة", "Draft saved"));
      void queryClient.invalidateQueries({ queryKey: labsKeys.detail(lab.lab_id) });
    },
  });

  const validate = useMutation({
    mutationFn: () => validateLab(lab.lab_id),
    onSuccess: (result) => {
      setReport([
        ...result.errors.map((issue) => ({ path: issue.path, message: issue.message, level: "error" as const })),
        ...result.warnings.map((issue) => ({ path: issue.path, message: issue.message, level: "warning" as const })),
      ]);
      toast[result.valid ? "success" : "error"](
        result.valid
          ? t("المختبر صالح للنشر", "Lab is valid for publishing")
          : t(`${result.errors.length} خطأ يمنع النشر`, `${result.errors.length} error(s) block publishing`),
      );
    },
  });

  const reload = () => {
    setReport([]);
    void queryClient.invalidateQueries({ queryKey: labsKeys.detail(lab.lab_id) }).then(() => {
      setDefinition((detail.definition ?? {}) as Record<string, unknown>);
      setBaseline(JSON.stringify(detail.definition ?? {}));
    });
  };

  const conflict = save.error instanceof ApiError && save.error.status === 409;
  const editorScenario = scenarioId ? detail.scenarios.find((scenario) => scenario.scenario_id === scenarioId) : undefined;
  const errors = issues.filter((issue) => issue.level === "error");
  const warnings = issues.filter((issue) => issue.level === "warning");

  if (editorScenario) {
    return (
      <ScenarioEditor
        labId={lab.lab_id}
        labSlug={lab.slug}
        scenario={editorScenario}
        engine={engine}
        engineId={(detail.engine as { engine_id?: string } | null | undefined)?.engine_id ?? null}
        canWrite={canWrite}
        onClose={() =>
          setParams((prev) => {
            const copy = new URLSearchParams(prev);
            copy.delete("scenario");
            copy.set("tab", "scenarios");
            return copy;
          })
        }
      />
    );
  }

  return (
    <>
      <PageHead
        back={{ href: `/learning/labs/${lab.lab_id}`, label: labTitle(lab) }}
        title={t(`ورشة العمل: ${labTitle(lab)}`, `Studio: ${labTitle(lab)}`)}
        status={<Badge def={labStatusBadge(lab.status)} />}
        sub={
          <span>
            <bdi>{lab.slug}</bdi> · {engine?.label ?? lab.engine_key}
            {detail.has_unpublished_changes ? ` · ${t("تغييرات غير منشورة", "unpublished changes")}` : ""}
          </span>
        }
        actions={<LabActions detail={detail} />}
      />

      <nav className="ma-pagetabs" aria-label={t("أقسام ورشة العمل", "Studio sections")}>
        {tabs.map(([slug, label]) => (
          <button
            key={slug}
            type="button"
            className="ma-pagetabs__btn"
            aria-current={slug === tab ? "page" : undefined}
            onClick={() => setTab(slug)}
            style={{
              background: "none",
              border: 0,
              cursor: "pointer",
              font: "inherit",
              color: "inherit",
              padding: "inherit",
              borderBlockEnd: slug === tab ? "2px solid var(--accent)" : "2px solid transparent",
            }}
          >
            {t(label.ar, label.en)}
          </button>
        ))}
      </nav>

      {errors.length ? (
        <Alert kind="danger" title={t(`${errors.length} خطأ`, `${errors.length} error(s)`)}>
          <IssueList issues={errors.slice(0, 30)} />
        </Alert>
      ) : null}
      {warnings.length ? (
        <Alert kind="warning" title={t(`${warnings.length} تنبيه`, `${warnings.length} warning(s)`)}>
          <IssueList issues={warnings.slice(0, 30)} />
        </Alert>
      ) : null}

      {tab !== "builder" && tab !== "basics" && tab !== "flow" && tab !== "scenarios" && tab !== "versions" && tab !== "settings" ? (
        <Card
          title={t("مسودة التعريف", "Definition draft")}
          actions={
            <span className="ma-cell-flex" style={{ gap: 6 }}>
              <Button
                sm
                kind="ghost"
                label={validate.isPending ? t("جارٍ التحقق…", "Validating…") : t("تحقق", "Validate")}
                disabled={validate.isPending}
                onClick={() => validate.mutate()}
              />
              <Button sm kind="primary" label={save.isPending ? t("جارٍ الحفظ…", "Saving…") : t("حفظ المسودة", "Save draft")} disabled={!canWrite || !dirty || save.isPending} onClick={() => save.mutate()} />
              <Button sm kind="ghost" label={t("تراجع", "Reset")} disabled={!dirty} onClick={() => { setDefinition((detail.definition ?? {}) as Record<string, unknown>); setBaseline(JSON.stringify(detail.definition ?? {})); }} />
            </span>
          }
        >
          <p className="ma-help">
            {t(
              `مراجعة ${lab.draft_revision}. الحفظ يستخدم base_revision؛ إذا عُدّلت المسودة من تبويب آخر ستظهر رسالة تعارض.`,
              `Revision ${lab.draft_revision}. Saves use base_revision; if another tab changed the draft you get a conflict instead of a silent overwrite.`,
            )}
          </p>
          {dirty ? <span className="ma-help">{t("لديك تغييرات غير محفوظة.", "You have unsaved changes.")}</span> : null}
          {conflict ? (
            <Alert kind="danger" title={t("تعارض في المراجعة", "Revision conflict")}>
              {t("عُدّلت المسودة منذ فتحها. أعد التحميل لترى أحدث نسخة، أو انسخ تعديلاتك يدويًا.", "The draft changed since you opened it. Reload to get the latest revision, or copy your edits manually.")}
              <div style={{ marginBlockStart: 8 }}>
                <Button sm kind="soft" label={t("إعادة التحميل", "Reload")} onClick={reload} />
              </div>
            </Alert>
          ) : save.error ? (
            <ErrorAlert error={save.error} />
          ) : null}
        </Card>
      ) : null}

      {tab === "builder" && blocksLab ? (
        <BlockBuilder labId={lab.lab_id} labSlug={lab.slug} scenarios={detail.scenarios} canWrite={canWrite} />
      ) : null}
      {tab === "basics" ? <BasicsTab detail={detail} canWrite={canWrite} engineKey={lab.engine_key} /> : null}
      {tab === "flow" ? (
        <LabFlowPanel
          labId={lab.lab_id}
          definition={definition}
          dirty={dirty}
          onTab={(next) => setTab(next as Tab)}
          onScenario={(scenarioId) =>
            setParams((prev) => {
              const copy = new URLSearchParams(prev);
              copy.set("tab", "scenarios");
              copy.set("scenario", scenarioId);
              return copy;
            })
          }
        />
      ) : null}
      {tab === "engine" ? <EngineTab detail={detail} definition={definition} onChange={setDefinition} readOnly={!canWrite} /> : null}
      {tab === "brief" ? (
        <DefinitionTab
          title={t("الإحاطة والمراحل", "Briefing & phases")}
          description={t(
            "الدور والسياق والأهداف والقيود والمراحل التي تظهر للطالب قبل البدء وفي الشريط الجانبي.",
            "The role, situation, targets, constraints and phases shown to the learner before and during the run.",
          )}
          schema={definitionSchema}
          section={["role", "scenario", "targets", "constraints", "phases"]}
          value={definition}
          onChange={setDefinition}
          issues={issues}
          readOnly={!canWrite}
        />
      ) : null}
      {tab === "requirements" ? (
        <DefinitionTab
          title={t("متطلبات البدء", "Start requirements")}
          description={t(
            "شروط تُقيَّم عند بدء الجلسة: تسجيل الدخول، استحقاق، إسناد، نافذة تاريخ، مهارة، موافقة. «block» يمنع البدء و«warn» ينبّه.",
            "Conditions evaluated when a session starts: auth, entitlement, assignment, date window, skill, consent. `block` stops the start; `warn` only warns.",
          )}
          schema={definitionSchema}
          section={["requirements"]}
          value={definition}
          onChange={setDefinition}
          issues={issues}
          readOnly={!canWrite}
        />
      ) : null}
      {tab === "scoring" ? (
        <DefinitionTab
          title={t("التقييم والإشارات", "Scoring & signals")}
          description={t(
            "الأبعاد وأوزانها والمهارة المرتبطة، والإشارات المشروطة، وحدود الجاهزية، وقاعدة XP. يُحسب النهائي على الخادم.",
            "Dimensions with weights and skills, conditional signals, readiness thresholds and the XP rule. The final score is computed on the server.",
          )}
          schema={definitionSchema}
          section={["scoring"]}
          value={definition}
          onChange={setDefinition}
          issues={issues}
          readOnly={!canWrite}
        />
      ) : null}
      {tab === "quizzes" ? (
        <DefinitionTab
          title={t("الاختبار القبلي والبعدي", "Pre and post quizzes")}
          description={t("تُعرض قبل المختبر وبعد التقييم وتظهر في المحاولة.", "Shown before the lab and after the debrief, and stored on the attempt.")}
          schema={definitionSchema}
          section={["pre_quiz", "post_quiz"]}
          value={definition}
          onChange={setDefinition}
          issues={issues}
          readOnly={!canWrite}
        />
      ) : null}
      {tab === "recommendations" ? (
        <DefinitionTab
          title={t("التوصيات واللغة", "Recommendations & locale")}
          description={t(
            "ما يُقترح بعد التقييم، وكيف تختار الجلسة سيناريوها، ولغة المختبر والملاحظات الإدارية (لا تصل للطالب).",
            "What to suggest after the debrief, how a session picks its scenario, the locale, and admin-only notes (never sent to learners).",
          )}
          schema={definitionSchema}
          section={["recommendations", "scenario_selection", "locale", "notes"]}
          value={definition}
          onChange={setDefinition}
          issues={issues}
          readOnly={!canWrite}
        />
      ) : null}
      {tab === "scenarios" ? (
        <ScenariosTab
          detail={detail}
          canWrite={canWrite}
          onEdit={(id) =>
            setParams((prev) => {
              const copy = new URLSearchParams(prev);
              copy.set("tab", "scenarios");
              copy.set("scenario", id);
              return copy;
            })
          }
        />
      ) : null}
      {tab === "versions" ? <VersionsTab detail={detail} canPublish={canPublish} /> : null}
      {tab === "settings" ? <SettingsTab detail={detail} canPublish={canPublish} /> : null}
    </>
  );
}

export default LabStudioPage;
