import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import {
  getLabAttempts,
  labsKeys,
  labsQueries,
  type LabAttempt,
} from "@/lib/api";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { AppLink } from "@/components/ui/app-link";
import { Badge, Card, ErrorAlert, Kpi, Loading, PageHead, PageTabs } from "@/components/ui/kit";
import type { Column } from "@/components/ui/data-table";
import { PagedList } from "@/components/ui/paged-list";

import { ATTEMPT_STATUS, READINESS, labTitle } from "../model";

export function LabAttemptsPage() {
  const { labId = "" } = useParams();
  const query = useQuery(labsQueries.detail(labId));
  const t = useT();
  if (query.error) return <ErrorAlert error={query.error} />;
  if (!query.data) return <Loading />;
  const detail = query.data;
  const lab = detail.lab;

  const columns: Column<LabAttempt>[] = [
    {
      key: "learner",
      header: t("المتعلّم", "Learner"),
      exportValue: (row) => row.customer_id ?? row.anonymous_id ?? "—",
      cell: (row) => (
        <AppLink className="ma-link ma-link--plain" to={`/learning/labs/${labId}/attempts/${row.attempt_id}`}>
          <span className="ma-cell-main">
            {row.customer_id ? <bdi>{row.customer_id.slice(0, 8)}…</bdi> : row.anonymous_id ? <bdi>anon:{row.anonymous_id.slice(0, 8)}…</bdi> : "—"}
          </span>
          <span className="ma-cell-sub">{row.scenario_key}</span>
        </AppLink>
      ),
    },
    {
      key: "overall",
      header: t("النتيجة", "Score"),
      align: "end",
      exportKind: "number",
      exportValue: (row) => row.overall,
      cell: (row) => <strong className="ma-num">{row.overall}</strong>,
    },
    {
      key: "readiness",
      header: t("الجاهزية", "Readiness"),
      exportValue: (row) => row.readiness,
      cell: (row) => <Badge def={READINESS[row.readiness] ?? { label: { ar: row.readiness, en: row.readiness } }} />,
    },
    {
      key: "status",
      header: t("الحالة", "Status"),
      exportValue: (row) => row.status,
      cell: (row) => (
        <span className="ma-cell-flex" style={{ gap: 6, flexWrap: "wrap" }}>
          <Badge def={ATTEMPT_STATUS[row.status]} />
          {row.verified ? null : <Badge def={{ label: { ar: "غير موثّق", en: "Unverified" }, tone: "warning" }} />}
        </span>
      ),
    },
    {
      key: "client",
      header: t("نتيجة العميل", "Client score"),
      align: "end",
      exportKind: "number",
      exportValue: (row) => row.client_overall ?? null,
      cell: (row) => <span className="ma-num">{row.client_overall == null ? "—" : row.client_overall}</span>,
    },
    {
      key: "xp",
      header: "XP",
      align: "end",
      exportKind: "number",
      exportValue: (row) => row.xp,
      cell: (row) => <span className="ma-num">{formatNumber(row.xp)}</span>,
    },
    {
      key: "duration",
      header: t("المدة", "Duration"),
      align: "end",
      exportKind: "number",
      exportValue: (row) => row.duration_seconds,
      cell: (row) => `${Math.round(row.duration_seconds / 60)} ${t("د", "min")}`,
    },
    {
      key: "at",
      header: t("التاريخ", "Date"),
      exportKind: "datetime",
      exportValue: (row) => row.at,
      cell: (row) => formatDateTime(row.at),
    },
    {
      key: "actions",
      header: "",
      exportable: false,
      align: "end",
      cell: (row) => <AppLink className="ma-link" to={`/learning/labs/${labId}/attempts/${row.attempt_id}`}>{t("فتح", "Open")}</AppLink>,
    },
  ];

  return (
    <>
      <PageHead
        back={{ href: `/learning/labs/${labId}`, label: labTitle(lab) }}
        title={t("المحاولات", "Attempts")}
        sub={t(`محاولات ${labTitle(lab)} — النتيجة تُحسب على الخادم وتُقارن بنتيجة العميل.`, `Attempts for ${labTitle(lab)} — the server score is compared with the client's.`)}
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
        active="attempts"
      />
      <div className="ma-kpis">
        <Kpi label={t("كل المحاولات", "All attempts")} value={formatNumber(lab.attempt_count)} icon="chart" />
        <Kpi label={t("متوسط النتيجة", "Average score")} value={lab.avg_score == null ? "—" : String(Math.round(lab.avg_score))} icon="star" />
        <Kpi label={t("نسبة الإكمال", "Completion")} value={`${Math.round((lab.completion_rate ?? 0) * 10) / 10}%`} icon="check" />
      </div>
      <Card flush>
        <PagedList
          queryKeyBase={[...labsKeys.all, "attempts", labId]}
          fetchPage={({ offset, limit, filters }) =>
            getLabAttempts(labId, {
              offset,
              limit,
              status: (filters.status || undefined) as LabAttempt["status"] | undefined,
            })
          }
          columns={columns}
          filters={[
            {
              key: "status",
              label: t("كل الحالات", "All statuses"),
              options: (Object.keys(ATTEMPT_STATUS) as LabAttempt["status"][]).map((status) => ({
                value: status,
                label: t(ATTEMPT_STATUS[status].label.ar, ATTEMPT_STATUS[status].label.en),
              })),
            },
          ]}
          empty={t("لا محاولات بعد.", "No attempts yet.")}
        />
      </Card>
    </>
  );
}

export default LabAttemptsPage;
