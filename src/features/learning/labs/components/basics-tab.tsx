import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { labsKeys, updateLab, type LabCardInput, type LabDetail } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Button, Card, ErrorAlert, Field, FormActions } from "@/components/ui/kit";
import { SelectField } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";

import { COLORS, DIFFICULTIES, SKILLS, SKILL_LABELS, slugify } from "../model";

type Card = {
  title: string;
  slug: string;
  tagline: string;
  category_name: string;
  field_category_id: string;
  difficulty: string;
  minutes: string;
  color: string;
  sort_order: string;
  skills: string[];
};

function cardOf(detail: LabDetail): Card {
  const lab = detail.lab;
  return {
    title: lab.title,
    slug: lab.slug,
    tagline: lab.tagline,
    category_name: lab.category_name ?? "",
    field_category_id: lab.field_category_id == null ? "" : String(lab.field_category_id),
    difficulty: lab.difficulty,
    minutes: String(lab.minutes),
    color: lab.color,
    sort_order: String(lab.sort_order),
    skills: [...lab.skills],
  };
}

/** Basics tab: the relational card fields (title, slug, field, difficulty, minutes, skills…). */
export function BasicsTab({ detail, canWrite, engineKey }: { detail: LabDetail; canWrite: boolean; engineKey: string }) {
  const t = useT();
  const queryClient = useQueryClient();
  const [card, setCard] = useState<Card>(() => cardOf(detail));
  const original = JSON.stringify(cardOf(detail));
  const dirty = JSON.stringify(card) !== original;
  const set = <K extends keyof Card>(key: K) => (value: Card[K]) => setCard((prev) => ({ ...prev, [key]: value }));

  const save = useMutation({
    mutationFn: () =>
      updateLab(detail.lab.lab_id, {
        title: card.title.trim(),
        slug: slugify(card.slug || card.title),
        tagline: card.tagline.trim(),
        category_name: card.category_name.trim() || null,
        field_category_id: card.field_category_id ? Number(card.field_category_id) : null,
        difficulty: card.difficulty as LabCardInput["difficulty"],
        minutes: Number.parseInt(card.minutes || "10", 10),
        color: card.color,
        sort_order: Number.parseInt(card.sort_order || "0", 10),
        skills: card.skills as LabCardInput["skills"],
      }),
    onSuccess: () => {
      toast.success(t("حُفظت بطاقة المختبر", "Lab card saved"));
      void queryClient.invalidateQueries({ queryKey: labsKeys.detail(detail.lab.lab_id) });
      void queryClient.invalidateQueries({ queryKey: labsKeys.list() });
    },
  });

  return (
    <Card title={t("بطاقة المختبر", "Lab card")}>
      <p className="ma-help">
        {t(
          "هذه الحقول أعمدة علائقية تُستخدم في القوائم والفلاتر. المحرّك ثابت بعد الإنشاء (سيناريوهات المختبر مبنية عليه).",
          "These fields are relational columns used by lists and filters. The engine is fixed after creation (scenarios depend on it).",
        )}
      </p>
      <div className="ma-form-grid">
        <Field id="basics-title" label={t("العنوان", "Title")} value={card.title} required onChange={set("title")} />
        <Field id="basics-slug" label={t("المعرّف", "Slug")} value={card.slug} dir="ltr" required onChange={(v) => set("slug")(slugify(v))} />
        <Field id="basics-engine" label={t("المحرّك", "Engine")} value={engineKey} onChange={() => undefined} hint={t("غير قابل للتغيير", "Cannot be changed")} disabled />
        <Field id="basics-tagline" label={t("الوصف المختصر", "Tagline")} value={card.tagline} onChange={set("tagline")} />
        <Field id="basics-category" label={t("اسم المجال", "Category name")} value={card.category_name} onChange={set("category_name")} />
        <Field id="basics-field" label={t("المجال (رقم الفئة)", "Field (category id)")} type="number" value={card.field_category_id} onChange={set("field_category_id")} />
        <div className="ma-field">
          <span className="ma-label">{t("الصعوبة", "Difficulty")}</span>
          <SelectField
            label={t("الصعوبة", "Difficulty")}
            size="md"
            fullWidth
            value={card.difficulty}
            onChange={set("difficulty")}
            options={DIFFICULTIES.map((item) => ({ value: item, label: item }))}
          />
        </div>
        <Field id="basics-minutes" label={t("المدة (دقائق)", "Minutes")} type="number" value={card.minutes} onChange={set("minutes")} />
        <div className="ma-field">
          <span className="ma-label">{t("اللون", "Colour")}</span>
          <SelectField
            label={t("اللون", "Colour")}
            size="md"
            fullWidth
            value={card.color}
            onChange={set("color")}
            options={COLORS.map((item) => ({ value: item, label: item }))}
          />
        </div>
        <Field id="basics-sort" label={t("الترتيب", "Sort order")} type="number" value={card.sort_order} onChange={set("sort_order")} />
      </div>
      <div className="ma-field" style={{ marginBlockStart: "var(--space-4)" }}>
        <span className="ma-label">{t("المهارات", "Skills")}</span>
        <div className="ma-checkgroup">
          {SKILLS.map((skill) => {
            const checked = card.skills.includes(skill);
            return (
              <label key={skill} className="ma-check" style={{ justifyContent: "flex-start", gap: 8, width: "100%" }}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!canWrite}
                  onChange={() =>
                    set("skills")(checked ? card.skills.filter((item) => item !== skill) : [...card.skills, skill])
                  }
                />
                {t(SKILL_LABELS[skill].ar, SKILL_LABELS[skill].en)}
              </label>
            );
          })}
        </div>
      </div>
      {save.error ? <ErrorAlert error={save.error} /> : null}
      <FormActions>
        <Button
          kind="primary"
          label={save.isPending ? t("جارٍ الحفظ…", "Saving…") : t("حفظ البطاقة", "Save card")}
          disabled={!canWrite || !dirty || save.isPending}
          onClick={() => save.mutate()}
        />
        <Button kind="ghost" label={t("تراجع", "Reset")} disabled={!dirty} onClick={() => setCard(cardOf(detail))} />
      </FormActions>
    </Card>
  );
}
