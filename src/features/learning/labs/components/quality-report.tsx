import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { checkEngineDef, checkLab, labAiQueries, type ExploreSummary, type QualityCheck } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { AppLink } from "@/components/ui/app-link";
import { Alert, Badge, Button, ErrorAlert } from "@/components/ui/kit";
import { Modal } from "@/components/ui/modal";

import { IssueList } from "../schema-form";

function ExploreRow({ name, summary }: { name: string; summary: ExploreSummary }) {
  const t = useT();
  if (!summary.applicable) {
    return (
      <tr>
        <td><bdi>{name}</bdi></td>
        <td colSpan={4} className="ma-help">{summary.reason ?? t("لا مسارات متفرعة لاستكشافها", "No branching to explore")}</td>
      </tr>
    );
  }
  if (summary.error) {
    return (
      <tr>
        <td><bdi>{name}</bdi></td>
        <td colSpan={4} style={{ color: "var(--danger)" }}>{summary.error}</td>
      </tr>
    );
  }
  const thresholds = summary.thresholds ?? { ready: 60, excellent: 80 };
  const constant = Object.entries(summary.dimensions ?? {}).filter(([, d]) => d.constant).map(([key]) => key);
  const tone = (value: number) => (value >= thresholds.excellent ? "var(--success)" : value >= thresholds.ready ? "inherit" : "var(--danger)");
  return (
    <tr>
      <td><bdi>{name}</bdi></td>
      <td className="ma-num" style={{ color: tone(summary.best?.overall ?? 0) }}>{summary.best?.overall ?? "—"}</td>
      <td className="ma-num" style={{ color: summary.worst && summary.worst.overall >= thresholds.ready ? "var(--warning, #b7791f)" : "inherit" }}>
        {summary.worst?.overall ?? "—"}
      </td>
      <td className="ma-help">
        {t(`${summary.paths_scored ?? 0} مسار`, `${summary.paths_scored ?? 0} paths`)}
        {summary.truncated ? t(" (عيّنة)", " (sampled)") : ""}
        {summary.outcomes ? ` · ${Object.entries(summary.outcomes).map(([k, v]) => `${k}: ${v}`).join(", ")}` : ""}
      </td>
      <td className="ma-help">{constant.length ? t(`ثابتة: ${constant.join("، ")}`, `Constant: ${constant.join(", ")}`) : "—"}</td>
    </tr>
  );
}

/** The `labs.check` / `engines.check` report: what blocks a publish, what to improve, and path exploration. */
export function QualityReport({ report }: { report: QualityCheck }) {
  const t = useT();
  const [showWarnings, setShowWarnings] = useState(report.errors.length === 0);
  const explore = Object.entries((report.explore ?? {}) as Record<string, ExploreSummary>);
  return (
    <div className="ma-field" style={{ gap: "var(--space-3)" }}>
      {report.ok ? (
        <Alert kind="success" title={t("الفحص سليم: لا أخطاء تمنع النشر", "Check passed: nothing blocks publishing")}>
          {report.warnings.length ? t(`${report.warnings.length} تنبيه للتحسين.`, `${report.warnings.length} warning(s) to consider.`) : null}
        </Alert>
      ) : (
        <Alert kind="danger" title={t(`${report.errors.length} خطأ يجب إصلاحه قبل النشر`, `${report.errors.length} error(s) to fix before publishing`)}>
          <IssueList issues={report.errors} />
        </Alert>
      )}
      {report.warnings.length ? (
        <div>
          <Button sm kind="ghost" label={showWarnings ? t("إخفاء التنبيهات", "Hide warnings") : t(`عرض ${report.warnings.length} تنبيه`, `Show ${report.warnings.length} warning(s)`)} onClick={() => setShowWarnings((value) => !value)} />
          {showWarnings ? <IssueList issues={report.warnings} /> : null}
        </div>
      ) : null}
      {explore.length ? (
        <div>
          <strong>{t("استكشاف المسارات", "Path exploration")}</strong>
          <p className="ma-help" style={{ margin: "4px 0 8px" }}>
            {t(
              "يلعب الخادم كل مسارات المتعلم الممكنة ويقيّمها كما تُقيَّم المحاولات الحقيقية: أفضل مسار يجب أن يصل إلى «متميّز» وأسوأ مسار يجب أن يبقى دون «جاهز».",
              "The server plays every learner path and scores it exactly like a real attempt: the best path should reach excellent, the worst should stay below ready.",
            )}
          </p>
          <div style={{ overflowX: "auto" }}>
            <table className="ma-table">
              <thead>
                <tr>
                  <th>{t("السيناريو", "Scenario")}</th>
                  <th>{t("أفضل", "Best")}</th>
                  <th>{t("أسوأ", "Worst")}</th>
                  <th>{t("المسارات", "Paths")}</th>
                  <th>{t("أبعاد لا تتغير", "Dimensions that never move")}</th>
                </tr>
              </thead>
              <tbody>
                {explore.map(([name, summary]) => <ExploreRow key={name} name={name} summary={summary} />)}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** "Quality check" action: runs the deterministic gate (validation + style rules + exploration). */
export function QualityCheckButton({ target, id, sm = true }: { target: "lab" | "engine"; id: string; sm?: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const check = useMutation({ mutationFn: () => (target === "lab" ? checkLab(id) : checkEngineDef(id)) });
  return (
    <>
      <Button
        sm={sm}
        kind="ghost"
        icon="check"
        label={t("فحص الجودة", "Quality check")}
        onClick={() => {
          setOpen(true);
          check.mutate();
        }}
      />
      <Modal
        open={open}
        onOpenChange={setOpen}
        size="lg"
        title={t("فحص الجودة", "Quality check")}
        description={t(
          "نفس البوابة التي يجب أن يجتازها أي طلب نشر: التحقق، قواعد الأسلوب، واستكشاف المسارات. لا يُحفظ شيء.",
          "The same gate every publish request must pass: validation, style rules and path exploration. Nothing is saved.",
        )}
        footer={
          <>
            <Button kind="ghost" label={t("إعادة الفحص", "Run again")} disabled={check.isPending} onClick={() => check.mutate()} />
            <Button kind="primary" label={t("إغلاق", "Close")} onClick={() => setOpen(false)} />
          </>
        }
      >
        {check.isPending ? <p className="ma-help">{t("جارٍ الفحص واستكشاف المسارات…", "Checking and exploring paths…")}</p> : null}
        {check.error ? <ErrorAlert error={check.error} /> : null}
        {check.data && !check.isPending ? <QualityReport report={check.data} /> : null}
      </Modal>
    </>
  );
}

/** "Awaiting review" link when a lab or engine has an open publish request (e.g. from an AI client). */
export function OpenReviewLink({ targetId }: { targetId: string }) {
  const t = useT();
  const open = useQuery(labAiQueries.changes({ target_id: targetId, status: "open", limit: 1 }));
  const request = open.data?.items[0];
  if (!request) return null;
  return (
    <AppLink className="ma-link" to={`/learning/labs/changes/${request.change_request_id}`} title={t("فتح طلب المراجعة", "Open the review request")}>
      <Badge def={{ label: { ar: request.actor_type === "ai" ? "طلب مراجعة من الذكاء الاصطناعي" : "طلب مراجعة مفتوح", en: request.actor_type === "ai" ? "AI review request" : "Review requested" }, tone: "info" }} />
    </AppLink>
  );
}
