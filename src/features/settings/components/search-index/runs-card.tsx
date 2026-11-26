import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { isIndexRunActive, searchIndexKeys, searchIndexQueries, type IndexRunResult } from "@/lib/api";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { Alert, Badge, Button, Card, Dl, Empty, ErrorAlert, Loading } from "@/components/ui/kit";
import { Modal } from "@/components/ui/modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { RunStatusBadge } from "./badges";
import { duration, RUN_KIND_LABEL } from "./shared";

const POLL_MS = 4000;

/** Recent index runs (admin, catalog edits, weekly schedule); polls while any run is active. */
export function RunsCard({ openRunId, onOpenRun }: { openRunId: string | null; onOpenRun: (id: string | null) => void }) {
  const t = useT();
  const queryClient = useQueryClient();
  const runs = useQuery({
    ...searchIndexQueries.runs(),
    refetchInterval: (query) => (query.state.data?.some((run) => isIndexRunActive(run.status)) ? POLL_MS : false),
  });
  // When a run finishes, the product states and totals changed: refresh them once.
  const active = new Set((runs.data ?? []).filter((run) => isIndexRunActive(run.status)).map((run) => run.workflow_id));
  const previous = useRef<Set<string>>(new Set());
  useEffect(() => {
    const finished = [...previous.current].some((id) => !active.has(id));
    previous.current = active;
    if (finished) void queryClient.invalidateQueries({ queryKey: searchIndexKeys.all });
  });

  return (
    <Card flush title={t("عمليات الفهرسة", "Index runs")}
      actions={<Button sm icon="refresh" label={t("تحديث", "Refresh")} onClick={() => void runs.refetch()} />}>
      {runs.isLoading ? <Loading /> : null}
      <ErrorAlert error={runs.error} />
      {runs.data && runs.data.length === 0 ? (
        <Empty text={t("لا عمليات بعد.", "No runs yet.")} icon="history" />
      ) : null}
      {runs.data?.length ? (
        <Table data-testid="index-runs">
          <TableHeader>
            <TableRow>
              <TableHead>{t("البدء", "Started")}</TableHead>
              <TableHead>{t("النوع", "Type")}</TableHead>
              <TableHead>{t("المصدر", "Trigger")}</TableHead>
              <TableHead>{t("الحالة", "Status")}</TableHead>
              <TableHead>{t("المدة", "Duration")}</TableHead>
              <TableHead>{t("التفاصيل", "Detail")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.data.map((run) => (
              <TableRow key={run.workflow_id}>
                <TableCell>{formatDateTime(run.started_at)}</TableCell>
                <TableCell>{t(RUN_KIND_LABEL[run.kind].ar, RUN_KIND_LABEL[run.kind].en)}</TableCell>
                <TableCell>
                  {run.scheduled
                    ? <Badge def={{ label: { ar: "مجدول أسبوعياً", en: "Weekly schedule" }, tone: "info" }} />
                    : <span className="ma-cell-sub">{run.workflow_id.startsWith("rag-refresh-admin") ? t("مشرف", "Admin") : t("تعديل/مشرف", "Edit / admin")}</span>}
                </TableCell>
                <TableCell><RunStatusBadge status={run.status} /></TableCell>
                <TableCell className="ma-num">{duration(run.started_at, run.closed_at)}</TableCell>
                <TableCell>
                  <Button sm kind="ghost" icon="eye" label={t("عرض", "View")} onClick={() => onOpenRun(run.workflow_id)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
      <RunDetailModal workflowId={openRunId} onClose={() => onOpenRun(null)} />
    </Card>
  );
}

function RunDetailModal({ workflowId, onClose }: { workflowId: string | null; onClose: () => void }) {
  const t = useT();
  const run = useQuery({
    ...searchIndexQueries.run(workflowId ?? ""),
    enabled: Boolean(workflowId),
    refetchInterval: (query) => (isIndexRunActive(query.state.data?.status) ? 2000 : false),
  });
  const data = run.data;
  const progress = data?.progress;
  const summary: IndexRunResult | null | undefined = data?.result ?? progress?.result;

  return (
    <Modal open={Boolean(workflowId)} onOpenChange={(open) => (!open ? onClose() : undefined)} size="lg"
      title={data ? t(RUN_KIND_LABEL[data.kind].ar, RUN_KIND_LABEL[data.kind].en) : t("عملية الفهرسة", "Index run")}
      description={workflowId ?? undefined}>
      {run.isLoading ? <Loading /> : null}
      <ErrorAlert error={run.error} />
      {data ? (
        <div data-testid="index-run-detail">
          <p><RunStatusBadge status={data.status} /> {formatDateTime(data.started_at)} · {duration(data.started_at, data.closed_at)}</p>
          {progress ? (
            <div>
              <progress max={Math.max(progress.total_batches, 1)} value={progress.result?.batches ?? 0} style={{ width: "100%" }} />
              <p className="ma-cell-sub">
                {t(
                  `الدفعة ${progress.result?.batches ?? 0} من ${progress.total_batches} · ${formatNumber(progress.products)} منتج`,
                  `Batch ${progress.result?.batches ?? 0} of ${progress.total_batches} · ${formatNumber(progress.products)} products`,
                )}
              </p>
            </div>
          ) : null}
          {data.error ? <Alert kind="danger" title={t("فشلت العملية", "The run failed")}>{data.error}</Alert> : null}
          {summary ? (
            <Dl rows={[
              [t("المنتجات", "Products"), formatNumber(summary.products)],
              [t("أجزاء أُعيد تضمينها", "Chunks embedded"), formatNumber(summary.chunks_indexed)],
              [t("أجزاء لم تتغيّر (تُخطّيت)", "Chunks unchanged (skipped)"), formatNumber(summary.chunks_skipped)],
              [t("أجزاء حُذفت", "Chunks removed"), formatNumber(summary.chunks_deleted)],
              [t("منتجات أُزيلت من الفهرس", "Products removed from the index"), formatNumber(summary.soft_deleted_products.length)],
              [t("منتجات بلا محتوى قابل للفهرسة", "Products with nothing to index"), formatNumber(summary.not_indexable.length)],
            ]} />
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}
