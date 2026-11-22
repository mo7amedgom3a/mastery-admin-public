import { useMemo, useState } from "react";

import { useT } from "@/lib/i18n";
import { Button, Card } from "@/components/ui/kit";
import { SelectField } from "@/components/ui/select";
import { StorefrontViewport } from "@/features/learning/studio/preview/storefront-frame";
import { usePreviewChannel, type PreviewDevice } from "@/features/learning/studio/preview/use-preview-channel";
import type { LabDetail } from "@/lib/api";

/**
 * The lab UI preview on the lab overview page (and anywhere a stored draft is shown).
 *
 * Blocks and schema labs are posted to the storefront's `/preview/lab` frame; bespoke engines fall
 * back to the "open preview" action because they still need their own runner. Nothing here writes
 * sessions, attempts or analytics.
 */
export function LabPreviewCard({ detail }: { detail: LabDetail }) {
  const t = useT();
  const lab = detail.lab;
  const scenarios = [...detail.scenarios].sort((a, b) => a.sort_order - b.sort_order);
  const [scenarioKey, setScenarioKey] = useState(scenarios[0]?.key ?? "main");
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const scenario = scenarios.find((item) => item.key === scenarioKey) ?? scenarios[0];
  const content = useMemo(() => (scenario?.content ?? {}) as Record<string, unknown>, [scenario]);
  const pages = useMemo(
    () => (Array.isArray(content.pages) ? (content.pages as { id: string; title?: { ar?: string } }[]) : []),
    [content],
  );
  const [pageId, setPageId] = useState(pages[0]?.id ?? "");

  const supported = lab.engine_key === "blocks" || lab.engine_key === "schema";

  const runtime = useMemo(() => {
    if (!supported || !scenario) return null;
    const card = {
      slug: lab.slug,
      engine_key: lab.engine_key,
      title: lab.title,
      tagline: lab.tagline,
      field_category_id: lab.field_category_id,
      category_name: lab.category_name,
      difficulty: lab.difficulty,
      minutes: lab.minutes,
      color: lab.color,
      skills: lab.skills,
    };
    if (lab.engine_key === "blocks") {
      return {
        kind: "blocks" as const,
        message: {
          type: "render",
          page_id: pageId || pages[0]?.id || null,
          blocks: {
            lab_id: lab.lab_id,
            version: lab.published_version ?? 0,
            engine: "blocks",
            scorer: "server",
            card,
            definition: detail.definition,
            scenarios: scenarios.map((item) => ({
              key: item.key,
              title: item.title,
              weight: item.weight,
              sort_order: item.sort_order,
            })),
            scenario: {
              key: scenario.key,
              title: scenario.title,
              schema_version: scenario.schema_version,
              catalog_version: scenario.catalog_version,
              content: { ...content, pages },
            },
            preview: true,
          },
        },
      };
    }
    const definition = detail.definition as Record<string, unknown>;
    return {
      kind: "schema" as const,
      message: {
        type: "render",
        lab: {
          ...card,
          lab_id: lab.lab_id,
          version: lab.published_version ?? lab.draft_revision,
          engine: "schema",
          role: definition.role ?? "",
          scenario: definition.scenario ?? "",
          targets: definition.targets ?? [],
          constraints: definition.constraints ?? [],
          phases: definition.phases ?? [],
          personas: content.personas ?? [],
          fields: content.fields ?? [],
          pathway: content.pathway ?? null,
          requirements: definition.requirements ?? [],
          scoring: definition.scoring ?? { dimensions: [] },
          recommendations: definition.recommendations ?? {},
          locale: definition.locale ?? "ar",
        },
      },
    };
  }, [supported, lab, detail.definition, scenario, content, pages, pageId, scenarios]);

  const channel = usePreviewChannel("/preview/lab", runtime?.message ?? null);

  return (
    <Card
      title={t("معاينة واجهة المختبر", "Lab UI preview")}
      actions={
        <span className="ma-cell-flex" style={{ gap: 6, flexWrap: "wrap" }}>
          {scenarios.length > 1 ? (
            <SelectField
              label={t("السيناريو", "Scenario")}
              value={scenarioKey}
              onChange={(key) => {
                setScenarioKey(key);
                const next = scenarios.find((item) => item.key === key);
                const nextPages = (next?.content as { pages?: { id: string }[] } | undefined)?.pages;
                setPageId(Array.isArray(nextPages) ? nextPages[0]?.id ?? "" : "");
              }}
              options={scenarios.map((item) => ({ value: item.key, label: item.title || item.key }))}
            />
          ) : null}
          {pages.length ? (
            <SelectField
              label={t("القسم", "Section")}
              value={pageId}
              onChange={setPageId}
              options={pages.map((page) => ({ value: page.id, label: page.title?.ar || page.id }))}
            />
          ) : null}
          <Button sm kind={device === "desktop" ? "soft" : "ghost"} label={t("سطح المكتب", "Desktop")} onClick={() => setDevice("desktop")} />
          <Button sm kind={device === "mobile" ? "soft" : "ghost"} label={t("الهاتف", "Mobile")} onClick={() => setDevice("mobile")} />
          <Button sm kind="ghost" icon="refresh" label={t("إعادة التحميل", "Reload")} onClick={channel.reload} />
        </span>
      }
    >
      {supported ? (
        <>
          <p className="ma-help">
            {t(
              "هذه واجهة المختبر كما يراها الطالب من المسودة المحفوظة. المعاينة لا تُنشئ جلسة أو محاولة.",
              "This is the learner UI from the saved draft. The preview never creates a session or attempt.",
            )}
          </p>
          <StorefrontViewport
            frameRef={channel.frameRef}
            url={channel.url}
            ready={channel.ready}
            blocked={channel.blocked}
            device={device}
            title={t("معاينة المختبر", "Lab preview")}
            onLoad={channel.notifyLoaded}
            onRetry={channel.reload}
          />
        </>
      ) : (
        <p className="ma-help">
          {t(
            "محرّك هذا المختبر ما زال يعمل داخل الواجهة القديمة؛ استخدم زر «معاينة» لفتحه في تبويب.",
            "This lab still runs on a bespoke engine; use the Preview button to open it in a tab.",
          )}
        </p>
      )}
    </Card>
  );
}
