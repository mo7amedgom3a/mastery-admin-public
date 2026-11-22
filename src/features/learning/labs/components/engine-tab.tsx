import { useQuery } from "@tanstack/react-query";

import { labEngineQueries, type LabDetail } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { AppLink } from "@/components/ui/app-link";
import { Alert, Badge, Card, Dl, Empty, ErrorAlert, Field, Loading } from "@/components/ui/kit";

import { ENGINE_STATUS, engineName, normalizeDefinition } from "../engine-model";

type Overrides = { constraints: Record<string, unknown>; slots: Record<string, string> };
type LabEngineSummary = {
  engine_id: string;
  key: string;
  runtime_key: string;
  name: { ar?: string; en?: string | null };
  status: string;
  is_system: boolean;
  published_version_no: number | null;
  pinned_version_no: number | null;
  update_available: boolean;
};

/**
 * Lab Studio → Engine: which admin engine the lab is built on, which version its live version
 * pinned, and the lab's own choices on top of it (persona casting, constraint values).
 * Edits go into `definition.engine_overrides` and are saved with the definition draft.
 */
export function EngineTab({
  detail,
  definition,
  onChange,
  readOnly,
}: {
  detail: LabDetail;
  definition: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  readOnly: boolean;
}) {
  const t = useT();
  const summary = detail.engine as LabEngineSummary | null | undefined;
  const engine = useQuery({ ...labEngineQueries.detail(summary?.engine_id ?? ""), enabled: Boolean(summary && !summary.is_system) });
  const personas = useQuery({ ...labEngineQueries.personas({ status: "active" }), enabled: Boolean(summary && !summary.is_system) });

  if (!summary) {
    return (
      <Card title={t("المحرّك", "Engine")}>
        <Empty text={t("هذا المختبر أُنشئ قبل المحرّكات ولا يرتبط بمحرّك مشرف.", "This lab predates engines and is not linked to an admin engine.")} />
      </Card>
    );
  }
  if (summary.is_system) {
    return (
      <Card title={t("المحرّك", "Engine")}>
        <Alert kind="info" title={engineName({ key: summary.key, name: summary.name })}>
          {t("محرّك نظام (آلية تشغيل برمجية): لا شخصيات ولا قيود قابلة للتخصيص هنا.", "A system engine (a code runtime): no persona casting or constraints to customise here.")}
        </Alert>
      </Card>
    );
  }
  if (engine.error) return <ErrorAlert error={engine.error} />;
  if (!engine.data) return <Loading />;

  const spec = normalizeDefinition(engine.data.definition);
  const overrides: Overrides = {
    constraints: {},
    slots: {},
    ...((definition.engine_overrides as Partial<Overrides> | undefined) ?? {}),
  };
  const setOverrides = (patch: Partial<Overrides>) => onChange({ ...definition, engine_overrides: { ...overrides, ...patch } });

  return (
    <>
      <Card title={t("المحرّك", "Engine")}>
        <Dl
          rows={[
            [t("المحرّك", "Engine"), <AppLink key="e" className="ma-link" to={`/learning/labs/engines/${summary.engine_id}`}>{engineName({ key: summary.key, name: summary.name })}</AppLink>],
            [t("الحالة", "Status"), <Badge key="s" def={ENGINE_STATUS[summary.status]} />],
            [t("آخر إصدار منشور", "Latest published"), summary.published_version_no ? `v${summary.published_version_no}` : t("غير منشور", "Not published")],
            [t("الإصدار المثبّت في المختبر المنشور", "Version pinned by the live lab"), summary.pinned_version_no ? `v${summary.pinned_version_no}` : "—"],
          ]}
        />
        {summary.update_available ? (
          <Alert kind="warning" title={t("إصدار أحدث من المحرّك", "Newer engine version")}>
            {t("أعد نشر المختبر ليستخدم الطلاب أحدث سياق وتقييم وشخصيات.", "Republish the lab so learners get the latest context, scoring and personas.")}
          </Alert>
        ) : null}
        {!summary.published_version_no ? (
          <Alert kind="warning" title={t("المحرّك غير منشور", "Engine not published")}>
            {t("انشر المحرّك قبل نشر هذا المختبر. المعاينة تستخدم مسودة المحرّك.", "Publish the engine before publishing this lab. Previews use the engine draft.")}
          </Alert>
        ) : null}
      </Card>

      <Card title={t("توزيع الشخصيات", "Persona casting")}>
        <p className="ma-help">
          {t("اختر من يؤدي كل دور في هذا المختبر؛ الفارغ يستخدم الشخصية الافتراضية للمحرّك.", "Pick who plays each role in this lab; empty uses the engine default.")}
        </p>
        {spec.persona_slots.length ? null : <Empty text={t("المحرّك بلا خانات شخصيات.", "The engine has no persona slots.")} />}
        <div className="ma-form-grid">
          {spec.persona_slots.map((slot) => (
            <Field
              key={slot.slot}
              id={`cast-${slot.slot}`}
              label={`${slot.label.ar} (${slot.slot})`}
              value={overrides.slots[slot.slot] ?? "none"}
              options={[
                ["none", `${t("الافتراضي", "Default")}${slot.default_persona_key ? `: ${slot.default_persona_key}` : ""}`],
                ...(personas.data?.items ?? []).map((persona): [string, string] => [persona.key, `${persona.name} · ${persona.role}`]),
              ]}
              onChange={(value) => {
                const slots = { ...overrides.slots };
                if (value && value !== "none") slots[slot.slot] = value;
                else delete slots[slot.slot];
                setOverrides({ slots });
              }}
            />
          ))}
        </div>
      </Card>

      <Card title={t("القيود في هذا المختبر", "Constraints in this lab")}>
        <p className="ma-help">
          {t("القيم الموروثة من المحرّك؛ غيّر ما يسمح المحرّك بتعديله فقط.", "Values inherited from the engine; only those the engine marks as overridable can change.")}
        </p>
        {spec.constraints.length ? null : <Empty text={t("المحرّك بلا قيود.", "The engine has no constraints.")} />}
        <div className="ma-form-grid">
          {spec.constraints.map((item) => {
            const overridden = item.key in overrides.constraints;
            const current = overridden ? overrides.constraints[item.key] : item.value;
            const editable = item.lab_overridable !== false && !readOnly;
            return (
              <Field
                key={item.key}
                id={`constraint-${item.key}`}
                label={`${item.label.ar}${item.unit ? ` (${item.unit})` : ""}${overridden ? ` · ${t("مخصّص", "custom")}` : ""}`}
                type={item.type === "text" || item.type === "bool" ? "text" : "number"}
                value={current == null ? "" : String(current)}
                readOnly={!editable}
                hint={
                  !editable
                    ? t("ثابت من المحرّك", "Fixed by the engine")
                    : t(`الافتراضي: ${String(item.value ?? "—")}. امسح الحقل للعودة إليه.`, `Default: ${String(item.value ?? "—")}. Clear to inherit.`)
                }
                onChange={(raw) => {
                  const constraints = { ...overrides.constraints };
                  if (raw === "") delete constraints[item.key];
                  else constraints[item.key] = item.type === "text" ? raw : item.type === "bool" ? raw === "true" : Number(raw);
                  setOverrides({ constraints });
                }}
              />
            );
          })}
        </div>
      </Card>
    </>
  );
}
