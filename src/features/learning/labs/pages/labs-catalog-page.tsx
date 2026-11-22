import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { labsQueries } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Badge, Button, Card, ErrorAlert, Loading, PageHead } from "@/components/ui/kit";

const CATEGORY_LABEL: Record<string, { ar: string; en: string }> = {
  layout: { ar: "التخطيط", en: "Layout" },
  content: { ar: "المحتوى", en: "Content" },
  task: { ar: "المهام والمدخلات", en: "Tasks & inputs" },
  media: { ar: "الوسائط", en: "Media" },
  assessment: { ar: "التقييم", en: "Assessment" },
  advanced: { ar: "متقدم", en: "Advanced" },
};

/** Learning → Practice labs → Engines & artifacts: what the backend can render and why. */
export function LabsCatalogPage() {
  const t = useT();
  const navigate = useNavigate();
  const engines = useQuery(labsQueries.engines());
  const catalog = useQuery(labsQueries.blockTypes());

  const groups = useMemo(() => {
    const map = new Map<string, NonNullable<typeof catalog.data>["items"]>();
    for (const item of catalog.data?.items ?? []) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return [...map.entries()];
  }, [catalog.data]);

  if (engines.error) return <ErrorAlert error={engines.error} />;
  if (catalog.error) return <ErrorAlert error={catalog.error} />;
  if (engines.isLoading || catalog.isLoading || !engines.data || !catalog.data) return <Loading />;

  return (
    <>
      <PageHead
        back={{ href: "/learning/labs/engines", label: t("المحرّكات", "Engines") }}
        title={t("آليات التشغيل والبلوكات", "Runtimes & artifacts")}
        sub={t(
          "المحرّك يحدد آلية التشغيل (مسار، بلوكات، محاكاة…). البلوكات هي قطع الواجهة التي يحرّرها المشرف ويُعيد الخادم مخططها.",
          "An engine defines the mechanic (pathway, blocks, simulation…). Blocks are the UI artifacts the admin edits; the API owns their schemas.",
        )}
      />

      <Card title={t("آليات التشغيل المبرمجة", "Code runtimes")}>
        <div className="ma-form-grid">
          {engines.data.items.map((engine) => (
            <div key={engine.key} className="ma-field" style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-control)", padding: "var(--space-3)" }}>
              <div className="ma-cell-flex" style={{ justifyContent: "space-between", gap: 6, flexWrap: "wrap" }}>
                <strong>{engine.label}</strong>
                <Badge
                  def={
                    engine.scorer === "server"
                      ? { label: { ar: "تقييم خادم", en: "Server scored" }, tone: "success" }
                      : { label: { ar: "تقييم عميل", en: "Client scored" }, tone: "warning" }
                  }
                />
              </div>
              <span className="ma-help">
                <bdi>{engine.key}</bdi> · v{engine.version} · catalog v{engine.catalog_version ?? 1} · schema v{engine.schema_version}
              </span>
              <p className="ma-help" style={{ margin: 0 }}>{engine.description}</p>
              <Button
                sm
                kind="soft"
                label={t("مختبر بهذا المحرّك", "New lab with this engine")}
                onClick={() => navigate(`/learning/labs/new?engine=${encodeURIComponent(engine.key)}`)}
              />
            </div>
          ))}
        </div>
      </Card>

      <Card
        title={t("مكتبة البلوكات", "Artifact library")}
        actions={<Badge def={{ label: { ar: `catalog v${catalog.data.catalog_version}`, en: `catalog v${catalog.data.catalog_version}` }, tone: "info" }} />}
      >
        <p className="ma-help">
          {t(
            "هذه هي كل قطع الواجهة التي يمكن للمشرف إضافتها إلى مختبر بلوكات. خصائص كل بلوك تُولَّد من مخطط JSON الذي يوفره الخادم.",
            "Every UI artifact an admin can add to a blocks lab. Each block's editor is generated from the JSON Schema the API serves.",
          )}
        </p>
        {groups.map(([category, items]) => (
          <div key={category} className="ma-field" style={{ marginBlockEnd: "var(--space-4)" }}>
            <span className="ma-label">{t(CATEGORY_LABEL[category]?.ar ?? category, CATEGORY_LABEL[category]?.en ?? category)}</span>
            <div className="ma-form-grid">
              {items.map((item) => {
                const props = Object.keys(item.props_schema.properties ?? {});
                return (
                  <div key={item.type} style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-control)", padding: "var(--space-3)" }}>
                    <div className="ma-cell-flex" style={{ justifyContent: "space-between", gap: 6 }}>
                      <strong>{t(item.label.ar, item.label.en)}</strong>
                      <bdi className="ma-help">{item.type}</bdi>
                    </div>
                    <p className="ma-help" style={{ margin: 0 }}>{item.description}</p>
                    <div className="ma-cell-flex" style={{ gap: 6, flexWrap: "wrap", marginBlockStart: 6 }}>
                      <Badge def={{ label: { ar: `${props.length} خاصية`, en: `${props.length} props` }, tone: "neutral" }} />
                      {item.supports.scoring ? <Badge def={{ label: { ar: "يُقيَّم", en: "Scored" }, tone: "success" }} /> : null}
                      {item.supports.visibility ? <Badge def={{ label: { ar: "شروط ظهور", en: "Visibility" }, tone: "info" }} /> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </Card>
    </>
  );
}

export default LabsCatalogPage;
