import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import {
  createAssignment,
  deleteAssignment,
  labsKeys,
  labsQueries,
  type LabAssignment,
} from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { Button, Card, Empty, ErrorAlert, Field, Loading, PageHead, PageTabs } from "@/components/ui/kit";
import { SelectField } from "@/components/ui/select";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { toast } from "@/components/ui/toast";

const SCOPES = [
  { value: "cohort", label: { ar: "دفعة", en: "Cohort" } },
  { value: "company", label: { ar: "شركة", en: "Company" } },
  { value: "user", label: { ar: "مستخدم", en: "User" } },
] as const;

export function LabAssignmentsPage() {
  const { labId = "" } = useParams();
  const t = useT();
  const queryClient = useQueryClient();
  const detail = useQuery(labsQueries.detail(labId));
  const assignments = useQuery(labsQueries.assignments(labId));
  const canAssign = can("labs.assign");
  const [scopeType, setScopeType] = useState<(typeof SCOPES)[number]["value"]>("cohort");
  const [scopeId, setScopeId] = useState("");
  const [scenarioKey, setScenarioKey] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [required, setRequired] = useState(false);
  const [removing, setRemoving] = useState<LabAssignment | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: labsKeys.assignments(labId) });

  const create = useMutation({
    mutationFn: () =>
      createAssignment(labId, {
        scope_type: scopeType,
        scope_id: scopeId.trim(),
        scenario_key: scenarioKey || null,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        required,
      }),
    onSuccess: () => {
      setScopeId("");
      setDueAt("");
      setRequired(false);
      toast.success(t("أُضيف الإسناد", "Assignment added"));
      void refresh();
    },
  });

  const remove = useMutation({
    mutationFn: (assignment: LabAssignment) => deleteAssignment(labId, assignment.assignment_id),
    onSuccess: () => {
      setRemoving(null);
      toast.success(t("حُذف الإسناد", "Assignment removed"));
      void refresh();
    },
  });

  if (detail.error) return <ErrorAlert error={detail.error} />;
  if (!detail.data) return <Loading />;

  return (
    <>
      <PageHead
        back={{ href: `/learning/labs/${labId}`, label: detail.data.lab.title }}
        title={t("الإسناد", "Assignments")}
        sub={t(
          "إسناد المختبر إلى دفعة أو شركة أو مستخدم. الإسناد المطلوب يظهر كشرط بدء للمتعلّم.",
          "Assign the lab to a cohort, company or user. A required assignment becomes a start requirement for the learner.",
        )}
      />
      <PageTabs
        base={`/learning/labs/${labId}`}
        list={[
          ["", t("نظرة عامة", "Overview")],
          ["edit", t("ورشة العمل", "Studio")],
          ["attempts", t("المحاولات", "Attempts")],
          ["analytics", t("التحليلات", "Analytics")],
          ["assignments", t("الإسناد", "Assignments")],
        ]}
        active="assignments"
      />

      {canAssign ? (
        <Card title={t("إسناد جديد", "New assignment")}>
          <div className="ma-form-grid">
            <div className="ma-field">
              <span className="ma-label">{t("النطاق", "Scope")}</span>
              <SelectField
                label={t("النطاق", "Scope")}
                size="md"
                fullWidth
                value={scopeType}
                onChange={(value) => setScopeType(value as typeof scopeType)}
                options={SCOPES.map((scope) => ({ value: scope.value, label: t(scope.label.ar, scope.label.en) }))}
              />
            </div>
            <Field
              id="assign-scope"
              label={t("معرّف النطاق", "Scope id")}
              value={scopeId}
              dir="ltr"
              onChange={setScopeId}
              hint={t("معرّف الدفعة أو الشركة أو المستخدم", "Cohort, company or user id")}
            />
            <div className="ma-field">
              <span className="ma-label">{t("السيناريو", "Scenario")}</span>
              <SelectField
                label={t("السيناريو", "Scenario")}
                size="md"
                fullWidth
                value={scenarioKey}
                onChange={setScenarioKey}
                options={[
                  { value: "", label: t("أي سيناريو", "Any scenario") },
                  ...detail.data.scenarios.map((scenario) => ({ value: scenario.key, label: scenario.title || scenario.key })),
                ]}
              />
            </div>
            <Field id="assign-due" label={t("الموعد النهائي", "Due at")} type="datetime-local" value={dueAt} onChange={setDueAt} />
          </div>
          <label className="ma-check" style={{ justifyContent: "flex-start", gap: 8, marginBlockStart: "var(--space-3)", width: "fit-content" }}>
            <input type="checkbox" checked={required} onChange={() => setRequired((value) => !value)} />
            {t("مطلوب (شرط بدء)", "Required (blocks start until done)")}
          </label>
          {create.error ? <ErrorAlert error={create.error} /> : null}
          <div style={{ marginBlockStart: "var(--space-3)" }}>
            <Button
              kind="primary"
              label={create.isPending ? t("جارٍ الإضافة…", "Adding…") : t("إضافة الإسناد", "Add assignment")}
              disabled={create.isPending || scopeId.trim().length === 0}
              onClick={() => create.mutate()}
            />
          </div>
        </Card>
      ) : null}

      <Card title={t("الإسنادات الحالية", "Current assignments")}>
        {assignments.isLoading ? (
          <Loading />
        ) : assignments.error ? (
          <ErrorAlert error={assignments.error} />
        ) : (assignments.data ?? []).length === 0 ? (
          <Empty text={t("لا إسنادات.", "No assignments.")} />
        ) : (
          <div className="ma-list">
            {(assignments.data ?? []).map((assignment) => (
              <div key={assignment.assignment_id} className="ma-cell-flex" style={{ justifyContent: "space-between", padding: "var(--space-2) 0", borderBlockEnd: "1px solid var(--line)" }}>
                <div>
                  <strong>{t(SCOPES.find((scope) => scope.value === assignment.scope_type)?.label.ar ?? assignment.scope_type, SCOPES.find((scope) => scope.value === assignment.scope_type)?.label.en ?? assignment.scope_type)}</strong>{" "}
                  <bdi>{assignment.scope_id}</bdi>
                  <div className="ma-help">
                    {assignment.scenario_key ?? t("أي سيناريو", "Any scenario")}
                    {assignment.due_at ? ` · ${t("حتى", "due")} ${formatDateTime(assignment.due_at)}` : ""}
                    {assignment.required ? ` · ${t("مطلوب", "required")}` : ""}
                  </div>
                </div>
                {canAssign ? <Button sm kind="ghost" label={t("حذف", "Remove")} onClick={() => setRemoving(assignment)} /> : null}
              </div>
            ))}
          </div>
        )}
      </Card>

      <ConfirmModal
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t("حذف الإسناد", "Remove assignment")}
        message={t("سيتوقف اشتراط هذا الإسناد للمتعلّمين.", "Learners will no longer be required to complete it.")}
        confirmLabel={t("حذف", "Remove")}
        loading={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing)}
      />
    </>
  );
}

export default LabAssignmentsPage;
