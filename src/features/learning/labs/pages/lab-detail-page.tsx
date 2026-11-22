import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";

import { labsQueries, type LabDetail } from "@/lib/api";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { Alert, Badge, Button, Card, Dl, Empty, ErrorAlert, Kpi, Loading, PageHead, PageTabs } from "@/components/ui/kit";

import { LabActions } from "../components/lab-actions";
import { LabPreviewCard } from "../components/lab-preview-card";
import { IssueList } from "../schema-form";
import { LAB_STATUS, labStatusBadge, labTitle, percent, storefrontUrl } from "../model";

export function LabDetailPage() {
  const { labId = "" } = useParams();
  const query = useQuery(labsQueries.detail(labId));
  const navigate = useNavigate();
  if (query.error) return <ErrorAlert error={query.error} />;
  if (!query.data) return <Loading />;
  const detail = query.data;
  return <Overview detail={detail} onStudio={() => navigate(`/learning/labs/${detail.lab.lab_id}/edit?tab=scenarios`)} />;
}

function Overview({ detail, onStudio }: { detail: LabDetail; onStudio: () => void }) {
  const t = useT();
  const lab = detail.lab;
  const release = lab.release ?? {};
  const issues = detail.issues ?? [];
  const errors = issues.filter((issue) => issue.level === "error");
  const warnings = issues.filter((issue) => issue.level === "warning");

  return (
    <>
      <PageHead
        back={{ href: "/learning/labs", label: t("المختبرات", "Labs") }}
        title={labTitle(lab)}
        status={<Badge def={labStatusBadge(lab.status)} />}
        sub={
          <span>
            <bdi>{lab.slug}</bdi> · {lab.engine_key} · {lab.category_name ?? (lab.field_category_id ?? t("بلا مجال", "No field"))}
          </span>
        }
        actions={<LabActions detail={detail} />}
      />
      <PageTabs
        base={`/learning/labs/${lab.lab_id}`}
        list={[
          ["", t("نظرة عامة", "Overview")],
          ["edit", t("ورشة العمل", "Studio")],
          ["attempts", t("المحاولات", "Attempts")],
          ["analytics", t("التحليلات", "Analytics")],
          ["assignments", t("الإسناد", "Assignments")],
        ]}
        active=""
      />

      <div className="ma-kpis">
        <Kpi label={t("المحاولات", "Attempts")} value={formatNumber(lab.attempt_count)} icon="chart" />
        <Kpi label={t("نسبة الإكمال", "Completion")} value={percent(lab.completion_rate)} icon="check" />
        <Kpi label={t("متوسط النتيجة", "Average score")} value={lab.avg_score == null ? "—" : String(Math.round(lab.avg_score))} icon="star" />
        <Kpi label={t("السيناريوهات", "Scenarios")} value={formatNumber(lab.scenario_count)} icon="layers" />
        <Kpi
          label={t("الإصدار المنشور", "Published version")}
          value={lab.published_version ? `v${lab.published_version}` : t("لا يوجد", "None")}
          meta={lab.published_at ? formatDateTime(lab.published_at) : undefined}
          icon="history"
        />
      </div>

      <LabPreviewCard detail={detail} />

      <div className="ma-cols ma-cols--main-side">
        <div>
          {errors.length ? (
            <Alert kind="danger" title={t(`${errors.length} خطأ يمنع النشر`, `${errors.length} error(s) block publishing`)}>
              <IssueList issues={errors.slice(0, 20)} />
            </Alert>
          ) : null}
          {warnings.length ? (
            <Alert kind="warning" title={t(`${warnings.length} تنبيه`, `${warnings.length} warning(s)`)}>
              <IssueList issues={warnings.slice(0, 10)} />
            </Alert>
          ) : null}

          <Card
            title={t("السيناريوهات", "Scenarios")}
            actions={
              <Button sm kind="ghost" label={t("تحرير في ورشة العمل", "Edit in Studio")} onClick={onStudio} />
            }
          >
            {detail.scenarios.length ? (
              <div className="ma-list">
                {[...detail.scenarios].sort((a, b) => a.sort_order - b.sort_order).map((scenario) => (
                  <div key={scenario.scenario_id} className="ma-cell-flex" style={{ justifyContent: "space-between", padding: "var(--space-2) 0", borderBlockEnd: "1px solid var(--line)" }}>
                    <div>
                      <strong>{scenario.title || scenario.key}</strong>{" "}
                      <span className="ma-help">
                        <bdi>{scenario.key}</bdi> · {t(`وزن ${scenario.weight}`, `weight ${scenario.weight}`)} · v{scenario.schema_version}
                      </span>
                      {scenario.issues?.length ? <div className="ma-help" style={{ color: "var(--warning)" }}>{t(`${scenario.issues.length} مشكلة`, `${scenario.issues.length} issue(s)`)}</div> : null}
                    </div>
                    <Badge def={scenario.status === "active" ? { label: { ar: "نشط", en: "Active" }, tone: "success" } : { label: { ar: "معطّل", en: "Disabled" }, tone: "neutral" }} />
                  </div>
                ))}
              </div>
            ) : (
              <Empty text={t("لا سيناريوهات بعد.", "No scenarios yet.")} />
            )}
          </Card>

          <Card title={t("المحتوى", "Content")}>
            <Dl
              rows={[
                [t("الدور", "Role"), String(detail.definition.role ?? "—") || "—"],
                [t("الأهداف", "Targets"), String(((detail.definition.targets as string[] | undefined) ?? []).length)],
                [t("المتطلبات", "Requirements"), String(((detail.definition.requirements as unknown[] | undefined) ?? []).length)],
                [
                  t("أبعاد التقييم", "Scoring dimensions"),
                  String((((detail.definition.scoring as Record<string, unknown> | undefined)?.dimensions as unknown[]) ?? []).length),
                ],
                [t("اللغة", "Locale"), String(detail.definition.locale ?? "—")],
              ]}
            />
          </Card>
        </div>

        <div>
          <Card title={t("الحالة والإطلاق", "Status & release")}>
            <Dl
              rows={[
                [t("الحالة", "Status"), t(LAB_STATUS[lab.status].label.ar, LAB_STATUS[lab.status].label.en)],
                [t("مراجعة المسودة", "Draft revision"), String(lab.draft_revision)],
                [t("تغييرات غير منشورة", "Unpublished changes"), detail.has_unpublished_changes ? t("نعم", "Yes") : t("لا", "No")],
                [t("نافذة الإطلاق", "Window"), release.starts_at || release.ends_at ? `${formatDateTime(release.starts_at as string) || "—"} → ${formatDateTime(release.ends_at as string) || "—"}` : t("دائم", "Always")],
                [t("نسبة الطرح", "Rollout"), `${release.rollout_pct ?? 100}%`],
                [t("القتل السريع", "Kill switch"), release.kill_switch ? t("مفعّل", "On") : t("مغلق", "Off")],
                [t("آخر تحديث", "Updated"), formatDateTime(lab.updated_at)],
              ]}
            />
          </Card>

          <Card title={t("روابط", "Links")}>
            {lab.status === "published" ? (
              <a className="ma-link" href={storefrontUrl(`/labs/${lab.slug}`)} target="_blank" rel="noopener noreferrer">
                {t("افتح صفحة المختبر للطلاب", "Open the learner page")}
              </a>
            ) : (
              <p className="ma-help">{t("المختبر غير منشور؛ استخدم «معاينة» لتشغيل المسودة.", "The lab is unpublished; use Preview to run the draft.")}</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

export default LabDetailPage;
