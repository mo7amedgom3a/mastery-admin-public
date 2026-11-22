import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";

import { createLab, labEngineQueries, labsKeys, type LabCreateInput } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Alert, Badge, Button, Card, ErrorAlert, Field, FormActions, Loading, PageHead } from "@/components/ui/kit";
import { SelectField } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";

import { COLORS, DIFFICULTIES, SKILLS, SKILL_LABELS, slugify } from "../model";
import { ENGINE_STATUS, SYSTEM_BADGE, engineName } from "../engine-model";

/**
 * Learning → Practice labs → New: pick an engine (an admin engine such as "HR mediation", or a
 * system engine that mirrors a code runtime) and create the draft with the engine's starter
 * scenario, briefing and constraints.
 */
export function LabNewPage() {
  const t = useT();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const queryClient = useQueryClient();
  const engines = useQuery(labEngineQueries.list());
  const runtimes = useQuery(labEngineQueries.runtimes());
  const requestedId = params.get("engine_id") ?? "";
  const requestedKey = params.get("engine") ?? "";
  const [engineId, setEngineId] = useState("");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [tagline, setTagline] = useState("");
  const [fieldCategory, setFieldCategory] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [difficulty, setDifficulty] = useState<LabCreateInput["difficulty"]>("متوسط");
  const [minutes, setMinutes] = useState("10");
  const [color, setColor] = useState<string>("blue");
  const [skills, setSkills] = useState<string[]>([]);

  const choices = useMemo(() => (engines.data?.items ?? []).filter((item) => item.status !== "archived"), [engines.data]);
  const selectedId =
    engineId ||
    choices.find((item) => item.engine_id === requestedId)?.engine_id ||
    choices.find((item) => item.key === requestedKey)?.engine_id ||
    "";
  const engine = useMemo(() => choices.find((item) => item.engine_id === selectedId), [choices, selectedId]);
  const runtime = runtimes.data?.items.find((item) => item.key === engine?.runtime_key);
  const selectedKey = engine?.runtime_key ?? "";

  const create = useMutation({
    mutationFn: () =>
      createLab({
        slug: slugify(slug || title),
        engine_key: selectedKey,
        engine_id: engine?.engine_id ?? null,
        title: title.trim(),
        tagline: tagline.trim(),
        field_category_id: fieldCategory ? Number(fieldCategory) : null,
        category_name: categoryName.trim() || null,
        difficulty,
        minutes: Number.parseInt(minutes || "10", 10),
        color,
        skills: skills as LabCreateInput["skills"],
        sort_order: 0,
        definition:
          selectedKey === "blocks"
            ? {
                scoring: {
                  dimensions: [
                    { key: "judgement", label: { ar: "الحكم", en: "Judgement" }, skill: "decision", weight: 1 },
                  ],
                },
              }
            : undefined,
      }),
    onSuccess: (lab) => {
      void queryClient.invalidateQueries({ queryKey: labsKeys.all });
      toast.success(t("أُنشئ المختبر كمسودة", "Lab created as a draft"));
      navigate(`/learning/labs/${lab.lab.lab_id}/edit`, { replace: true });
    },
  });

  if (engines.isLoading || runtimes.isLoading) return <Loading />;
  if (engines.error) return <ErrorAlert error={engines.error} />;

  const ready = selectedKey && title.trim() && (slug || title).trim().length > 1;

  return (
    <>
      <PageHead
        back={{ href: "/learning/labs", label: t("المختبرات", "Labs") }}
        title={t("مختبر جديد", "New lab")}
        sub={t(
          "اختر المحرّك (آلية التشغيل) ثم املأ بطاقة المختبر. يُنشأ سيناريو بداية تلقائيًا وتبقى المسودة غير منشورة.",
          "Pick the engine (the mechanic), then fill the lab card. A starter scenario is created and the draft stays unpublished.",
        )}
      />

      {!choices.length ? (
        <Alert kind="warning" title={t("لا محرّكات مسجّلة", "No engines registered")}>
          {t("أعد تشغيل الخادم بعد تسجيل محرّكات المختبرات.", "Restart the API after registering lab engines.")}
        </Alert>
      ) : null}

      <Card title={t("المحرّك", "Engine")}>
        <div className="ma-form-grid">
          <div className="ma-field">
            <span className="ma-label">{t("المحرّك", "Engine")} *</span>
            <SelectField
              label={t("المحرّك", "Engine")}
              size="md"
              fullWidth
              value={selectedId}
              onChange={setEngineId}
              options={choices.map((item) => ({
                value: item.engine_id,
                label: `${engineName(item)}${item.is_system ? ` · ${t("نظام", "system")}` : item.status === "draft" ? ` · ${t("مسودة", "draft")}` : ""}`,
              }))}
            />
          </div>
        </div>
        {engine ? (
          <Alert kind="info" title={engineName(engine)}>
            {(engine.description as { ar?: string })?.ar || runtime?.description}
            <div className="ma-cell-flex" style={{ gap: 6, marginBlockStart: 8, flexWrap: "wrap", alignItems: "center" }}>
              <Badge def={engine.is_system ? SYSTEM_BADGE : ENGINE_STATUS[engine.status]} />
              <span className="ma-help">
                {t("آلية التشغيل", "Runtime")} <bdi>{engine.runtime_key}</bdi>
                {engine.published_version ? ` · v${engine.published_version}` : ""}
              </span>
              <span className="ma-help">
                {runtime?.scorer === "server"
                  ? t("يُقيَّم على الخادم", "Scored on the server")
                  : t("يُقيَّم على العميل مؤقتًا", "Scored on the client for now")}
              </span>
            </div>
            {!engine.is_system && !engine.published_version ? (
              <p className="ma-help" style={{ marginBlockEnd: 0 }}>
                {t("المحرّك غير منشور بعد: يمكنك بناء المختبر ومعاينته، لكن نشره يتطلب نشر المحرّك أولًا.", "The engine is not published yet: you can build and preview the lab, but publishing it needs the engine published first.")}
              </p>
            ) : null}
          </Alert>
        ) : null}
      </Card>

      <Card title={t("بطاقة المختبر", "Lab card")}>
        <div className="ma-form-grid">
          <Field
            id="lab-title"
            label={t("العنوان", "Title")}
            value={title}
            required
            onChange={(value) => {
              setTitle(value);
              if (!slugTouched) setSlug(slugify(value));
            }}
          />
          <Field
            id="lab-slug"
            label={t("المعرّف (slug)", "Slug")}
            value={slug}
            required
            dir="ltr"
            hint={t("أحرف لاتينية صغيرة وأرقام وشرطات", "Lowercase letters, digits and dashes")}
            onChange={(value) => {
              setSlugTouched(true);
              setSlug(slugify(value));
            }}
          />
          <Field id="lab-tagline" label={t("الوصف المختصر", "Tagline")} value={tagline} onChange={setTagline} />
          <Field
            id="lab-field"
            label={t("المجال (رقم الفئة)", "Field (category id)")}
            type="number"
            value={fieldCategory}
            onChange={setFieldCategory}
          />
          <Field
            id="lab-category"
            label={t("اسم المجال", "Category name")}
            value={categoryName}
            onChange={setCategoryName}
          />
          <div className="ma-field">
            <span className="ma-label">{t("الصعوبة", "Difficulty")}</span>
            <SelectField
              label={t("الصعوبة", "Difficulty")}
              size="md"
              fullWidth
              value={difficulty}
              onChange={(value) => setDifficulty(value as LabCreateInput["difficulty"])}
              options={DIFFICULTIES.map((item) => ({ value: item, label: item }))}
            />
          </div>
          <Field id="lab-minutes" label={t("المدة (دقائق)", "Minutes")} type="number" value={minutes} onChange={setMinutes} />
          <div className="ma-field">
            <span className="ma-label">{t("اللون", "Colour")}</span>
            <SelectField
              label={t("اللون", "Colour")}
              size="md"
              fullWidth
              value={color}
              onChange={setColor}
              options={COLORS.map((item) => ({ value: item, label: item }))}
            />
          </div>
        </div>
        <div className="ma-field" style={{ marginBlockStart: "var(--space-4)" }}>
          <span className="ma-label">{t("المهارات", "Skills")}</span>
          <div className="ma-checkgroup">
            {SKILLS.map((skill) => {
              const label = SKILL_LABELS[skill];
              const checked = skills.includes(skill);
              return (
                <label key={skill} className="ma-check" style={{ justifyContent: "flex-start", gap: 8, width: "100%" }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => setSkills((prev) => (checked ? prev.filter((item) => item !== skill) : [...prev, skill]))}
                  />
                  {t(label.ar, label.en)}
                </label>
              );
            })}
          </div>
        </div>
        {create.error ? <ErrorAlert error={create.error} /> : null}
        <FormActions>
          <Button
            label={create.isPending ? t("جارٍ الإنشاء…", "Creating…") : t("إنشاء المسودة", "Create draft")}
            kind="primary"
            disabled={!ready || create.isPending}
            onClick={() => create.mutate()}
          />
          <Button kind="ghost" label={t("إلغاء", "Cancel")} onClick={() => navigate("/learning/labs")} />
        </FormActions>
      </Card>
    </>
  );
}

export default LabNewPage;
