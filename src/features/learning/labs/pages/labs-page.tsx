import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import {
  labsKeys,
  labsQueries,
  listLabs,
  type LabEngine,
  type LabListItem,
} from "@/lib/api";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { AppLink } from "@/components/ui/app-link";
import { Badge, Button, Card, Kpi, PageHead } from "@/components/ui/kit";
import type { Column } from "@/components/ui/data-table";
import { PagedList, type ListFilter } from "@/components/ui/paged-list";

import {
  LAB_STATUS,
  LAB_STATUSES,
  labStatusBadge,
  labTitle,
  percent,
} from "../model";

/** Learning → Practice labs: the lab list, health and quick actions. */
export function LabsPage() {
  const t = useT();
  const navigate = useNavigate();
  const canWrite = can("labs.write");
  const engines = useQuery(labsQueries.engines());
  const overview = useQuery(labsQueries.overview());
  const engineOf = useMemo(() => {
    const map = new Map<string, LabEngine>();
    for (const engine of engines.data?.items ?? []) map.set(engine.key, engine);
    return map;
  }, [engines.data]);

  const engineFilters: ListFilter[] = [
    {
      key: "engine",
      label: t("كل المحرّكات", "All engines"),
      options: (engines.data?.items ?? []).map((engine) => ({ value: engine.key, label: engine.label })),
    },
  ];

  const columns: Column<LabListItem>[] = [
    {
      key: "title",
      header: t("المختبر", "Lab"),
      width: "22rem",
      exportValue: (row) => labTitle(row),
      cell: (row) => (
        <AppLink className="ma-link ma-link--plain" to={`/learning/labs/${row.lab_id}`}>
          <span className="ma-cell-main">{labTitle(row)}</span>
          <span className="ma-cell-sub">
            <bdi>{row.slug}</bdi> · {row.category_name ?? row.field_category_id ?? t("بلا مجال", "No field")}
          </span>
        </AppLink>
      ),
    },
    {
      key: "engine",
      header: t("المحرّك", "Engine"),
      exportValue: (row) => engineOf.get(row.engine_key)?.label ?? row.engine_key,
      cell: (row) => (
        <span className="ma-cell-flex" style={{ gap: 6 }}>
          <bdi>{engineOf.get(row.engine_key)?.label ?? row.engine_key}</bdi>
          {row.scorer === "client" ? (
            <Badge def={{ label: { ar: "تقييم العميل", en: "Client scoring" }, tone: "warning" }} />
          ) : null}
        </span>
      ),
    },
    {
      key: "status",
      header: t("الحالة", "Status"),
      exportValue: (row) => row.status,
      cell: (row) => (
        <span className="ma-cell-flex" style={{ gap: 6, flexWrap: "wrap" }}>
          <Badge def={labStatusBadge(row.status)} />
          {row.published_version ? (
            <span className="ma-help">v{row.published_version}</span>
          ) : null}
        </span>
      ),
    },
    {
      key: "scenarios",
      header: t("السيناريوهات", "Scenarios"),
      align: "end",
      exportKind: "number",
      exportValue: (row) => row.scenario_count,
      cell: (row) => <span className="ma-num">{formatNumber(row.scenario_count)}</span>,
    },
    {
      key: "attempts",
      header: t("المحاولات", "Attempts"),
      align: "end",
      exportKind: "number",
      exportValue: (row) => row.attempt_count,
      cell: (row) => <span className="ma-num">{formatNumber(row.attempt_count)}</span>,
    },
    {
      key: "completion",
      header: t("نسبة الإكمال", "Completion"),
      align: "end",
      exportKind: "number",
      exportValue: (row) => percent(row.completion_rate),
      cell: (row) => <span className="ma-num">{percent(row.completion_rate)}</span>,
    },
    {
      key: "avg",
      header: t("متوسط النتيجة", "Avg score"),
      align: "end",
      exportKind: "number",
      exportValue: (row) => row.avg_score ?? null,
      cell: (row) => <span className="ma-num">{row.avg_score == null ? "—" : Math.round(row.avg_score)}</span>,
    },
    {
      key: "updated",
      header: t("آخر تحديث", "Updated"),
      exportKind: "datetime",
      exportValue: (row) => row.updated_at,
      cell: (row) => formatDateTime(row.updated_at),
    },
    {
      key: "actions",
      header: "",
      exportable: false,
      align: "end",
      cell: (row) => (
        <span className="ma-cell-flex" style={{ gap: 6, justifyContent: "flex-end" }}>
          <Button sm kind="ghost" label={t("فتح", "Open")} onClick={() => navigate(`/learning/labs/${row.lab_id}`)} />
          <Button sm kind="ghost" label={t("ورشة العمل", "Studio")} onClick={() => navigate(`/learning/labs/${row.lab_id}/edit`)} />
          <Button sm kind="ghost" icon="layers" label={t("المسار", "Flow")} onClick={() => navigate(`/learning/labs/${row.lab_id}/edit?tab=flow`)} />
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHead
        title={t("المختبرات العملية", "Practice labs")}
        sub={t(
          "مختبرات تفاعلية بمحرّكات في الكود وسيناريوهات كبيانات. أنشئ، حرّر، انشر وتابع المحاولات.",
          "Interactive labs with engines in code and scenarios as data. Author, publish and review attempts.",
        )}
        actions={
          canWrite ? (
            <Button label={t("مختبر جديد", "New lab")} kind="primary" onClick={() => navigate("/learning/labs/new")} />
          ) : undefined
        }
      />

      <div className="ma-kpis">
        <Kpi label={t("كل المختبرات", "All labs")} value={formatNumber(overview.data?.labs ?? 0)} icon="book" />
        <Kpi label={t("منشورة", "Published")} value={formatNumber(overview.data?.published ?? 0)} icon="check" />
        <Kpi label={t("مسودات", "Drafts")} value={formatNumber(overview.data?.drafts ?? 0)} icon="edit" />
        <Kpi label={t("المحاولات", "Attempts")} value={formatNumber(overview.data?.attempts ?? 0)} icon="zap" />
        <Kpi
          label={t("متوسط النتيجة", "Average score")}
          value={overview.data?.avg_score == null ? "—" : String(Math.round(overview.data.avg_score))}
          meta={t(`نسبة الإكمال ${percent(overview.data?.completion_rate)}`, `Completion ${percent(overview.data?.completion_rate)}`)}
          icon="chart"
        />
      </div>

      <Card flush>
        <PagedList
          queryKeyBase={labsKeys.all}
          fetchPage={({ query, offset, limit, filters }) =>
            listLabs({
              q: query,
              offset,
              limit,
              engine: filters.engine || undefined,
              status: (filters.status || undefined) as LabListItem["status"] | undefined,
            })
          }
          columns={columns}
          searchPlaceholder={t("ابحث بالعنوان أو المعرف", "Search by title or slug")}
          filters={[
            {
              key: "status",
              label: t("كل الحالات", "All statuses"),
              options: LAB_STATUSES.map((status) => ({
                value: status,
                label: t(LAB_STATUS[status].label.ar, LAB_STATUS[status].label.en),
              })),
            },
            ...engineFilters,
          ]}
          empty={t("لا مختبرات بعد.", "No labs yet.")}
        />
      </Card>
    </>
  );
}

export default LabsPage;
