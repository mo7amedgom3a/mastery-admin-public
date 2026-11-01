import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getMirrorStatus, refreshMirror, type MirrorRun } from "@/lib/api";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useCan } from "@/lib/permissions";
import { Button, Card, ErrorAlert } from "@/components/ui/kit";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { toast } from "@/components/ui/toast";

const QUERY_KEY = ["settings", "lms-mirror"];
const POLL_MS = 3000;

const STATUS: Record<MirrorRun["status"], { ar: string; en: string; chip: string }> = {
  running: { ar: "جارٍ النسخ", en: "Copying", chip: "cd-chip--off" },
  applying: { ar: "جارٍ تطبيق المزامنة", en: "Applying sync", chip: "cd-chip--off" },
  succeeded: { ar: "اكتمل", en: "Completed", chip: "cd-chip--ok" },
  partial: { ar: "نسخ جزئي", en: "Partial copy", chip: "cd-chip--danger" },
  failed: { ar: "فشل", en: "Failed", chip: "cd-chip--danger" },
};

/** Copies the LMS tables from production into the local mirror, then applies the catalog and learner sync. */
export function MirrorRefreshCard() {
  const t = useT();
  const queryClient = useQueryClient();
  const canManage = useCan("operations.manage");
  const [confirming, setConfirming] = useState(false);
  const status = useQuery({
    queryKey: QUERY_KEY,
    queryFn: getMirrorStatus,
    refetchInterval: (query) => (query.state.data?.running ? POLL_MS : false),
  });
  const refresh = useMutation({
    mutationFn: refreshMirror,
    onSuccess: async () => {
      setConfirming(false);
      toast.success(t("بدأ تحديث النسخة", "Mirror refresh started"));
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (error) => {
      setConfirming(false);
      toast.error(error instanceof Error ? error.message : t("تعذّر بدء التحديث", "Couldn't start the refresh"));
    },
  });
  const data = status.data;
  const last = data?.runs[0];

  return (
    <Card
      title={t("نسخة LMS المحلية", "LMS mirror")}
      actions={
        canManage ? (
          <Button
            sm
            kind="primary"
            label={data?.running ? t("جارٍ التحديث…", "Refreshing…") : t("تحديث من الإنتاج", "Refresh from production")}
            disabled={!data?.enabled || data.running || refresh.isPending}
            onClick={() => setConfirming(true)}
          />
        ) : null
      }
    >
      <div data-testid="mirror-card">
        <ErrorAlert error={status.error} />
        <p>
          {t(
            "ينسخ جداول LMS من الإنتاج (قراءة فقط) ثم يطبّق مزامنة الكتالوج والمتعلمين. الإنتاج لا يتغيّر.",
            "Copies the LMS tables from production (read only), then applies the catalog and learner sync. Production isn't changed.",
          )}
        </p>
        {data && !data.enabled ? (
          <p role="alert" data-testid="mirror-disabled">{t("التحديث غير مفعّل في هذه البيئة.", "Refresh is switched off in this environment.")}</p>
        ) : null}
        {last ? <RunSummary run={last} /> : data ? <p>{t("لم يُنفَّذ أي تحديث بعد.", "No refresh has run yet.")}</p> : null}
      </div>
      <ConfirmModal
        open={confirming}
        onOpenChange={setConfirming}
        tone="primary"
        title={t("تحديث النسخة من الإنتاج؟", "Refresh the mirror from production?")}
        message={t(
          "قد يستغرق عدة دقائق. لا يتغيّر الإنتاج، وتُطبَّق المزامنة على B2C بعد اكتمال النسخ.",
          "This can take several minutes. Production isn't changed, and the sync is applied to B2C once the copy finishes.",
        )}
        confirmLabel={t("بدء التحديث", "Start refresh")}
        loading={refresh.isPending}
        onConfirm={() => refresh.mutate()}
      />
    </Card>
  );
}

function RunSummary({ run }: { run: MirrorRun }) {
  const t = useT();
  const label = STATUS[run.status];
  return (
    <div data-testid="mirror-last-run">
      <p>
        <span className={`cd-chip ${label.chip}`} data-testid="mirror-status">{t(label.ar, label.en)}</span>{" "}
        {formatDateTime(run.started_at)}{run.started_by ? ` · ${run.started_by}` : ""}
      </p>
      <p>
        {t("الجداول", "Tables")}: <span className="ma-num">{formatNumber(run.tables_done)}/{formatNumber(run.tables_total)}</span>
        {" · "}
        {t("الصفوف", "Rows")}: <span className="ma-num">{formatNumber(run.rows_copied)}</span>
        {run.current_table ? ` · ${run.current_table}` : ""}
      </p>
      {run.finished_at ? <p>{t("انتهى", "Finished")}: {formatDateTime(run.finished_at)}</p> : null}
      {run.failed_tables.length ? (
        <p role="alert">
          {t("لم تُطبَّق المزامنة لأن هذه الجداول فشلت", "The sync wasn't applied because these tables failed")}: {run.failed_tables.join("، ")}
        </p>
      ) : null}
    </div>
  );
}
