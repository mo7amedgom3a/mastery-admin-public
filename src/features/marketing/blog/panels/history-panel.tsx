import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ErrorAlert, Loading } from "@/components/ui/kit";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { toast } from "@/components/ui/toast";
import {
  blogKeys,
  blogQueries,
  restoreBlogVersion,
  type BlogPostDetail,
  type BlogVersion,
} from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useT } from "@/lib/i18n";

/** Published versions; restoring copies one into the draft (publish it again to make it live). */
export function HistoryPanel({
  postId,
  editable,
  onRestored,
}: {
  postId: string;
  editable: boolean;
  onRestored: (post: BlogPostDetail) => void;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<BlogVersion | null>(null);
  const versions = useQuery(blogQueries.versions(postId));
  const restore = useMutation({
    mutationFn: (versionId: string) => restoreBlogVersion(postId, versionId),
    onSuccess: (post) => {
      toast.success(t("تمت استعادة النسخة إلى المسودة.", "Version restored to the draft."));
      setPending(null);
      queryClient.invalidateQueries({ queryKey: blogKeys.versions(postId) });
      onRestored(post);
    },
    onError: (error: unknown) => {
      toast.error(t("فشل في استعادة النسخة", "Failed to restore the version"), error instanceof Error ? error.message : undefined);
    },
  });

  if (versions.isLoading) return <Loading />;
  return (
    <div className="ma-studio-versions">
      <ErrorAlert error={versions.error ?? restore.error} />
      {!versions.data?.length ? (
        <p className="ma-assets__empty">{t("لم يُنشر أي إصدار بعد.", "Nothing published yet.")}</p>
      ) : null}
      <ol>
        {versions.data?.map((version) => (
          <li key={version.version_id}>
            <div>
              <strong>{t(`النسخة ${version.version_number}`, `Version ${version.version_number}`)}</strong>
              <span className="ma-studio-versions__date">{formatDateTime(version.published_at)}</span>
            </div>
            <p className="ma-blog-version__title">{version.title || t("(بدون عنوان)", "(untitled)")}</p>
            {version.note ? <p>{version.note}</p> : null}
            <div className="ma-studio-versions__row">
              <span className="ma-blog-hint">
                {version.summary ? version.summary.slice(0, 120) : t("بدون نبذة", "No summary")}
              </span>
              {editable ? (
                <button type="button" className="ma-sblock__btn" disabled={restore.isPending} onClick={() => setPending(version)}>
                  {t("استعادة إلى المسودة", "Restore to draft")}
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <ConfirmModal
        open={Boolean(pending)}
        onOpenChange={(open) => !open && setPending(null)}
        tone="warning"
        title={t("تأكيد استعادة النسخة", "Confirm version restore")}
        message={t(
          `سيُستبدل محتوى المسودة الحالية بالنسخة ${pending?.version_number ?? ""}. لن يتغير المنشور على الموقع حتى تنشر مرة أخرى.`,
          `The current draft will be replaced with version ${pending?.version_number ?? ""}. The live post does not change until you publish again.`,
        )}
        confirmLabel={t("استعادة", "Restore")}
        loading={restore.isPending}
        onConfirm={() => pending && restore.mutate(pending.version_id)}
      />
    </div>
  );
}
