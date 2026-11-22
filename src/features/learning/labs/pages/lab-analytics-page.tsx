import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { labsQueries, type LabsAnalytics } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Bars, Card, Empty, ErrorAlert, Kpi, Loading, PageHead, PageTabs } from "@/components/ui/kit";

import { percent } from "../model";

type Row = Record<string, unknown>;

function rows(value: unknown): Row[] {
  return Array.isArray(value) ? (value as Row[]) : [];
}

function labelOf(row: Row, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" || typeof value === "number") return String(value);
  }
  return "—";
}

function valueOf(row: Row, keys: string[]): number {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) return Number(value);
  }
  return 0;
}

export function LabAnalyticsPage() {
  const { labId = "" } = useParams();
  const detail = useQuery(labsQueries.detail(labId));
  const analytics = useQuery(labsQueries.analytics(labId));
  if (detail.error) return <ErrorAlert error={detail.error} />;
  if (analytics.error) return <ErrorAlert error={analytics.error} />;
  if (!detail.data || !analytics.data) return <Loading />;
  return <AnalyticsBody labId={labId} labTitle={detail.data.lab.title} data={analytics.data} />;
}

function AnalyticsBody({ labId, labTitle, data }: { labId: string; labTitle: string; data: LabsAnalytics }) {
  const t = useT();
  const funnel = rows(data.funnel);
  const branches = rows(data.branches);
  const dimensions = rows(data.dimensions);
  const signals = rows(data.signals);
  const distribution = rows(data.score_distribution);
  const scenarios = rows(data.scenarios);

  return (
    <>
      <PageHead
        back={{ href: `/learning/labs/${labId}`, label: labTitle }}
        title={t("التحليلات", "Analytics")}
        sub={t(
          `قمع الجلسات والفروع ومتوسطات الأبعاد لـ ${labTitle}. تُبنى من المحاولات والأحداث المكثّفة.`,
          `Session funnel, branches and dimension averages for ${labTitle}, computed from attempts and compacted actions.`,
        )}
      />
      <PageTabs
        base={`/learning/labs/${labId}`}
        list={[
          ["", t("نظرة عامة", "Overview")],
          ["edit", t("ورشة العمل", "Studio")],
          ["attempts", t("المحاولات", "Attempts")],
          ["analytics", t("التحليلات", "Analytics")],
          ["assignments", t("الإسناد", "Assignments")],
        ]}
        active="analytics"
      />

      <div className="ma-kpis">
        <Kpi label={t("الجلسات", "Sessions")} value={String(data.sessions)} icon="play" />
        <Kpi label={t("المحاولات", "Attempts")} value={String(data.attempts)} icon="chart" />
        <Kpi label={t("نسبة الإكمال", "Completion")} value={percent(data.completion_rate)} icon="check" />
        <Kpi label={t("متوسط النتيجة", "Average score")} value={data.avg_score == null ? "—" : String(Math.round(data.avg_score))} icon="star" />
        <Kpi label={t("متوسط المدة", "Average time")} value={data.avg_minutes == null ? "—" : `${Math.round(data.avg_minutes)} ${t("دقيقة", "min")}`} icon="history" />
      </div>

      <div className="ma-cols ma-cols--2">
        <Card title={t("قمع الجلسات", "Session funnel")}>
          {funnel.length ? (
            <Bars
              rows={funnel.map((row) => ({
                label: labelOf(row, ["label", "stage", "phase", "name", "key"]),
                value: valueOf(row, ["value", "count", "sessions", "visits"]),
              }))}
              fmt={(value) => String(value)}
            />
          ) : (
            <Empty text={t("لا بيانات قمع بعد.", "No funnel data yet.")} />
          )}
        </Card>
        <Card title={t("توزيع النتائج", "Score distribution")}>
          {distribution.length ? (
            <Bars
              rows={distribution.map((row) => ({
                label: labelOf(row, ["label", "bucket", "range", "key"]),
                value: valueOf(row, ["value", "count", "attempts"]),
              }))}
            />
          ) : (
            <Empty text={t("لا محاولات بعد.", "No attempts yet.")} />
          )}
        </Card>
      </div>

      <Card title={t("متوسطات الأبعاد", "Dimension averages")}>
        {dimensions.length ? (
          <Bars
            rows={dimensions.map((row) => ({
              label: labelOf(row, ["label", "key", "dimension"]),
              value: valueOf(row, ["avg", "average", "score", "value"]),
            }))}
            max={100}
            fmt={(value) => `${Math.round(value * 10) / 10}`}
          />
        ) : (
          <Empty text={t("لا أبعاد بعد.", "No dimension data yet.")} />
        )}
      </Card>

      <div className="ma-cols ma-cols--2">
        <Card title={t("الفروع", "Branches")}>
          {branches.length ? (
            <Bars
              rows={branches.map((row) => ({
                label: labelOf(row, ["label", "node", "choice", "path", "key"]),
                value: valueOf(row, ["count", "visits", "value"]),
              }))}
              fmt={(value) => String(Math.round(value * 10) / 10)}
            />
          ) : (
            <Empty text={t("لا فروع مسجّلة بعد.", "No branch data yet.")} />
          )}
        </Card>
        <Card title={t("الإشارات", "Signals")}>
          {signals.length ? (
            <Bars
              rows={signals.map((row) => ({
                label: labelOf(row, ["label", "key", "signal"]),
                value: valueOf(row, ["rate", "value", "count", "percent"]),
              }))}
              fmt={(value) => `${Math.round(value * 10) / 10}`}
            />
          ) : (
            <Empty text={t("لا إشارات بعد.", "No signal data yet.")} />
          )}
        </Card>
      </div>

      <Card title={t("حسب السيناريو", "By scenario")}>
        {scenarios.length ? (
          <div className="ma-list">
            {scenarios.map((row, index) => (
              <div key={index} className="ma-cell-flex" style={{ justifyContent: "space-between", padding: "var(--space-2) 0", borderBlockEnd: "1px solid var(--line)" }}>
                <strong>{labelOf(row, ["title", "key", "scenario"])}</strong>
                <span className="ma-help">
                  {t("محاولات", "attempts")} {valueOf(row, ["attempts", "count"])} · {t("متوسط", "avg")} {Math.round(valueOf(row, ["avg", "average", "score"]))}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <Empty text={t("لا بيانات لكل سيناريو.", "No per-scenario data.")} />
        )}
      </Card>
    </>
  );
}

export default LabAnalyticsPage;
