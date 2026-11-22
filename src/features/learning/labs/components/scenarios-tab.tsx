import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  createScenario,
  deleteScenario,
  duplicateScenario,
  labsKeys,
  orderScenarios,
  type LabDetail,
  type LabScenario,
} from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { Badge, Button, Card, Empty, ErrorAlert, Field } from "@/components/ui/kit";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";

import { SCENARIO_STATUS, slugify } from "../model";

/** Scenario list: create, duplicate, reorder, disable/delete and open the document editor. */
export function ScenariosTab({
  detail,
  canWrite,
  onEdit,
}: {
  detail: LabDetail;
  canWrite: boolean;
  onEdit: (scenarioId: string) => void;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const labId = detail.lab.lab_id;
  const scenarios = [...detail.scenarios].sort((a, b) => a.sort_order - b.sort_order);
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [duplicating, setDuplicating] = useState<LabScenario | null>(null);
  const [duplicateKey, setDuplicateKey] = useState("");
  const [removing, setRemoving] = useState<LabScenario | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: labsKeys.detail(labId) });

  const create = useMutation({
    mutationFn: () =>
      createScenario(labId, {
        key: slugify(newKey) || `scenario-${scenarios.length + 1}`,
        title: newTitle.trim() || null,
        status: "active",
        weight: 1,
      }),
    onSuccess: (scenario) => {
      setCreating(false);
      setNewKey("");
      setNewTitle("");
      toast.success(t("أُضيف السيناريو", "Scenario added"));
      void refresh();
      onEdit(scenario.scenario_id);
    },
  });

  const duplicate = useMutation({
    mutationFn: (scenario: LabScenario) =>
      duplicateScenario(labId, scenario.scenario_id, {
        key: slugify(duplicateKey),
        title: scenario.title ? `${scenario.title} (نسخة)` : null,
      }),
    onSuccess: () => {
      setDuplicating(null);
      toast.success(t("نُسخ السيناريو", "Scenario duplicated"));
      void refresh();
    },
  });

  const remove = useMutation({
    mutationFn: (scenario: LabScenario) => deleteScenario(labId, scenario.scenario_id),
    onSuccess: () => {
      setRemoving(null);
      toast.success(t("حُذف السيناريو أو عُطّل إن كان منشورًا", "Scenario deleted, or disabled if it was published"));
      void refresh();
    },
  });

  const reorder = useMutation({
    mutationFn: (ids: string[]) => orderScenarios(labId, ids),
    onSuccess: () => void refresh(),
  });

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= scenarios.length) return;
    const ids = scenarios.map((scenario) => scenario.scenario_id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorder.mutate(ids);
  };

  const activeWeight = scenarios.filter((scenario) => scenario.status === "active").reduce((sum, s) => sum + s.weight, 0);

  return (
    <Card
      title={t("السيناريوهات", "Scenarios")}
      actions={
        canWrite ? (
          <Button sm kind="primary" icon="plus" label={t("سيناريو جديد", "New scenario")} onClick={() => setCreating(true)} />
        ) : undefined
      }
    >
      <p className="ma-help">
        {t(
          "المختبر الواحد يحمل عدة سيناريوهات (قطاع، مستوى أو نسخة A/B). الجلسة تختار واحدًا حسب إعداد «اختيار السيناريو».",
          "One lab carries many scenarios (a sector, a level or an A/B variant). A session picks one according to the lab's scenario selection.",
        )}
      </p>
      {scenarios.length === 0 ? (
        <Empty text={t("لا سيناريوهات بعد.", "No scenarios yet.")} action={canWrite ? <Button sm label={t("أضف سيناريو", "Add scenario")} onClick={() => setCreating(true)} /> : undefined} />
      ) : (
        <div className="ma-list">
          {scenarios.map((scenario, index) => (
            <div
              key={scenario.scenario_id}
              className="ma-cell-flex"
              style={{ justifyContent: "space-between", gap: 12, padding: "var(--space-3) 0", borderBlockEnd: "1px solid var(--line)" }}
            >
              <div>
                <div className="ma-cell-flex" style={{ gap: 8 }}>
                  <strong>{scenario.title || scenario.key}</strong>
                  <Badge def={SCENARIO_STATUS[scenario.status]} />
                  <span className="ma-help">
                    <bdi>{scenario.key}</bdi> · v{scenario.schema_version} · {t(`وزن ${scenario.weight}`, `weight ${scenario.weight}`)}
                  </span>
                </div>
                <div className="ma-help">
                  {t("آخر تحديث", "Updated")} {formatDateTime(scenario.updated_at)} · {t(`مراجعة ${scenario.draft_revision}`, `revision ${scenario.draft_revision}`)}
                  {scenario.issues?.length ? ` · ${t(`${scenario.issues.length} مشكلة`, `${scenario.issues.length} issue(s)`)}` : ""}
                </div>
              </div>
              <div className="ma-cell-flex" style={{ gap: 4 }}>
                <Button sm kind="ghost" icon="up" label={t("أعلى", "Up")} disabled={index === 0 || reorder.isPending} onClick={() => move(index, -1)} />
                <Button sm kind="ghost" icon="down" label={t("أسفل", "Down")} disabled={index === scenarios.length - 1 || reorder.isPending} onClick={() => move(index, 1)} />
                <Button sm kind="soft" label={t("تحرير", "Edit")} onClick={() => onEdit(scenario.scenario_id)} />
                {canWrite ? (
                  <>
                    <Button
                      sm
                      kind="ghost"
                      label={t("نسخ", "Duplicate")}
                      onClick={() => {
                        setDuplicating(scenario);
                        setDuplicateKey(`${scenario.key}-copy`);
                      }}
                    />
                    <Button sm kind="ghost" label={t("حذف", "Delete")} onClick={() => setRemoving(scenario)} />
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
      {activeWeight <= 0 ? (
        <ErrorAlert error={{ message: t("مجموع أوزان السيناريوهات النشطة صفر — لن يعمل الاختيار العشوائي.", "Active scenario weights sum to zero — random selection cannot work.") }} />
      ) : null}
      {reorder.error ? <ErrorAlert error={reorder.error} /> : null}

      <Modal
        open={creating}
        onOpenChange={setCreating}
        title={t("سيناريو جديد", "New scenario")}
        description={t("يُنشأ بمحتوى بداية من المحرّك، ثم تحرّره في تبويب النموذج.", "Created with the engine's starter content; edit it in the form tab.")}
        footer={
          <>
            <Button kind="ghost" label={t("إلغاء", "Cancel")} onClick={() => setCreating(false)} />
            <Button kind="primary" label={create.isPending ? t("جارٍ الإنشاء…", "Creating…") : t("إنشاء", "Create")} disabled={create.isPending} onClick={() => create.mutate()} />
          </>
        }
      >
        <Field id="new-scn-key" label={t("المفتاح", "Key")} value={newKey} dir="ltr" onChange={setNewKey} hint={t("مثال: medical", "e.g. medical")} />
        <Field id="new-scn-title" label={t("العنوان", "Title")} value={newTitle} onChange={setNewTitle} />
        {create.error ? <ErrorAlert error={create.error} /> : null}
      </Modal>

      <Modal
        open={Boolean(duplicating)}
        onOpenChange={(open) => !open && setDuplicating(null)}
        title={t("نسخ السيناريو", "Duplicate scenario")}
        footer={
          <>
            <Button kind="ghost" label={t("إلغاء", "Cancel")} onClick={() => setDuplicating(null)} />
            <Button
              kind="primary"
              label={duplicate.isPending ? t("جارٍ النسخ…", "Duplicating…") : t("نسخ", "Duplicate")}
              disabled={duplicate.isPending || !duplicateKey.trim()}
              onClick={() => duplicating && duplicate.mutate(duplicating)}
            />
          </>
        }
      >
        <Field id="dup-scn-key" label={t("مفتاح النسخة", "Copy key")} value={duplicateKey} dir="ltr" onChange={setDuplicateKey} />
        {duplicate.error ? <ErrorAlert error={duplicate.error} /> : null}
      </Modal>

      <ConfirmModal
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t("حذف السيناريو", "Delete scenario")}
        message={t(
          `سيُحذف «${removing?.title || removing?.key}» نهائيًا إن لم يكن منشورًا، وإلا سيُعطّل.`,
          `“${removing?.title || removing?.key}” is deleted if unpublished, otherwise disabled.`,
        )}
        confirmLabel={t("حذف", "Delete")}
        loading={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing)}
      />
    </Card>
  );
}
