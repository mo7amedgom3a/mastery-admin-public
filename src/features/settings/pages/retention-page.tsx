/* oxlint-disable react/set-state-in-effect -- the row form resets when the server view is refetched after a save. */
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  isRetentionRunFinished,
  previewRetention,
  queueRetentionRun,
  retentionKeys,
  retentionQueries,
  updateRetentionPolicy,
  type RetentionEngineInfo,
  type RetentionPolicy,
  type RetentionPreviewResponse,
  type RetentionRun,
  type RetentionRunDetail,
  type RetentionRunStatus,
} from "@/lib/api";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useCan } from "@/lib/permissions";
import { Alert, Badge, Button, Card, Empty, ErrorAlert, Kpi, Loading, PageHead } from "@/components/ui/kit";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Modal } from "@/components/ui/modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/toast";

const EMPTY_POLICIES: RetentionPolicy[] = [];

const STATUS_LABEL: Record<RetentionRunStatus, { ar: string; en: string }> = {
  queued: { ar: "في الانتظار", en: "Queued" },
  running: { ar: "قيد التنفيذ", en: "Running" },
  succeeded: { ar: "نجح", en: "Succeeded" },
  partial: { ar: "جزئي", en: "Partial" },
  failed: { ar: "فشل", en: "Failed" },
  skipped: { ar: "متخطّى", en: "Skipped" },
};

const STATUS_TONE: Record<RetentionRunStatus, "success" | "warning" | "danger" | "info" | "neutral"> = {
  queued: "info",
  running: "info",
  succeeded: "success",
  partial: "warning",
  failed: "danger",
  skipped: "neutral",
};

function statusBadge(status: RetentionRunStatus) {
  return <Badge def={{ label: STATUS_LABEL[status], tone: STATUS_TONE[status] }} />;
}

function runDuration(run: RetentionRun): string {
  if (!run.started_at || !run.finished_at) return "—";
  const ms = new Date(run.finished_at).getTime() - new Date(run.started_at).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  return ms < 1000 ? `${ms} ms` : `${Math.round(ms / 1000)} s`;
}

function eligibleLabel(eligible: number, capped: boolean): string {
  const value = formatNumber(eligible);
  return capped ? `${value}+` : value;
}

