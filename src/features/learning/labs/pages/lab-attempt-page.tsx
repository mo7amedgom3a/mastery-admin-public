import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import {
  flagAttempt,
  labsKeys,
  labsQueries,
  overrideAttemptScore,
  voidAttempt,
  type LabAttempt,
} from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { Alert, Badge, Button, Card, Dl, ErrorAlert, Field, Kpi, Loading, PageHead } from "@/components/ui/kit";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";

import { ATTEMPT_STATUS, READINESS } from "../model";

export function LabAttemptPage() {
  const { labId = "", attemptId = "" } = useParams();
  const query = useQuery(labsQueries.attempt(attemptId));
  if (query.error) return <ErrorAlert error={query.error} />;
  if (!query.data) return <Loading />;
  return <AttemptBody labId={labId} attempt={query.data} />;
}

function AttemptBody({ labId, attempt }: { labId: string; attempt: LabAttempt }) {
  const t = useT();
  const queryClient = useQueryClient();
  const canReview = can("labs.analytics");
  const [flagging, setFlagging] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [overriding, setOverriding] = useState(false);
  const [reason, setReason] = useState("");
  const [override, setOverride] = useState(String(attempt.overall));

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: labsKeys.attempt(attempt.attempt_id) });
    void queryClient.invalidateQueries({ queryKey: labsKeys.attempts(labId) });
    void queryClient.invalidateQueries({ queryKey: labsKeys.detail(labId) });
  };

  const flag = useMutation({
    mutationFn: () => flagAttempt(attempt.attempt_id, reason.trim()),
    onSuccess: () => {
      setFlagging(false);
      setReason("");
      toast.success(t("وُسمت المحاولة", "Attempt flagged"));
      refresh();
    },
  });
  const voided = useMutation({
    mutationFn: () => voidAttempt(attempt.attempt_id, reason.trim()),
    onSuccess: () => {
      setVoiding(false);
      setReason("");
      toast.success(t("أُلغيت المحاولة", "Attempt voided"));
      refresh();
    },
  });
  const changeScore = useMutation({
    mutationFn: () => overrideAttemptScore(attempt.attempt_id, Number(override), reason.trim()),
    onSuccess: () => {
      setOverriding(false);
      setReason("");
      toast.success(t("عُدّلت النتيجة وسُجّلت في التدقيق", "Score overridden and audited"));
      refresh();
    },
  });

  const dimensions = attempt.dimensions ?? [];
  const highlights = attempt.highlights ?? [];
  const signals = Object.entries(attempt.signals ?? {});

  return (
    <>
      <PageHead
        back={{ href: `/learning/labs/${labId}/attempts`, label: t("المحاولات", "Attempts") }}
        title={t(`محاولة #${attempt.attempt_no}`, `Attempt #${attempt.attempt_no}`)}
        status={<Badge def={ATTEMPT_STATUS[attempt.status]} />}
        sub={
          <span>
            {attempt.lab_title} · <bdi>{attempt.slug}</bdi> · {attempt.scenario_key} · {formatDateTime(attempt.at)}
          </span>
        }
        actions={
          canReview ? (
            <>
              <Button sm kind="ghost" label={t("وسم", "Flag")} onClick={() => setFlagging(true)} />
              <Button sm kind="ghost" label={t("إلغاء المحاولة", "Void")} onClick={() => setVoiding(true)} />
              <Button sm kind="soft" label={t("تعديل النتيجة", "Override score")} onClick={() => setOverriding(true)} />
            </>
          ) : undefined
        }
      />

      {!attempt.verified ? (
        <Alert kind="warning" title={t("محاولة غير موثّقة", "Unverified attempt")}>
          {t(
            "قيّمها العميل لأن محرّكها لم يُنقل بعد إلى الخادم. لا تُحتسب للشهادات أو تقارير الشركات.",
            "Scored by the client because its engine is not ported to the server yet. It does not count for certificates or company reports.",
          )}
        </Alert>
      ) : null}

      <div className="ma-kpis">
        <Kpi label={t("النتيجة", "Score")} value={String(attempt.overall)} icon="star" />
        <Kpi label={t("الجاهزية", "Readiness")} value={t(READINESS[attempt.readiness]?.label.ar ?? attempt.readiness, READINESS[attempt.readiness]?.label.en ?? attempt.readiness)} icon="check" />
        <Kpi label="XP" value={String(attempt.xp)} icon="zap" />
        <Kpi label={t("المدة", "Duration")} value={`${Math.round(attempt.duration_seconds / 60) || 1} ${t("دقيقة", "min")}`} icon="history" />
        <Kpi label={t("نتيجة العميل", "Client score")} value={attempt.client_overall == null ? "—" : String(attempt.client_overall)} icon="eye" />
      </div>

      <div className="ma-cols ma-cols--main-side">
        <div>
          <Card title={t("الأبعاد", "Dimensions")}>
            {dimensions.length ? (
              <div className="ma-list">
                {dimensions.map((dimension) => {
                  const score = Number(dimension.score ?? 0);
                  return (
                    <div key={String(dimension.key)} style={{ marginBlockEnd: "var(--space-3)" }}>
                      <div className="ma-cell-flex" style={{ justifyContent: "space-between" }}>
                        <strong>{String(dimension.label ?? dimension.key)}</strong>
                        <span className="ma-num">
                          {score} / 100 · {t(`وزن ${dimension.weight ?? 1}`, `weight ${dimension.weight ?? 1}`)}
                        </span>
                      </div>
                      <div className="ma-bar__track" style={{ marginBlockStart: 4 }}>
                        <div className="ma-bar__fill" style={{ width: `${Math.max(2, Math.min(100, score))}%`, background: "var(--accent)" }} />
                      </div>
                      {dimension.skill ? <span className="ma-help">{String(dimension.skill)}</span> : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="ma-help">{t("لا أبعاد في بطاقة النتيجة.", "No dimensions in the scorecard.")}</p>
            )}
          </Card>

          <Card title={t("الملاحظات", "Highlights")}>
            {highlights.length ? (
              <ul style={{ margin: 0, paddingInlineStart: "1.2em" }}>
                {highlights.map((highlight, index) => (
                  <li key={index}>
                    <strong>{String(highlight.title ?? highlight.key ?? "")}</strong>
                    {highlight.text ? ` — ${String(highlight.text)}` : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ma-help">{t("لا ملاحظات.", "No highlights.")}</p>
            )}
          </Card>

          <Card title={t("الأحداث المكثّفة", "Compacted actions")}>
            {attempt.actions?.length ? (
              <textarea className="ma-input ma-textarea" rows={12} dir="ltr" readOnly value={JSON.stringify(attempt.actions, null, 2)} />
            ) : (
              <p className="ma-help">
                {t(
                  "لم تُحمَّل الأحداث (تُحذف بعد التكثيف) أو أن المحاولة من محرّك قديم بلا أحداث.",
                  "Actions are not loaded (purged after compaction) or the attempt came from a legacy engine without actions.",
                )}
              </p>
            )}
          </Card>
        </div>

        <div>
          <Card title={t("البيانات", "Details")}>
            <Dl
              rows={[
                [t("الحالة", "Status"), t(ATTEMPT_STATUS[attempt.status].label.ar, ATTEMPT_STATUS[attempt.status].label.en)],
                [t("المحرّك", "Scorer"), attempt.scorer],
                [t("موثّقة", "Verified"), attempt.verified ? t("نعم", "Yes") : t("لا", "No")],
                [t("الإصدار", "Lab version"), `v${attempt.lab_version}`],
                [t("المصدر", "Source"), attempt.source],
                [t("المتعلّم", "Learner"), attempt.customer_id ?? (attempt.anonymous_id ? `anon:${attempt.anonymous_id}` : "—")],
                [t("الجلسة", "Session"), <bdi key="session">{attempt.session_id}</bdi>],
                [t("النتيجة الأصلية", "Original score"), attempt.original_overall == null ? "—" : String(attempt.original_overall)],
                [t("سبب التعديل", "Override reason"), attempt.override_reason ?? "—"],
                [t("سبب الوسم", "Flag reason"), attempt.flag_reason ?? "—"],
              ]}
            />
          </Card>
          <Card title={t("الإشارات", "Signals")}>
            {signals.length ? (
              <ul style={{ margin: 0, paddingInlineStart: "1.2em" }}>
                {signals.map(([key, value]) => (
                  <li key={key}>
                    <bdi>{key}</bdi>: {value ? t("تحققت", "met") : t("لم تتحقق", "not met")}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ma-help">{t("لا إشارات.", "No signals.")}</p>
            )}
          </Card>
        </div>
      </div>

      <Modal
        open={flagging || voiding || overriding}
        onOpenChange={(open) => {
          if (!open) {
            setFlagging(false);
            setVoiding(false);
            setOverriding(false);
          }
        }}
        title={
          flagging
            ? t("وسم المحاولة", "Flag attempt")
            : voiding
              ? t("إلغاء المحاولة", "Void attempt")
              : t("تعديل النتيجة", "Override score")
        }
        description={
          overriding
            ? t("تُحفظ النتيجة الأصلية ويُسجَّل السبب في سجل التدقيق.", "The original score is kept and the reason is audited.")
            : t("يُسجَّل السبب مع المحاولة وفي سجل التدقيق.", "The reason is stored on the attempt and in the audit log.")
        }
        footer={
          <>
            <Button
              kind="ghost"
              label={t("إغلاق", "Close")}
              onClick={() => {
                setFlagging(false);
                setVoiding(false);
                setOverriding(false);
              }}
            />
            {overriding ? <Field id="ovr-score" label={t("النتيجة", "Score")} type="number" value={override} onChange={setOverride} /> : null}
            <Button
              kind="primary"
              label={
                flag.isPending || voided.isPending || changeScore.isPending
                  ? t("جارٍ التنفيذ…", "Working…")
                  : t("تأكيد", "Confirm")
              }
              disabled={reason.trim().length < 3 || flag.isPending || voided.isPending || changeScore.isPending}
              onClick={() => {
                if (flagging) flag.mutate();
                else if (voiding) voided.mutate();
                else changeScore.mutate();
              }}
            />
          </>
        }
      >
        <Field id="reason" label={t("السبب", "Reason")} type="textarea" rows={3} value={reason} onChange={setReason} />
        {flag.error ? <ErrorAlert error={flag.error} /> : null}
        {voided.error ? <ErrorAlert error={voided.error} /> : null}
        {changeScore.error ? <ErrorAlert error={changeScore.error} /> : null}
      </Modal>
    </>
  );
}

export default LabAttemptPage;
