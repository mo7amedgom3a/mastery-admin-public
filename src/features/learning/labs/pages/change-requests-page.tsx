import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { labAiQueries, type ChangeRequest } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { AppLink } from "@/components/ui/app-link";
import { Badge, Card, ErrorAlert, Loading, PageHead } from "@/components/ui/kit";
import { DataTable, type Column } from "@/components/ui/data-table";

import { CHANGE_STATUS, CHANGE_STATUSES, requesterBadge } from "../ai-model";

/**
 * Learning → Practice labs → Review requests: drafts (often AI-authored) waiting for a human to
 * publish them. Each request passed the quality check when it was opened; editing the draft
 * afterwards makes it stale.
 */
export function ChangeRequestsPage() {
  const t = useT();
  const [status, setStatus] = useState<string>("open");
  const changes = useQuery(labAiQueries.changes({ status: (status || undefined) as never, limit: 100 }));

  const columns: Column<ChangeRequest>[] = [
    {
      key: "target",
      header: t("المسودة", "Draft"),
      width: "20rem",
      exportValue: (row) => row.target_title || row.target_key,
      cell: (row) => (
        <AppLink className="ma-link ma-link--plain" to={`/learning/labs/changes/${row.change_request_id}`}>
          <span className="ma-cell-main">{row.target_title || row.target_key}</span>
          <span className="ma-cell-sub">
            {row.target_type === "lab" ? t("مختبر", "Lab") : t("محرّك", "Engine")} · <bdi>{row.target_key}</bdi>
            {row.base_version_no ? ` · ${t(`فوق v${row.base_version_no}`, `on top of v${row.base_version_no}`)}` : ` · ${t("أول نشر", "first release")}`}
          </span>
        </AppLink>
      ),
    },
    {
      key: "summary",
      header: t("الملخّص", "Summary"),
      exportValue: (row) => row.summary,
      cell: (row) => <span className="ma-help" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{row.summary}</span>,
    },
    {
      key: "by",
      header: t("مقدّم الطلب", "Requested by"),
      exportValue: (row) => (row.actor_type === "ai" ? `AI ${row.client ?? ""}` : "admin"),
      cell: (row) => <Badge def={requesterBadge(row)} />,
    },
    {
      key: "status",
      header: t("الحالة", "Status"),
      exportValue: (row) => row.status,
      cell: (row) => <Badge def={CHANGE_STATUS[row.status]} />,
    },
    {
      key: "created",
      header: t("التاريخ", "Requested"),
      exportKind: "datetime",
      sortable: true,
      sortValue: (row) => row.created_at,
      exportValue: (row) => row.created_at,
      cell: (row) => formatDateTime(row.created_at),
    },
  ];

  return (
    <>
      <PageHead
        back={{ href: "/learning/labs", label: t("المختبرات", "Labs") }}
        title={t("طلبات المراجعة", "Review requests")}
        sub={t(
          "مسودات مختبرات ومحرّكات تنتظر النشر، غالبًا من عملاء الذكاء الاصطناعي. كل طلب اجتاز فحص الجودة عند فتحه، والاعتماد ينشر المسودة كما رُوجعت بالضبط.",
          "Lab and engine drafts waiting to be published, often from AI clients. Every request passed the quality check when it was opened; approving publishes exactly the reviewed draft.",
        )}
      />
      <div className="ma-cell-flex" style={{ gap: 6, flexWrap: "wrap" }} role="group" aria-label={t("تصفية بالحالة", "Filter by status")}>
        {[["", { ar: "الكل", en: "All" }] as const, ...CHANGE_STATUSES.map((key) => [key, CHANGE_STATUS[key].label] as const)].map(([key, label]) => (
          <button
            key={key || "all"}
            type="button"
            aria-pressed={status === key}
            className="ma-chip"
            onClick={() => setStatus(key)}
          >
            {t(label.ar, label.en)}
          </button>
        ))}
      </div>
      {changes.error ? <ErrorAlert error={changes.error} /> : null}
      {changes.isLoading ? <Loading /> : null}
      {changes.data ? (
        <Card title={t(`${changes.data.total} طلب`, `${changes.data.total} request(s)`)} flush>
          <DataTable
            columns={columns}
            rows={changes.data.items}
            empty={status === "open" ? t("لا طلبات بانتظار المراجعة.", "Nothing is waiting for review.") : t("لا طلبات.", "No requests.")}
          />
        </Card>
      ) : null}
    </>
  );
}

export default ChangeRequestsPage;