export default function RetentionPage() {
  const t = useT();
  const queryClient = useQueryClient();
  const canManage = useCan("retention.write");
  const policies = useQuery(retentionQueries.policies());
  const runs = useQuery(retentionQueries.runs({ limit: 20 }));

  const [preview, setPreview] = useState<RetentionPreviewResponse | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [runOpen, setRunOpen] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [detailRunId, setDetailRunId] = useState<string | null>(null);
  const invalidatedRun = useRef<string | null>(null);

  const previewMutation = useMutation({
    mutationFn: (categoryKeys?: string[]) => previewRetention(categoryKeys),
    onSuccess: (data) => {
      setPreview(data);
      setPreviewOpen(true);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t("تعذّر حساب الصفوف المؤهلة", "Couldn't count eligible rows")),
  });

  const activeRun = useQuery({
    ...retentionQueries.run(activeRunId ?? ""),
    enabled: Boolean(activeRunId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && isRetentionRunFinished(status) ? false : 2000;
    },
  });

  const detailRun = useQuery({
    ...retentionQueries.run(detailRunId ?? ""),
    enabled: Boolean(detailRunId),
  });

  useEffect(() => {
    const run = activeRun.data;
    if (!run || !isRetentionRunFinished(run.status) || invalidatedRun.current === run.run_id) return;
    invalidatedRun.current = run.run_id;
    void queryClient.invalidateQueries({ queryKey: retentionKeys.all });
  }, [activeRun.data, queryClient]);

  const items = policies.data?.items ?? EMPTY_POLICIES;
  const engine = policies.data?.engine;
  const newest = runs.data?.items[0];
  const enabledCount = items.filter((item) => item.is_enabled).length;

  return (
    <>
      <PageHead
        title={t("الاحتفاظ بالبيانات", "Data retention")}
        sub={t(
          "مدة الاحتفاظ لكل فئة من السجلات عالية الحجم، ومعاينة الصفوف المؤهلة وتشغيل التنظيف.",
          "Per-category retention for high-volume records, eligible-row previews and cleanup runs.",
        )}
        actions={
          <>
            <Button
              sm
              icon="refresh"
              label={t("تحديث", "Refresh")}
              onClick={() => {
                void policies.refetch();
                void runs.refetch();
              }}
            />
            <Button
              sm
              kind="secondary"
              icon="eye"
              label={t("معاينة المؤهل", "Preview eligible")}
              disabled={previewMutation.isPending || items.length === 0}
              onClick={() => previewMutation.mutate(undefined)}
            />
            {canManage ? (
              <Button
                sm
                kind="primary"
                icon="play"
                label={t("تشغيل التنظيف", "Run cleanup")}
                disabled={items.length === 0}
                onClick={() => setRunOpen(true)}
              />
            ) : null}
          </>
        }
      />

      <Alert kind="warning" title={t("الحذف نهائي", "Deletion is permanent")}>
        {t(
          "الصفوف المحذوفة لا يمكن استرجاعها من قاعدة البيانات. قد تبقى نسخ في النسخ الاحتياطية وخدمة السجلات حسب سياساتها. تحليلات السلوك الأقدم من نافذة الاحتفاظ ستظهر فارغة.",
          "Deleted rows cannot be recovered from the database. Copies may remain in backups and the logging stack per their own policies. Behavior analytics older than the retention window will read empty.",
        )}
      </Alert>

      {policies.isLoading ? <Loading /> : null}
      {policies.error ? <ErrorAlert error={policies.error} /> : null}

      {engine ? <EngineKpis engine={engine} items={items} newest={newest} /> : null}

      <Card
        flush
        title={t("سياسات الاحتفاظ", "Retention policies")}
        actions={
          <span className="ma-cell-sub">
            {t(
              `${enabledCount} من ${items.length} مفعّلة`,
              `${enabledCount} of ${items.length} enabled`,
            )}
          </span>
        }
      >
        {policies.data && items.length === 0 ? (
          <Empty text={t("لا فئات احتفاظ.", "No retention categories.")} icon="inbox" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("الفئة", "Category")}</TableHead>
                <TableHead>{t("الجدول", "Table")}</TableHead>
                <TableHead>{t("المدة (أيام)", "Period (days)")}</TableHead>
                <TableHead>{t("مفعّلة", "Enabled")}</TableHead>
                <TableHead>{t("آخر تشغيل", "Last run")}</TableHead>
                <TableHead>{t("الإجراءات", "Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((policy) => (
                <PolicyRow
                  key={policy.category_key}
                  policy={policy}
                  canManage={canManage}
                  previewing={previewMutation.isPending}
                  onPreview={() => previewMutation.mutate([policy.category_key])}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {activeRunId ? (
        <RunStatusCard
          run={activeRun.data}
          loading={activeRun.isLoading}
          error={activeRun.error}
          onClose={() => setActiveRunId(null)}
          onOpenDetail={() => setDetailRunId(activeRunId)}
        />
      ) : null}

      <Card flush title={t("سجل التشغيل", "Run history")}>
        {runs.isLoading ? <Loading /> : null}
        {runs.error ? <ErrorAlert error={runs.error} /> : null}
        {runs.data && runs.data.items.length === 0 ? (
          <Empty text={t("لا عمليات تشغيل بعد.", "No runs yet.")} icon="history" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("الوقت", "When")}</TableHead>
                <TableHead>{t("المصدر", "Trigger")}</TableHead>
                <TableHead>{t("النوع", "Mode")}</TableHead>
                <TableHead>{t("الحالة", "Status")}</TableHead>
                <TableHead>{t("المحذوف", "Deleted")}</TableHead>
                <TableHead>{t("المدة", "Duration")}</TableHead>
                <TableHead>{t("التفاصيل", "Detail")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(runs.data?.items ?? []).map((run) => (
                <TableRow key={run.run_id}>
                  <TableCell>{formatDateTime(run.finished_at ?? run.created_at)}</TableCell>
                  <TableCell>{t(run.trigger_source === "admin" ? "مشرف" : run.trigger_source === "cli" ? "سطر الأوامر" : "مجدول", run.trigger_source)}</TableCell>
                  <TableCell>
                    {run.dry_run ? (
                      <Badge def={{ label: { ar: "تجريبي", en: "Dry run" }, tone: "info" }} />
                    ) : (
                      <Badge def={{ label: { ar: "حقيقي", en: "Live" }, tone: "neutral" }} />
                    )}
                  </TableCell>
                  <TableCell>{statusBadge(run.status)}</TableCell>
                  <TableCell align="right">{formatNumber(run.total_deleted)}</TableCell>
                  <TableCell>{runDuration(run)}</TableCell>
                  <TableCell>
                    <Button
                      sm
                      kind="ghost"
                      icon="eye"
                      label={t("عرض", "View")}
                      onClick={() => setDetailRunId(run.run_id)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <PreviewModal
        open={previewOpen}
        data={preview}
        onOpenChange={setPreviewOpen}
      />

      <RunModal
        open={runOpen}
        policies={items}
        onOpenChange={setRunOpen}
        onQueued={(runId) => {
          invalidatedRun.current = null;
          setActiveRunId(runId);
          void runs.refetch();
        }}
      />

      <RunDetailModal
        open={Boolean(detailRunId)}
        run={detailRun.data}
        loading={detailRun.isLoading}
        error={detailRun.error}
        onOpenChange={(open) => {
          if (!open) setDetailRunId(null);
        }}
      />
    </>
  );
}

function EngineKpis({
  engine,
  items,
  newest,
}: {
  engine: RetentionEngineInfo;
  items: RetentionPolicy[];
  newest?: RetentionRun;
}) {
  const t = useT();
  return (
    <div className="ma-kpis">
      <Kpi
        icon="shield"
        label={t("محرّك الاحتفاظ", "Retention engine")}
        value={engine.enabled ? t("مفعّل", "Enabled") : t("معطّل", "Disabled")}
        meta={t(
          `تشغيل كل ${Math.round(engine.worker_interval_seconds / 60)} دقيقة`,
          `runs every ${Math.round(engine.worker_interval_seconds / 60)} min`,
        )}
      />
      <Kpi
        icon="layers"
        label={t("الفئات المفعّلة", "Enabled categories")}
        value={`${items.filter((item) => item.is_enabled).length} / ${items.length}`}
        meta={t("قابلة للحذف تلقائياً", "eligible for automatic cleanup")}
      />
      <Kpi
        icon="history"
        label={t("آخر تشغيل", "Last run")}
        value={newest ? t(STATUS_LABEL[newest.status].ar, STATUS_LABEL[newest.status].en) : "—"}
        meta={newest ? formatDateTime(newest.finished_at ?? newest.created_at) : t("لم يبدأ بعد", "not run yet")}
      />
      <Kpi
        icon="trash"
        label={t("محذوف في آخر تشغيل", "Deleted last run")}
        value={newest ? formatNumber(newest.total_deleted) : "—"}
        meta={newest?.dry_run ? t("تشغيل تجريبي", "dry run") : undefined}
      />
    </div>
  );
}

function PolicyRow({
  policy,
  canManage,
  previewing,
  onPreview,
}: {
  policy: RetentionPolicy;
  canManage: boolean;
  previewing: boolean;
  onPreview: () => void;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const [days, setDays] = useState(String(policy.retention_days));
  const [enabled, setEnabled] = useState(policy.is_enabled);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    setDays(String(policy.retention_days));
    setEnabled(policy.is_enabled);
  }, [policy.retention_days, policy.is_enabled]);

  const parsed = Number(days);
  const valid = Number.isInteger(parsed) && parsed >= policy.min_days && parsed <= policy.max_days;
  const dirty = parsed !== policy.retention_days || enabled !== policy.is_enabled;

  const save = useMutation({
    mutationFn: (acknowledgeProtected: boolean) =>
      updateRetentionPolicy(policy.category_key, {
        retention_days: parsed,
        is_enabled: enabled,
        acknowledge_protected: acknowledgeProtected,
      }),
    onSuccess: async () => {
      setConfirmOpen(false);
      toast.success(t("تم حفظ سياسة الاحتفاظ", "Retention policy saved"));
      await queryClient.invalidateQueries({ queryKey: retentionKeys.all });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t("تعذّر حفظ السياسة", "Couldn't save the policy")),
  });

  const requestSave = () => {
    if (!canManage || !dirty || !valid) return;
    if (enabled && !policy.is_enabled && policy.protected) {
      setConfirmOpen(true);
      return;
    }
    save.mutate(false);
  };

  return (
    <TableRow>
      <TableCell>
        <div className="ma-stack">
          <b>{t(policy.label.ar, policy.label.en)}</b>
          <span className="ma-cell-sub">
            {t(policy.description.ar, policy.description.en)}
          </span>
          {policy.protected ? (
            <Badge def={{ label: { ar: "سجل امتثال محمي", en: "Protected compliance trail" }, tone: "warning" }} />
          ) : null}
        </div>
      </TableCell>
      <TableCell>
        <bdi className="ma-num ma-cell-sub">{policy.table}</bdi>
      </TableCell>
      <TableCell>
        <input
          className="ma-input"
          type="number"
          min={policy.min_days}
          max={policy.max_days}
          value={days}
          disabled={!canManage}
          style={{ maxWidth: 110 }}
          aria-invalid={!valid}
          aria-label={t(`مدة الاحتفاظ لـ ${policy.label.ar}`, `Retention days for ${policy.label.en}`)}
          onChange={(event) => setDays(event.target.value)}
        />
        <div className="ma-cell-sub">
          {t(`من ${policy.min_days} إلى ${policy.max_days}`, `${policy.min_days}–${policy.max_days}`)}
        </div>
      </TableCell>
      <TableCell>
        <Checkbox
          checked={enabled}
          disabled={!canManage}
          aria-label={t(`تفعيل ${policy.label.ar}`, `Enable ${policy.label.en}`)}
          onCheckedChange={(checked) => setEnabled(checked === true)}
        />
      </TableCell>
      <TableCell>
        {policy.last_run_at ? (
          <div className="ma-stack">
            <span>{formatDateTime(policy.last_run_at)}</span>
            <span className="ma-cell-sub">
              {t(
                `${formatNumber(policy.last_deleted_count ?? 0)} صف · ${policy.last_status ?? ""}`,
                `${formatNumber(policy.last_deleted_count ?? 0)} rows · ${policy.last_status ?? ""}`,
              )}
            </span>
          </div>
        ) : (
          <span className="ma-cell-sub">{t("لم يُشغّل", "Never")}</span>
        )}
      </TableCell>
      <TableCell>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Button
            sm
            kind="ghost"
            icon="eye"
            label={t("معاينة", "Preview")}
            disabled={previewing}
            onClick={onPreview}
          />
          {canManage ? (
            <Button
              sm
              kind="primary"
              icon="check"
              label={t("حفظ", "Save")}
              disabled={!dirty || !valid || save.isPending}
              onClick={requestSave}
            />
          ) : null}
        </div>
        {!valid ? (
          <div className="ma-cell-sub" role="alert">
            {t("أدخل عدداً صحيحاً داخل الحدود.", "Enter a whole number inside the bounds.")}
          </div>
        ) : null}
        <ConfirmModal
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          tone="danger"
          title={t("تفعيل حذف سجل امتثال؟", "Enable deletion of a compliance trail?")}
          message={t(
            "هذا السجل حساس للامتثال. سيُحذف نهائياً بعد المدة المحددة. فعّله فقط بعد موافقة قانونية/امتثال صريحة.",
            "This trail is compliance-sensitive. Rows will be permanently deleted after the configured period. Enable it only after explicit legal/compliance approval.",
          )}
          confirmLabel={t("نعم، فعّل الحذف", "Yes, enable deletion")}
          cancelLabel={t("إلغاء", "Cancel")}
          loading={save.isPending}
          onConfirm={() => save.mutate(true)}
        />
      </TableCell>
    </TableRow>
  );
}

function PreviewModal({
  open,
  data,
  onOpenChange,
}: {
  open: boolean;
  data: RetentionPreviewResponse | null;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t("الصفوف المؤهلة للحذف", "Rows eligible for deletion")}
      description={t(
        "عدد الصفوف التي ستُحذف الآن لكل فئة. القيم المعلّمة بـ + تعني أن العدد الفعلي أكبر من الحد المعروض.",
        "Rows that would be deleted now per category. A + means the real count is above the display cap.",
      )}
      size="lg"
    >
      {!data ? (
        <Loading />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("الفئة", "Category")}</TableHead>
              <TableHead>{t("المدة", "Period")}</TableHead>
              <TableHead>{t("يُحذف قبل", "Cutoff")}</TableHead>
              <TableHead align="right">{t("الصفوف", "Rows")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((item) => (
              <TableRow key={item.category_key}>
                <TableCell>
                  <b>{t(item.label.ar, item.label.en)}</b>
                  {!item.is_enabled ? (
                    <Badge def={{ label: { ar: "معطّلة", en: "Disabled" }, tone: "neutral" }} />
                  ) : null}
                </TableCell>
                <TableCell>{t(`${item.retention_days} يوم`, `${item.retention_days} days`)}</TableCell>
                <TableCell>{formatDateTime(item.cutoff_at)}</TableCell>
                <TableCell align="right">{eligibleLabel(item.eligible_rows, item.capped)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Modal>
  );
}

function RunModal({
  open,
  policies,
  onOpenChange,
  onQueued,
}: {
  open: boolean;
  policies: RetentionPolicy[];
  onOpenChange: (open: boolean) => void;
  onQueued: (runId: string) => void;
}) {
  const t = useT();
  const enabledKeys = policies.filter((policy) => policy.is_enabled).map((policy) => policy.category_key);
  const [selected, setSelected] = useState<string[]>(enabledKeys);
  const [dryRun, setDryRun] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(policies.filter((policy) => policy.is_enabled).map((policy) => policy.category_key));
    setDryRun(false);
  }, [open, policies]);

  const queue = useMutation({
    mutationFn: () => queueRetentionRun({ category_keys: selected, dry_run: dryRun }),
    onSuccess: (result) => {
      toast.info(
        t("تم إرسال طلب التنظيف إلى العامل", "Cleanup queued for the worker"),
        t(`المعرّف ${result.run_id.slice(0, 8)}`, `Run ${result.run_id.slice(0, 8)}`),
      );
      onQueued(result.run_id);
      onOpenChange(false);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t("تعذّر بدء التنظيف", "Couldn't queue the cleanup")),
  });

  const toggle = (key: string) =>
    setSelected((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t("تشغيل التنظيف الآن", "Run cleanup now")}
      description={t(
        "يُنفّذ العامل الطلب في الخلفية ضمن دفعات صغيرة، ويمكن متابعة النتيجة من السجل.",
        "The worker executes the request in small batches; progress appears in the run history.",
      )}
      size="lg"
      footer={
        <>
          <Button kind="ghost" label={t("إلغاء", "Cancel")} onClick={() => onOpenChange(false)} />
          <Button
            kind="primary"
            icon="play"
            label={dryRun ? t("تشغيل تجريبي", "Run dry run") : t("بدء التنظيف", "Start cleanup")}
            disabled={queue.isPending || selected.length === 0}
            onClick={() => queue.mutate()}
          />
        </>
      }
    >
      <label htmlFor="retention-dry-run" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Checkbox
          id="retention-dry-run"
          checked={dryRun}
          onCheckedChange={(checked) => setDryRun(checked === true)}
        />
        <span>
          {t(
            "تشغيل تجريبي: احسب الصفوف دون حذفها",
            "Dry run: count rows without deleting",
          )}
        </span>
      </label>
      <div className="ma-field">
        <span className="ma-label">{t("الفئات", "Categories")}</span>
        {enabledKeys.length === 0 ? (
          <p className="ma-help">{t("لا فئات مفعّلة. فعّل فئة أولاً.", "No enabled categories. Enable one first.")}</p>
        ) : (
          <div className="ma-checkgroup">
            {policies.map((policy) => (
              <label
                key={policy.category_key}
                htmlFor={`retention-category-${policy.category_key}`}
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                <Checkbox
                  id={`retention-category-${policy.category_key}`}
                  checked={selected.includes(policy.category_key)}
                  disabled={!policy.is_enabled}
                  onCheckedChange={() => toggle(policy.category_key)}
                />
                <span>
                  {t(policy.label.ar, policy.label.en)}
                  {!policy.is_enabled ? ` (${t("معطّلة", "disabled")})` : ""}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

function RunStatusCard({
  run,
  loading,
  error,
  onClose,
  onOpenDetail,
}: {
  run: RetentionRunDetail | undefined;
  loading: boolean;
  error: unknown;
  onClose: () => void;
  onOpenDetail: () => void;
}) {
  const t = useT();
  return (
    <Card
      title={t("حالة التشغيل", "Run status")}
      actions={
        <>
          <Button sm kind="ghost" icon="eye" label={t("التفاصيل", "Details")} onClick={onOpenDetail} />
          <Button sm kind="ghost" icon="x" label={t("إغلاق", "Dismiss")} onClick={onClose} />
        </>
      }
    >
      {loading && !run ? <Loading /> : null}
      {error ? <ErrorAlert error={error} /> : null}
      {run ? (
        <div className="ma-stack">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {statusBadge(run.status)}
            {run.dry_run ? (
              <Badge def={{ label: { ar: "تجريبي", en: "Dry run" }, tone: "info" }} />
            ) : null}
            <span className="ma-cell-sub">
              {t(
                `${formatNumber(run.total_deleted)} صف · ${runDuration(run)}`,
                `${formatNumber(run.total_deleted)} rows · ${runDuration(run)}`,
              )}
            </span>
          </div>
          {run.status === "queued" ? (
            <span className="ma-cell-sub">
              {t("في انتظار العامل…", "Waiting for the worker…")}
            </span>
          ) : null}
          {run.error ? <ErrorAlert error={run.error} /> : null}
        </div>
      ) : null}
    </Card>
  );
}

function RunDetailModal({
  open,
  run,
  loading,
  error,
  onOpenChange,
}: {
  open: boolean;
  run: RetentionRunDetail | undefined;
  loading: boolean;
  error: unknown;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t("تفاصيل التشغيل", "Run detail")}
      description={
        run
          ? `${formatDateTime(run.started_at ?? run.created_at)} · ${run.trigger_source} · ${
              run.dry_run ? t("تجريبي", "dry run") : t("حقيقي", "live")
            }`
          : undefined
      }
      size="lg"
    >
      {loading && !run ? <Loading /> : null}
      {error ? <ErrorAlert error={error} /> : null}
      {run ? (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
            {statusBadge(run.status)}
            <span className="ma-cell-sub">
              {t(
                `${formatNumber(run.total_deleted)} صف إجمالاً`,
                `${formatNumber(run.total_deleted)} rows total`,
              )}
            </span>
          </div>
          {run.error ? <ErrorAlert error={run.error} /> : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("الفئة", "Category")}</TableHead>
                <TableHead>{t("الحالة", "Status")}</TableHead>
                <TableHead>{t("يُحذف قبل", "Cutoff")}</TableHead>
                <TableHead align="right">{t("الصفوف", "Rows")}</TableHead>
                <TableHead>{t("المدة", "Duration")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {run.items.map((item, index) => (
                <TableRow key={`${item.category_key}-${index}`}>
                  <TableCell>{t(item.label.ar, item.label.en)}</TableCell>
                  <TableCell>
                    {item.status === "succeeded"
                      ? statusBadge("succeeded")
                      : item.status === "failed"
                        ? statusBadge("failed")
                        : statusBadge("skipped")}
                    {item.truncated ? (
                      <Badge def={{ label: { ar: "مقتطع", en: "Truncated" }, tone: "warning" }} />
                    ) : null}
                  </TableCell>
                  <TableCell>{formatDateTime(item.cutoff_at)}</TableCell>
                  <TableCell align="right">{formatNumber(item.deleted_count)}</TableCell>
                  <TableCell>{item.duration_ms == null ? "—" : `${item.duration_ms} ms`}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {run.items.some((item) => item.error) ? (
            <div className="ma-stack" style={{ marginTop: 12 }}>
              {run.items
                .filter((item) => item.error)
                .map((item) => (
                  <span key={`${item.category_key}-error`} className="ma-cell-sub">
                    <b>{t(item.label.ar, item.label.en)}:</b> {item.error}
                  </span>
                ))}
            </div>
          ) : null}
        </>
      ) : null}
    </Modal>
  );
}
