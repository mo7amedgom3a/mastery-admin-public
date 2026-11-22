import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { labsKeys, labsQueries, restoreLabVersion, type LabDetail, type LabVersion } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { Alert, Button, Card, Empty, ErrorAlert, Loading } from "@/components/ui/kit";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { toast } from "@/components/ui/toast";

import { IssueList } from "../schema-form";

function VersionRow({ labId, version, canPublish }: { labId: string; version: LabVersion; canPublish: boolean }) {
  const t = useT();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const full = useQuery({ ...labsQueries.version(labId, version.version), enabled: open });
  const restore = useMutation({
    mutationFn: () => restoreLabVersion(labId, version.version),
    onSuccess: () => {
      setRestoring(false);
      toast.success(t("نُسخ الإصدار إلى المسودة", "Version restored into the draft"));
      void queryClient.invalidateQueries({ queryKey: labsKeys.detail(labId) });
      void queryClient.invalidateQueries({ queryKey: labsKeys.versions(labId) });
    },
  });
  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-control)", padding: "var(--space-3)", marginBlockEnd: "var(--space-2)" }}>
      <div className="ma-cell-flex" style={{ justifyContent: "space-between", gap: 12 }}>
        <div>
          <strong>v{version.version}</strong>
          <span className="ma-help" style={{ marginInlineStart: 8 }}>
            {formatDateTime(version.published_at)} · {t(`محرّك v${version.engine_version}`, `engine v${version.engine_version}`)}
          </span>
          {version.changelog ? <div className="ma-help">{version.changelog}</div> : null}
        </div>
        <div className="ma-cell-flex" style={{ gap: 6 }}>
          <Button sm kind="ghost" label={open ? t("إخفاء", "Hide") : t("عرض", "View")} onClick={() => setOpen((value) => !value)} />
          {canPublish ? (
            <Button sm kind="soft" label={t("استعادة للمسودة", "Restore to draft")} onClick={() => setRestoring(true)} />
          ) : null}
        </div>
      </div>
      {open ? (
        full.isLoading ? (
          <Loading />
        ) : full.data ? (
          <div style={{ marginBlockStart: "var(--space-3)" }}>
            <div className="ma-help">
              {t(`التوقيع: ${version.checksum.slice(0, 12)}…`, `Checksum: ${version.checksum.slice(0, 12)}…`)}
            </div>
            <div className="ma-help">
              {t(
                `السيناريوهات (${(full.data.scenarios ?? []).length}): ${(full.data.scenarios ?? []).map((s) => s.key).join("، ")}`,
                `Scenarios (${(full.data.scenarios ?? []).length}): ${(full.data.scenarios ?? []).map((s) => s.key).join(", ")}`,
              )}
            </div>
            <textarea
              className="ma-input ma-textarea"
              rows={12}
              dir="ltr"
              readOnly
              value={JSON.stringify(full.data.definition ?? {}, null, 2)}
            />
          </div>
        ) : (
          <ErrorAlert error={full.error} />
        )
      ) : null}
      <ConfirmModal
        open={restoring}
        onOpenChange={setRestoring}
        title={t("استعادة إصدار", "Restore version")}
        message={t(
          `سيُستبدل تعريف المسودة الحالي بمحتوى v${version.version}. لن يتغيّر ما يراه الطلاب حتى تنشر.`,
          `The current draft definition is replaced with v${version.version}. Learners see nothing new until you publish.`,
        )}
        confirmLabel={t("استعادة", "Restore")}
        tone="warning"
        loading={restore.isPending}
        onConfirm={() => restore.mutate()}
      />
      {restore.error ? <ErrorAlert error={restore.error} /> : null}
    </div>
  );
}

/** Published versions: immutable snapshots, with full document peek and restore-to-draft. */
export function VersionsTab({ detail, canPublish }: { detail: LabDetail; canPublish: boolean }) {
  const t = useT();
  const labId = detail.lab.lab_id;
  const versions = useQuery(labsQueries.versions(labId));
  const items = versions.data?.items ?? [];

  return (
    <Card title={t("الإصدارات", "Versions")}>
      <p className="ma-help">
        {t(
          "كل عملية نشر تنشئ لقطة غير قابلة للتغيير للتعريف والسيناريوهات. الجلسات الجارية تحتفظ بالإصدار الذي بدأت به.",
          "Every publish creates an immutable snapshot of the definition and scenarios. In-flight sessions keep the version they started on.",
        )}
      </p>
      {detail.has_unpublished_changes ? (
        <Alert kind="warning" title={t("توجد تغييرات غير منشورة", "Unpublished changes")}>
          <IssueList issues={detail.issues ?? []} />
          {t("انشر ليراها الطلاب.", "Publish so learners get them.")}
        </Alert>
      ) : null}
      {versions.isLoading ? (
        <Loading />
      ) : versions.error ? (
        <ErrorAlert error={versions.error} />
      ) : items.length === 0 ? (
        <Empty text={t("لم يُنشر المختبر بعد.", "The lab has not been published yet.")} />
      ) : (
        items.map((version) => <VersionRow key={version.lab_version_id} labId={labId} version={version} canPublish={canPublish} />)
      )}
    </Card>
  );
}
