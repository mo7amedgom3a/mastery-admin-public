import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import {
  approveChangeRequest,
  cancelChangeRequest,
  getEngineDefVersion,
  labAiKeys,
  labAiQueries,
  labEngineKeys,
  labEngineQueries,
  labsKeys,
  labsQueries,
  previewLab,
  rejectChangeRequest,
  type ChangeRequest,
  type QualityCheck,
} from "@/lib/api";
import { useAdminAuth } from "@/lib/auth/store";
import { formatDateTime } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { AppLink } from "@/components/ui/app-link";
import { Alert, Badge, Button, Card, Dl, Empty, ErrorAlert, Field, Loading, PageHead } from "@/components/ui/kit";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";

import { CHANGE_STATUS, changeTargetHref, preview, requesterBadge, structuralDiff, type DiffEntry } from "../ai-model";
import { storefrontUrl } from "../model";
import { QualityReport } from "../components/quality-report";

const KIND_TONE: Record<DiffEntry["kind"], string> = { added: "var(--success)", removed: "var(--danger)", changed: "inherit" };

function DiffList({ title, entries }: { title: string; entries: DiffEntry[] }) {
  const t = useT();
  const [open, setOpen] = useState(entries.length <= 12);
  if (!entries.length) return null;
  return (
    <div style={{ marginBlockEnd: "var(--space-3)" }}>
      <div className="ma-cell-flex" style={{ justifyContent: "space-between", gap: 8 }}>
        <strong><bdi>{title}</bdi></strong>
        <Button sm kind="ghost" label={open ? t("إخفاء", "Hide") : t(`عرض ${entries.length} تغيير`, `Show ${entries.length} change(s)`)} onClick={() => setOpen((value) => !value)} />
      </div>
      {open ? (
        <ul className="ma-list" dir="ltr" style={{ margin: 0, paddingInlineStart: "1.2em", fontSize: 13 }}>
          {entries.map((entry) => (
            <li key={`${entry.kind}${entry.path}`} style={{ marginBlockEnd: 4 }}>
              <span style={{ color: KIND_TONE[entry.kind], fontWeight: 600 }}>{entry.kind}</span> <code>{entry.path || "/"}</code>
              {entry.kind === "changed" && entry.before !== "order" ? (
                <div className="ma-help">
                  <span style={{ textDecoration: "line-through" }}>{preview(entry.before)}</span> → <span>{preview(entry.after)}</span>
                </div>
              ) : null}
              {entry.kind === "added" ? <div className="ma-help">{preview(entry.after)}</div> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Draft vs the version the request builds on, per section and scenario. */
function ChangesCard({ request }: { request: ChangeRequest }) {
  const t = useT();
  const isLab = request.target_type === "lab";
  const base = request.base_version_no;
  const labDraft = useQuery({ ...labsQueries.detail(request.target_id), enabled: isLab });
  const labBase = useQuery({ ...labsQueries.version(request.target_id, base ?? 0), enabled: isLab && !!base });
  const engineDraft = useQuery({ ...labEngineQueries.detail(request.target_id), enabled: !isLab });
  const engineBase = useQuery({
    queryKey: [...labEngineKeys.versions(request.target_id), "full", base],
    queryFn: () => getEngineDefVersion(request.target_id, base ?? 0),
    enabled: !isLab && !!base,
  });

  const sections = useMemo(() => {
    const out: { title: string; entries: DiffEntry[] }[] = [];
    if (isLab && labDraft.data) {
      const published = (labBase.data?.definition ?? {}) as { definition?: unknown };
      const draftScenarios = labDraft.data.scenarios.filter((s) => s.status === "active");
      const baseScenarios = (labBase.data?.scenarios ?? []) as { key: string; content?: unknown }[];
      out.push({ title: t("تعريف المختبر", "Lab definition"), entries: structuralDiff(published.definition, labDraft.data.definition) });
      for (const scenario of draftScenarios) {
        const before = baseScenarios.find((s) => s.key === scenario.key)?.content;
        out.push({ title: t(`سيناريو ${scenario.key}`, `Scenario ${scenario.key}`), entries: structuralDiff(before, scenario.content) });
      }
      for (const removed of baseScenarios.filter((s) => !draftScenarios.some((d) => d.key === s.key))) {
        out.push({ title: t(`سيناريو ${removed.key}`, `Scenario ${removed.key}`), entries: [{ path: "", kind: "removed", before: removed.key }] });
      }
    }
    if (!isLab && engineDraft.data) {
      const published = (engineBase.data?.definition ?? {}) as { definition?: unknown };
      out.push({ title: t("تعريف المحرّك", "Engine definition"), entries: structuralDiff(published.definition, engineDraft.data.definition) });
    }
    return out;
  }, [isLab, labDraft.data, labBase.data, engineDraft.data, engineBase.data, t]);

  const loading = isLab ? labDraft.isLoading || labBase.isLoading : engineDraft.isLoading || engineBase.isLoading;
  const error = labDraft.error ?? labBase.error ?? engineDraft.error ?? engineBase.error;
  const total = sections.reduce((sum, section) => sum + section.entries.length, 0);
  return (
    <Card
      title={base ? t(`التغييرات مقارنة بالإصدار ${base}`, `Changes since v${base}`) : t("المحتوى (أول نشر)", "Content (first release)")}
    >
      {request.status !== "open" ? (
        <p className="ma-help">{t("المقارنة مع المسودة الحالية، وقد تكون تغيّرت بعد هذا الطلب.", "Compared with the current draft, which may have changed since this request.")}</p>
      ) : null}
      {error ? <ErrorAlert error={error} /> : null}
      {loading ? <Loading /> : null}
      {!loading && !error ? (
        total ? sections.map((section) => <DiffList key={section.title} title={section.title} entries={section.entries} />) : (
          <Empty text={t("لا فروق في المحتوى (قد تكون التغييرات في البطاقة فقط).", "No content differences (changes may be card-only).")} />
        )
      ) : null}
    </Card>
  );
}

/** Learning → Practice labs → Review requests → one request: review the draft, then approve or reject. */
export function ChangeRequestPage() {
  const t = useT();
  const { changeRequestId = "" } = useParams();
  const queryClient = useQueryClient();
  const me = useAdminAuth((state) => state.admin?.admin_user_id);
  const canPublish = can("labs.publish");
  const query = useQuery(labAiQueries.change(changeRequestId));
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [note, setNote] = useState("");

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: labAiKeys.all });
    void queryClient.invalidateQueries({ queryKey: labsKeys.all });
    void queryClient.invalidateQueries({ queryKey: labEngineKeys.all });
  };
  const approve = useMutation({
    mutationFn: () => approveChangeRequest(changeRequestId, note.trim() || null),
    onSuccess: (result) => {
      setApproving(false);
      setNote("");
      toast.success(t(`نُشر الإصدار ${result.published_version_no}`, `Published version ${result.published_version_no}`));
      refresh();
    },
    onError: () => refresh(),
  });
  const reject = useMutation({
    mutationFn: () => rejectChangeRequest(changeRequestId, note.trim()),
    onSuccess: () => {
      setRejecting(false);
      setNote("");
      toast.success(t("رُفض الطلب؛ سيقرأ مقدّمه ملاحظتك", "Request rejected; its author will read your note"));
      refresh();
    },
  });
  const cancel = useMutation({
    mutationFn: () => cancelChangeRequest(changeRequestId),
    onSuccess: () => {
      setCancelling(false);
      toast.success(t("أُلغي الطلب", "Request cancelled"));
      refresh();
    },
  });
  const previewDraft = useMutation({
    mutationFn: async () => {
      const detail = await queryClient.fetchQuery(labsQueries.detail(query.data!.target_id));
      return previewLab(query.data!.target_id, detail.scenarios[0]?.key ?? null);
    },
    onSuccess: (result) => window.open(storefrontUrl(result.path), "_blank", "noopener,noreferrer"),
    onError: (error) => toast.error(error instanceof Error ? error.message : String(error)),
  });

  if (query.isLoading) return <Loading />;
  if (query.error || !query.data) return <ErrorAlert error={query.error ?? { message: "Not found" }} />;
  const request = query.data;
  const open = request.status === "open";
  const report = request.check_report as QualityCheck | null | undefined;
  const isLab = request.target_type === "lab";
  const canCancel = open && (canPublish || (request.requested_by != null && request.requested_by === me));

  return (
    <>
      <PageHead
        back={{ href: "/learning/labs/changes", label: t("طلبات المراجعة", "Review requests") }}
        title={request.target_title || request.target_key}
        status={<Badge def={CHANGE_STATUS[request.status]} />}
        sub={isLab ? t("طلب نشر مختبر", "Lab publish request") : t("طلب نشر محرّك", "Engine publish request")}
        actions={
          <span className="ma-cell-flex" style={{ gap: 6, flexWrap: "wrap" }}>
            {isLab ? <Button sm kind="ghost" icon="eye" label={t("معاينة المسودة", "Preview draft")} disabled={previewDraft.isPending} onClick={() => previewDraft.mutate()} /> : null}
            <Button sm kind="ghost" label={t("فتح في الورشة", "Open in Studio")} href={`${changeTargetHref(request)}${isLab ? "/edit" : ""}`} />
            {canCancel ? <Button sm kind="ghost" label={t("إلغاء الطلب", "Cancel request")} onClick={() => setCancelling(true)} /> : null}
            {open && canPublish ? (
              <>
                <Button sm kind="ghost" label={t("رفض", "Reject")} onClick={() => setRejecting(true)} />
                <Button sm kind="primary" icon="check" label={t("اعتماد ونشر", "Approve & publish")} onClick={() => setApproving(true)} />
              </>
            ) : null}
          </span>
        }
      />

      {request.status === "stale" ? (
        <Alert kind="warning" title={t("تغيّرت المسودة بعد هذا الطلب", "The draft changed after this request")}>
          {t("لا يمكن اعتماده. على مقدّم الطلب إعادة الفحص وتقديم طلب جديد.", "It cannot be approved; its author must re-check and request again.")}
        </Alert>
      ) : null}
      {open && !canPublish ? (
        <Alert kind="info" title={t("يعتمده من يملك صلاحية النشر", "Approval needs the publish permission")} />
      ) : null}
      {approve.error ? <ErrorAlert error={approve.error} /> : null}

      <Card title={t("الطلب", "Request")}>
        <p style={{ whiteSpace: "pre-wrap", marginBlockStart: 0 }}>{request.summary}</p>
        <Dl
          rows={[
            [t("الهدف", "Target"), (
              <AppLink key="target" className="ma-link" to={changeTargetHref(request)}>
                {isLab ? t("مختبر", "Lab") : t("محرّك", "Engine")} · <bdi>{request.target_key}</bdi>
              </AppLink>
            )],
            [t("مقدّم الطلب", "Requested by"), (
              <span key="by" className="ma-cell-flex" style={{ gap: 6, flexWrap: "wrap" }}>
                <Badge def={requesterBadge(request)} />
                {request.model ? <span className="ma-help"><bdi>{request.model}</bdi></span> : null}
                {request.requested_by === me ? <span className="ma-help">{t("(أنت)", "(you)")}</span> : null}
              </span>
            )],
            [t("التاريخ", "Requested"), formatDateTime(request.created_at)],
            [t("مراجعة المسودة", "Draft revision"), <span key="revision" className="ma-num">{request.draft_revision}</span>],
            [t("ملاحظات الإصدار", "Changelog"), request.changelog || t("(الملخّص)", "(the summary)")],
            ...(request.decided_at
              ? [[t("القرار", "Decision"), (
                  <span key="decision">
                    {formatDateTime(request.decided_at)}
                    {request.published_version_no ? ` · v${request.published_version_no}` : ""}
                    {request.decision_note ? <div className="ma-help" style={{ whiteSpace: "pre-wrap" }}>{request.decision_note}</div> : null}
                  </span>
                )] as [string, ReactNode]]
              : []),
          ]}
        />
      </Card>

      <Card title={t("فحص الجودة عند تقديم الطلب", "Quality check at request time")}>
        {report && "ok" in report ? <QualityReport report={report} /> : <Empty text={t("لا تقرير محفوظ.", "No stored report.")} />}
      </Card>

      <ChangesCard request={request} />

      <Modal
        open={approving}
        onOpenChange={setApproving}
        title={t("اعتماد ونشر", "Approve & publish")}
        description={t(
          "يُنشر الآن نفس المسودة التي رُوجعت هنا بالضبط. إن تغيّرت منذ الطلب يُرفض الاعتماد ويصبح الطلب قديمًا.",
          "Publishes exactly the draft reviewed here. If it changed since the request, approval is refused and the request goes stale.",
        )}
        footer={
          <>
            <Button kind="ghost" label={t("إلغاء", "Cancel")} onClick={() => setApproving(false)} />
            <Button kind="primary" label={approve.isPending ? t("جارٍ النشر…", "Publishing…") : t("اعتماد ونشر", "Approve & publish")} disabled={approve.isPending} onClick={() => approve.mutate()} />
          </>
        }
      >
        <Field id="approve-note" type="textarea" rows={3} label={t("ملاحظة (اختياري)", "Note (optional)")} value={note} onChange={setNote} />
        {approve.error ? <ErrorAlert error={approve.error} /> : null}
      </Modal>

      <Modal
        open={rejecting}
        onOpenChange={setRejecting}
        title={t("رفض الطلب", "Reject request")}
        description={t(
          "اكتب ما يجب تغييره. عميل الذكاء الاصطناعي يقرأ هذه الملاحظة ويعدّل المسودة ثم يقدّم طلبًا جديدًا.",
          "Say what must change. An AI client reads this note, revises the draft and requests again.",
        )}
        footer={
          <>
            <Button kind="ghost" label={t("إلغاء", "Cancel")} onClick={() => setRejecting(false)} />
            <Button kind="primary" label={reject.isPending ? t("جارٍ الرفض…", "Rejecting…") : t("رفض", "Reject")} disabled={reject.isPending || !note.trim()} onClick={() => reject.mutate()} />
          </>
        }
      >
        <Field id="reject-note" type="textarea" rows={4} required label={t("ما الذي يجب تغييره؟", "What must change?")} value={note} onChange={setNote} />
        {reject.error ? <ErrorAlert error={reject.error} /> : null}
      </Modal>

      <ConfirmModal
        open={cancelling}
        onOpenChange={setCancelling}
        title={t("إلغاء الطلب", "Cancel request")}
        message={t("يُسحب الطلب ولا تتغير المسودة.", "The request is withdrawn; the draft is unchanged.")}
        confirmLabel={t("إلغاء الطلب", "Cancel request")}
        loading={cancel.isPending}
        onConfirm={() => cancel.mutate()}
      />
      {cancel.error ? <ErrorAlert error={cancel.error} /> : null}
    </>
  );
}

export default ChangeRequestPage;
