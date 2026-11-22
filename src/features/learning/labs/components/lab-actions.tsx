import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import {
  archiveLab,
  convertLabToBlocks,
  duplicateLab,
  labsKeys,
  previewLab,
  publishLab,
  unpublishLab,
  type LabDetail,
} from "@/lib/api";
import { useT } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { Button, ErrorAlert, Field } from "@/components/ui/kit";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";

import { slugify, storefrontUrl } from "../model";
import { OpenReviewLink, QualityCheckButton } from "./quality-report";

/** Publish / unpublish / duplicate / archive / preview actions for one lab. */
export function LabActions({ detail, compact = false }: { detail: LabDetail; compact?: boolean }) {
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const lab = detail.lab;
  const issues = detail.issues ?? [];
  const canPublish = can("labs.publish");
  const canWrite = can("labs.write");
  const [publishing, setPublishing] = useState(false);
  const [changelog, setChangelog] = useState("");
  const [duplicating, setDuplicating] = useState(false);
  const [duplicateSlug, setDuplicateSlug] = useState(`${lab.slug}-copy`);
  const [duplicateTitle, setDuplicateTitle] = useState(`${lab.title} (نسخة)`);
  const [archiving, setArchiving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [convertSlug, setConvertSlug] = useState(`${lab.slug}-blocks`);
  const [convertTitle, setConvertTitle] = useState(`${lab.title} (بلوكات)`);

  const refresh = () => queryClient.invalidateQueries({ queryKey: labsKeys.all });

  const publish = useMutation({
    mutationFn: () => publishLab(lab.lab_id, changelog.trim() || null),
    onSuccess: (version) => {
      setPublishing(false);
      setChangelog("");
      toast.success(t(`نُشر الإصدار ${version.version}`, `Published version ${version.version}`));
      void refresh();
    },
  });
  const unpublish = useMutation({
    mutationFn: () => unpublishLab(lab.lab_id),
    onSuccess: () => {
      toast.success(t("أُوقف المختبر؛ الجلسات الجارية تحتفظ بإصدارها", "Lab paused; in-flight sessions keep their version"));
      void refresh();
    },
  });
  const duplicate = useMutation({
    mutationFn: () => duplicateLab(lab.lab_id, { slug: slugify(duplicateSlug), title: duplicateTitle.trim() || null }),
    onSuccess: (copy) => {
      setDuplicating(false);
      toast.success(t("نُسخ المختبر كمسودة", "Lab duplicated as a draft"));
      void refresh();
      navigate(`/learning/labs/${copy.lab.lab_id}/edit`);
    },
  });
  const convert = useMutation({
    mutationFn: () =>
      convertLabToBlocks(lab.lab_id, {
        slug: slugify(convertSlug),
        title: convertTitle.trim() || null,
      }),
    onSuccess: (copy) => {
      setConverting(false);
      toast.success(t("أُنشئت نسخة بلوكات قابلة للتحرير", "A composable blocks copy was created"));
      void refresh();
      navigate(`/learning/labs/${copy.lab.lab_id}/edit?tab=builder`);
    },
  });
  const archive = useMutation({
    mutationFn: () => archiveLab(lab.lab_id),
    onSuccess: () => {
      setArchiving(false);
      toast.success(t("أُرشف المختبر", "Lab archived"));
      void refresh();
    },
  });
  const preview = useMutation({
    mutationFn: () => previewLab(lab.lab_id, detail.scenarios[0]?.key ?? null),
    onSuccess: (result) => window.open(storefrontUrl(result.path), "_blank", "noopener,noreferrer"),
    onError: (error) => toast.error(error instanceof Error ? error.message : String(error)),
  });

  return (
    <span className="ma-cell-flex" style={{ gap: 6, flexWrap: "wrap" }}>
      <OpenReviewLink targetId={lab.lab_id} />
      <QualityCheckButton target="lab" id={lab.lab_id} />
      <Button
        sm
        kind="ghost"
        icon="eye"
        label={t("معاينة", "Preview")}
        disabled={preview.isPending}
        onClick={() => preview.mutate()}
      />
      <Button
        sm
        kind="ghost"
        icon="layers"
        label={t("المسار", "Flow")}
        href={`/learning/labs/${lab.lab_id}/edit?tab=flow`}
      />
      {canPublish ? (
        lab.status === "published" ? (
          <Button
            sm
            kind="ghost"
            label={t("إيقاف", "Pause")}
            disabled={unpublish.isPending}
            onClick={() => unpublish.mutate()}
          />
        ) : (
          <Button
            sm
            kind="primary"
            label={t("نشر", "Publish")}
            disabled={lab.status === "archived"}
            onClick={() => setPublishing(true)}
          />
        )
      ) : null}
      {canWrite ? (
        <>
          <Button sm kind="ghost" label={t("نسخ", "Duplicate")} onClick={() => setDuplicating(true)} />
          {lab.engine_key === "schema" ? (
            <Button sm kind="ghost" label={t("تحويل إلى بلوكات", "Convert to blocks")} onClick={() => setConverting(true)} />
          ) : null}
          {!compact && lab.status !== "archived" ? (
            <Button sm kind="ghost" label={t("أرشفة", "Archive")} onClick={() => setArchiving(true)} />
          ) : null}
        </>
      ) : null}

      <Modal
        open={publishing}
        onOpenChange={setPublishing}
        title={t("نشر المختبر", "Publish lab")}
        description={t(
          "تنشئ عملية النشر لقطة غير قابلة للتغيير من المسودة وكل السيناريوهات النشطة. الجلسات الجارية تحتفظ بإصدارها.",
          "Publishing snapshots the draft and every active scenario into an immutable version. In-flight sessions keep their version.",
        )}
        footer={
          <>
            <Button kind="ghost" label={t("إلغاء", "Cancel")} onClick={() => setPublishing(false)} />
            <Button
              kind="primary"
              label={publish.isPending ? t("جارٍ النشر…", "Publishing…") : t("نشر", "Publish")}
              disabled={publish.isPending}
              onClick={() => publish.mutate()}
            />
          </>
        }
      >
        <Field
          id="publish-changelog"
          type="textarea"
          rows={3}
          label={t("ملاحظات الإصدار (اختياري)", "Changelog (optional)")}
          value={changelog}
          onChange={setChangelog}
          hint={t("تظهر في سجل الإصدارات.", "Shown in the version history.")}
        />
        {issues.length ? (
          <ErrorAlert
            error={{
              message: t(
                `${issues.length} مشكلة في المسودة قد تمنع النشر`,
                `${issues.length} draft issue(s) may block publishing`,
              ),
            }}
          />
        ) : null}
        {publish.error ? <ErrorAlert error={publish.error} /> : null}
      </Modal>

      <Modal
        open={converting}
        onOpenChange={setConverting}
        title={t("تحويل المختبر إلى بلوكات", "Convert lab to blocks")}
        description={t(
          "يُنشئ هذا نسخة جديدة بمحرّك البلوكات من مسار المختبر الحالي. المختبر الأصلي لا يتغيّر. أنواع العقد التي لا مقابل لها بعد (محاكي، مستند، CRM، اختبار، فرع) تمنع التحويل وتظهر كأخطاء.",
          "Creates a new blocks-engine copy of the current pathway. The original lab is untouched. Node types without a blocks equivalent yet (simulator, document, CRM, quiz, branch) block the conversion and are reported.",
        )}
        footer={
          <>
            <Button kind="ghost" label={t("إلغاء", "Cancel")} onClick={() => setConverting(false)} />
            <Button
              kind="primary"
              label={convert.isPending ? t("جارٍ التحويل…", "Converting…") : t("تحويل", "Convert")}
              disabled={convert.isPending || !convertSlug.trim()}
              onClick={() => convert.mutate()}
            />
          </>
        }
      >
        <Field id="convert-slug" label={t("معرّف النسخة", "Copy slug")} value={convertSlug} dir="ltr" onChange={setConvertSlug} />
        <Field id="convert-title" label={t("العنوان", "Title")} value={convertTitle} onChange={setConvertTitle} />
        {convert.error ? <ErrorAlert error={convert.error} /> : null}
      </Modal>

      <Modal
        open={duplicating}
        onOpenChange={setDuplicating}
        title={t("نسخ المختبر", "Duplicate lab")}
        footer={
          <>
            <Button kind="ghost" label={t("إلغاء", "Cancel")} onClick={() => setDuplicating(false)} />
            <Button
              kind="primary"
              label={duplicate.isPending ? t("جارٍ النسخ…", "Duplicating…") : t("نسخ", "Duplicate")}
              disabled={duplicate.isPending || !duplicateSlug.trim()}
              onClick={() => duplicate.mutate()}
            />
          </>
        }
      >
        <Field id="dup-slug" label={t("المعرّف الجديد", "New slug")} value={duplicateSlug} dir="ltr" onChange={setDuplicateSlug} />
        <Field id="dup-title" label={t("العنوان", "Title")} value={duplicateTitle} onChange={setDuplicateTitle} />
        {duplicate.error ? <ErrorAlert error={duplicate.error} /> : null}
      </Modal>

      <ConfirmModal
        open={archiving}
        onOpenChange={setArchiving}
        title={t("أرشفة المختبر", "Archive lab")}
        message={t(
          "لن يظهر المختبر للطلاب بعد الأرشفة. يمكن استعادته من الحالة.",
          "The lab stops showing to learners. You can restore it from its status.",
        )}
        confirmLabel={t("أرشفة", "Archive")}
        loading={archive.isPending}
        onConfirm={() => archive.mutate()}
      />
      {archive.error ? <ErrorAlert error={archive.error} /> : null}
    </span>
  );
}
