import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/kit";
import { toast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { getLegacySync, pushLegacySync, type LegacySyncStatus } from "@/lib/api";

const STATUS_LABEL: Record<LegacySyncStatus["sync_status"], { ar: string; en: string; chip: string }> = {
  synced: { ar: "متزامن", en: "Synced", chip: "cd-chip--ok" },
  pending: { ar: "قيد الانتظار", en: "Pending", chip: "cd-chip--off" },
  failed: { ar: "فشل", en: "Failed", chip: "cd-chip--danger" },
  conflict: { ar: "تعارض", en: "Conflict", chip: "cd-chip--danger" },
  needs_mapping: { ar: "يحتاج ربطًا", en: "Needs mapping", chip: "cd-chip--danger" },
  not_synced: { ar: "لم يُزامن", en: "Not synced", chip: "cd-chip--off" },
};

/** Where this course stands against the LMS tables. */
export function LegacySyncCard({ productRef }: { productRef: string }) {
  const t = useT();
  const queryClient = useQueryClient();
  const queryKey = ["legacy-sync", productRef];
  const { data } = useQuery({ queryKey, queryFn: () => getLegacySync(productRef) });
  const push = useMutation({
    mutationFn: () => pushLegacySync(productRef),
    onSuccess: async ({ outcome }) => {
      await queryClient.invalidateQueries({ queryKey });
      if (outcome === "failed") toast.error(t("تعذّرت المزامنة مع LMS", "Couldn't sync with the LMS"));
      else toast.success(t("تمت المزامنة مع LMS", "Synced with the LMS"));
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("تعذّرت المزامنة", "Couldn't sync")),
  });
  if (!data) return null;
  const label = STATUS_LABEL[data.sync_status];
  return (
    <div className="cd-card" data-testid="legacy-sync-card">
      <div className="cd-card__h">
        <h3>{t("المزامنة مع LMS", "LMS sync")}</h3>
        <span className={`cd-chip ${label.chip}`} data-testid="legacy-sync-status">{t(label.ar, label.en)}</span>
      </div>
      <div className="cd-card__b">
        <p data-testid="legacy-sync-id">
          {t("معرّف LMS", "LMS id")}: {data.legacy_id ?? "—"}
        </p>
        {data.last_synced_at ? <p>{t("آخر مزامنة", "Last sync")}: {formatDateTime(data.last_synced_at)}</p> : null}
        {data.last_error ? <p role="alert">{data.last_error}</p> : null}
        {data.legacy_id && data.lms_units === 0 ? (
          <p role="alert" data-testid="legacy-sync-empty">
            {t("لا يوجد محتوى لهذه الدورة في LMS: سيجد المتعلم دورة فارغة.", "This course has no content in the LMS: learners would get an empty course.")}
          </p>
        ) : null}
        {data.legacy_id && data.lms_units && data.lms_videos === 0 ? (
          <p role="alert" data-testid="legacy-sync-no-video">
            {t("لا توجد فيديوهات مرتبطة ببنك ملفات LMS: قد لا تعمل الدروس هناك.", "No lesson is tied to an LMS file bank video: lessons may not play there.")}
          </p>
        ) : null}
        <Button sm label={t("مزامنة الآن", "Sync now")} disabled={push.isPending} onClick={() => push.mutate()} />
      </div>
    </div>
  );
}
