import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { labEngineQueries, type EngineDefSummary } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { AppLink } from "@/components/ui/app-link";
import { Alert, Badge, Button, Card, Empty, ErrorAlert, Loading, PageHead } from "@/components/ui/kit";

import { ENGINE_STATUS, SYSTEM_BADGE, engineName } from "../engine-model";

function EngineCard({ engine }: { engine: EngineDefSummary }) {
  const t = useT();
  const description = (engine.description as { ar?: string; en?: string | null })?.ar;
  return (
    <div className="ma-field" style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-control)", padding: "var(--space-3)", gap: 6 }}>
      <div className="ma-cell-flex" style={{ justifyContent: "space-between", gap: 6, flexWrap: "wrap" }}>
        <AppLink className="ma-link ma-link--plain" to={`/learning/labs/engines/${engine.engine_id}`}>
          <strong>{engineName(engine)}</strong>
        </AppLink>
        <span className="ma-cell-flex" style={{ gap: 4 }}>
          {engine.is_system ? <Badge def={SYSTEM_BADGE} /> : <Badge def={ENGINE_STATUS[engine.status]} />}
          <Button
            sm
            kind="ghost"
            icon="layers"
            label={t("المسار", "Flow")}
            href={`/learning/labs/engines/${engine.engine_id}?tab=flow`}
          />
        </span>
      </div>
      <span className="ma-help">
        <bdi>{engine.key}</bdi> · {t("محرّك التشغيل", "runtime")} <bdi>{engine.runtime_key}</bdi>
        {engine.published_version ? ` · v${engine.published_version}` : ""}
      </span>
      {description ? <p className="ma-help" style={{ margin: 0 }}>{description}</p> : null}
      <span className="ma-help">
        {t(`${engine.lab_count} مختبر`, `${engine.lab_count} lab(s)`)} · {t("آخر تحديث", "updated")} {formatDateTime(engine.updated_at)}
      </span>
    </div>
  );
}

/**
 * Learning → Practice labs → Engines: admin engines (HR, sales…) built on code runtimes, plus the
 * system engines that mirror the runtimes themselves.
 */
export function EnginesPage() {
  const t = useT();
  const navigate = useNavigate();
  const canWrite = can("labs.write");
  const [query, setQuery] = useState("");
  const engines = useQuery(labEngineQueries.list());

  const [admin, system] = useMemo(() => {
    const items = (engines.data?.items ?? []).filter((engine) => {
      const needle = query.trim().toLowerCase();
      return !needle || engine.key.includes(needle) || engineName(engine).toLowerCase().includes(needle) || engineName(engine, false).toLowerCase().includes(needle);
    });
    return [items.filter((engine) => !engine.is_system), items.filter((engine) => engine.is_system)];
  }, [engines.data, query]);

  if (engines.error) return <ErrorAlert error={engines.error} />;
  if (engines.isLoading || !engines.data) return <Loading />;

  return (
    <>
      <PageHead
        back={{ href: "/learning/labs", label: t("المختبرات", "Labs") }}
        title={t("محرّكات المختبرات", "Lab engines")}
        sub={t(
          "المحرّك قالب يحدده المشرف فوق آلية تشغيل برمجية: السياق، الشخصيات، المؤشرات، القيود وطريقة التقييم. المختبرات تُبنى على محرّك.",
          "An engine is an admin template on top of a code runtime: context, personas, meters, constraints and scoring. Labs are built on an engine.",
        )}
        actions={
          <span className="ma-cell-flex" style={{ gap: 6 }}>
            <Button kind="ghost" icon="users" label={t("الشخصيات", "Personas")} href="/learning/labs/personas" />
            {canWrite ? <Button kind="primary" icon="plus" label={t("محرّك جديد", "New engine")} onClick={() => navigate("/learning/labs/engines/new")} /> : null}
          </span>
        }
      />

      <div className="ma-field" style={{ maxWidth: "24rem" }}>
        <input className="ma-input" type="search" placeholder={t("ابحث بالاسم أو المفتاح", "Search by name or key")} aria-label={t("بحث", "Search")} value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>

      <Card title={t(`محرّكات المشرفين (${admin.length})`, `Admin engines (${admin.length})`)}>
        {admin.length ? (
          <div className="ma-form-grid">
            {admin.map((engine) => (
              <EngineCard key={engine.engine_id} engine={engine} />
            ))}
          </div>
        ) : (
          <Empty
            text={t("لا محرّكات بعد. أنشئ محرّكًا مثل «مقابلة موارد بشرية» أو «مكالمة مبيعات».", "No engines yet. Create one such as “HR interview” or “Sales call”.")}
            action={canWrite ? <Button kind="primary" label={t("محرّك جديد", "New engine")} onClick={() => navigate("/learning/labs/engines/new")} /> : undefined}
          />
        )}
      </Card>

      <Card title={t(`محرّكات النظام (${system.length})`, `System engines (${system.length})`)}>
        <Alert kind="info" title={t("آليات التشغيل البرمجية", "Code runtimes")}>
          {t(
            "تمثل آليات التشغيل المبرمجة (حوار، بلوكات، مسار، والمحاكيات المخصصة). لا تُعدّل، لكن يمكن نسخ محرّك نظام قابل للتأليف لبدء محرّك جديد.",
            "These mirror the coded runtimes (dialogue, blocks, pathway and the bespoke simulators). They cannot be edited, but an authorable one can be duplicated to start a new engine.",
          )}
        </Alert>
        <div className="ma-form-grid">
          {system.map((engine) => (
            <EngineCard key={engine.engine_id} engine={engine} />
          ))}
        </div>
        <p className="ma-help">
          <AppLink className="ma-link" to="/learning/labs/runtimes">
            {t("تفاصيل آليات التشغيل ومكتبة البلوكات", "Runtime details and the block library")}
          </AppLink>
        </p>
      </Card>
    </>
  );
}

export default EnginesPage;
