import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { Badge, ErrorAlert, Loading } from "@/components/ui/kit";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { toast } from "@/components/ui/toast";
import { restoreStudioVersion, studioQueries, type StudioContent } from "@/lib/api";
import { useLang, useT, localeOf } from "@/lib/i18n";

const SYNC: Record<string, [string, string, "success" | "warning" | "danger" | "neutral"]> = {
  synced: ["متزامن مع النظام القديم", "Synced to legacy", "success"],
  disabled: ["الكتابة للنظام القديم معطلة", "Legacy writes off", "neutral"],
  skipped_no_legacy: ["بدون نظام قديم", "No legacy page", "neutral"],
  failed: ["فشل التزامن", "Legacy sync failed", "danger"],
  pending: ["قيد التزامن", "Syncing", "warning"],
};

/** Published versions; restoring copies one into the draft (publish it again to make it live). */
export function VersionsPanel({ productRef, onRestored }: { productRef: string; onRestored: (content: StudioContent) => void }) {
  const t = useT();
  const lang = useLang();
  const [versionToRestore, setVersionToRestore] = useState<string | null>(null);

  const versions = useQuery(studioQueries.versions(productRef));
  const restore = useMutation({
    mutationFn: (versionId: string) => restoreStudioVersion(productRef, versionId),
    onSuccess: (data) => {
      toast.success(t("تمت استعادة النسخة إلى المسودة بنجاح", "Version restored to draft successfully"));
      setVersionToRestore(null);
      onRestored(data);
    },
    onError: (err: unknown) => {
      toast.error(
        t("فشل في استعادة النسخة", "Failed to restore version"),
        err instanceof Error ? err.message : undefined
      );
    },
  });

  if (versions.isLoading) return <Loading />;
  return (
    <div className="ma-studio-versions">
      <ErrorAlert error={versions.error ?? restore.error} />
      {!versions.data?.length ? (
        <p className="ma-assets__empty">{t("لم تُنشر أي نسخة بعد.", "Nothing published yet.")}</p>
      ) : null}
      <ol>
        {versions.data?.map((version) => {
          const [ar, en, tone] = SYNC[version.legacy_sync_status] ?? SYNC.pending;
          return (
            <li key={version.version_id}>
              <div>
                <strong>{t(`النسخة ${version.version_no}`, `Version ${version.version_no}`)}</strong>
                <span className="ma-studio-versions__date">
                  {new Date(version.published_at).toLocaleString(localeOf(lang), { dateStyle: "medium", timeStyle: "short" })}
                </span>
              </div>
              {version.note ? <p>{version.note}</p> : null}
              <div className="ma-studio-versions__row">
                <Badge def={{ label: { ar, en }, tone }} />
                <button
                  type="button"
                  className="ma-sblock__btn"
                  disabled={restore.isPending}
                  onClick={() => setVersionToRestore(version.version_id)}
                >
                  {t("استعادة إلى المسودة", "Restore to draft")}
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      <ConfirmModal
        open={Boolean(versionToRestore)}
        onOpenChange={(open) => !open && setVersionToRestore(null)}
        tone="warning"
        title={t("تأكيد استعادة النسخة", "Confirm Version Restore")}
        message={t(
          "استبدال المسودة الحالية بمحتوى هذه النسخة المنشورة؟",
          "Replace the current draft with content from this published version?"
        )}
        description={t(
          "سيتم استبدال التغييرات غير المنشورة في المسودة الحالية.",
          "Any unpublished changes in your current draft will be overwritten."
        )}
        confirmLabel={t("استعادة إلى المسودة", "Restore to draft")}
        cancelLabel={t("إلغاء", "Cancel")}
        loading={restore.isPending}
        onConfirm={() => {
          if (versionToRestore) {
            restore.mutate(versionToRestore);
          }
        }}
      />
    </div>
  );
}
