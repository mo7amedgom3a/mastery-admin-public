import { useMemo, type ReactNode } from "react";

import { Button, Card, Field } from "@/components/ui/kit";
import { useLang, useT } from "@/lib/i18n";

import { LANGUAGE_OPTIONS, LEVEL_OPTIONS, type GeneralInfo } from "./model";
import { CheckPicker, TagInput, type PickerOption } from "./pickers";
import { ToggleField } from "./fields";
import { useCategorySuggestions, type useCatalogOptions } from "./options";

type Options = ReturnType<typeof useCatalogOptions>;

const toggled = <T,>(list: T[], value: T): T[] =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

/**
 * Hours, level, language and the access entitlement (lifetime or N days) with CPD eligibility.
 * Controlled by a plain `GeneralInfo` so the catalog form and the standalone pages share it.
 */
export function GeneralInfoCard({
  idPrefix,
  info,
  onChange,
  showLevel = true,
}: {
  idPrefix: string;
  info: GeneralInfo;
  onChange: (patch: Partial<GeneralInfo>) => void;
  showLevel?: boolean;
}) {
  const t = useT();
  return (
    <Card title={t("معلومات عامة", "General info")}>
      <div className="ma-form">
        <div className="ma-form-grid ma-form-grid--2">
          <Field
            id={`${idPrefix}-hours`}
            type="number"
            min={0}
            step="0.5"
            dir="ltr"
            label={t("عدد الساعات", "Number of hours")}
            value={info.durationHours}
            onChange={(value) => onChange({ durationHours: value })}
          />
          <Field
            id={`${idPrefix}-language`}
            label={t("اللغة", "Language")}
            options={LANGUAGE_OPTIONS.map((option) => [option.value, t(option.ar, option.en)] as [string, string])}
            value={info.language}
            onChange={(value) => onChange({ language: value })}
          />
          {showLevel ? (
            <Field
              id={`${idPrefix}-level`}
              label={t("المستوى", "Level")}
              options={[
                ["", "—"],
                ...LEVEL_OPTIONS.map((option) => [option.value, t(option.ar, option.en)] as [string, string]),
              ]}
              value={info.level}
              onChange={(value) => onChange({ level: value as GeneralInfo["level"] })}
            />
          ) : null}
        </div>
        <ToggleField
          id={`${idPrefix}-lifetime`}
          label={t("وصول مدى الحياة", "Lifetime access")}
          checked={info.lifetimeAccess}
          onChange={(checked) => onChange({ lifetimeAccess: checked })}
          hint={t(
            "عند الإيقاف يفقد المشترك الوصول بعد المدة المحددة من الشراء.",
            "When off, the buyer loses access that many days after purchase.",
          )}
        />
        {!info.lifetimeAccess ? (
          <Field
            id={`${idPrefix}-access-days`}
            type="number"
            min={1}
            step={1}
            dir="ltr"
            required
            label={t("مدة الوصول (أيام)", "Access duration (days)")}
            value={info.accessDurationDays}
            onChange={(value) => onChange({ accessDurationDays: value })}
          />
        ) : null}
        <ToggleField
          id={`${idPrefix}-cpd`}
          label={t("مؤهل لساعات الاعتماد المهني (CPD)", "Eligible for CPD credit")}
          checked={info.cpdEligible}
          onChange={(checked) => onChange({ cpdEligible: checked })}
        />
      </div>
    </Card>
  );
}

/**
 * Category-first classification. Picking categories floats their curated skills/tags to the top of
 * the pickers (the full lists stay available), and "Add suggested" applies them in one click.
 * Tags are optional (`tags` omitted for products that have none, e.g. bundles).
 */
export function ClassificationCard({
  idPrefix,
  options,
  categoryIds,
  onCategoriesChange,
  skillIds,
  onSkillsChange,
  tags,
  onTagsChange,
  showSkills = true,
  children,
}: {
  idPrefix: string;
  options: Options;
  categoryIds: string[];
  onCategoriesChange: (ids: string[]) => void;
  skillIds: string[];
  onSkillsChange: (ids: string[]) => void;
  tags?: string[];
  onTagsChange?: (tags: string[]) => void;
  showSkills?: boolean;
  children?: ReactNode;
}) {
  const t = useT();
  const lang = useLang();
  const suggestions = useCategorySuggestions(categoryIds);

  const skillOptions: PickerOption[] = useMemo(() => {
    const suggestedLabel = lang === "ar" ? "مقترح" : "Suggested";
    const suggested: PickerOption[] = [];
    const rest: PickerOption[] = [];
    for (const option of options.skillOptions) {
      if (suggestions.skillIds.has(String(option.value))) {
        suggested.push({ ...option, hint: suggestedLabel });
      } else {
        rest.push(option);
      }
    }
    return [...suggested, ...rest];
  }, [options.skillOptions, suggestions.skillIds, lang]);

  const tagSuggestions = useMemo(
    () => [...suggestions.tags, ...options.tags.filter((tag) => !suggestions.tags.includes(tag))],
    [suggestions.tags, options.tags],
  );

  const missingSkills = [...suggestions.skillIds].filter((id) => !skillIds.includes(id));
  const missingTags = suggestions.tags.filter((tag) => !(tags ?? []).includes(tag));
  const hasSuggestions = missingSkills.length > 0 || (onTagsChange != null && missingTags.length > 0);

  return (
    <Card title={t("التصنيف والوسوم", "Classification & tags")}>
      <div className="ma-form">
        <CheckPicker
          id={`${idPrefix}-categories`}
          label={t("التصنيفات", "Categories")}
          options={options.categoryOptions}
          selected={categoryIds}
          onToggle={(value) => onCategoriesChange(toggled(categoryIds, String(value)))}
          onClear={() => onCategoriesChange([])}
          searchPlaceholder={t("ابحث في التصنيفات…", "Search categories…")}
          emptyText={t("لا تصنيفات متاحة.", "No categories available.")}
          hint={t(
            "اختر التصنيف أولًا لتظهر المهارات والوسوم المقترحة له.",
            "Pick the category first to see its suggested skills and tags.",
          )}
          required
        />
        {hasSuggestions ? (
          <div>
            <Button
              sm
              label={t("إضافة المقترح للتصنيف", "Add the category's suggestions")}
              onClick={() => {
                if (showSkills) onSkillsChange([...skillIds, ...missingSkills]);
                if (onTagsChange) onTagsChange([...(tags ?? []), ...missingTags]);
              }}
            />
          </div>
        ) : null}
        {showSkills ? (
          <CheckPicker
            id={`${idPrefix}-skills`}
            label={t("المهارات", "Skills")}
            options={skillOptions}
            selected={skillIds}
            onToggle={(value) => onSkillsChange(toggled(skillIds, String(value)))}
            onClear={() => onSkillsChange([])}
            searchPlaceholder={t("ابحث في المهارات…", "Search skills…")}
            emptyText={t("لا مهارات متاحة.", "No skills available.")}
          />
        ) : null}
        {onTagsChange ? (
          <TagInput
            id={`${idPrefix}-tags`}
            label={t("الوسوم", "Tags")}
            tags={tags ?? []}
            suggestions={tagSuggestions}
            onChange={onTagsChange}
          />
        ) : null}
        {children}
      </div>
    </Card>
  );
}

/** Instructor picker; courses, diplomas and live diplomas need at least one. */
export function InstructorsCard({
  idPrefix,
  options,
  instructorIds,
  onChange,
  required = true,
}: {
  idPrefix: string;
  options: Options;
  instructorIds: number[];
  onChange: (ids: number[]) => void;
  required?: boolean;
}) {
  const t = useT();
  return (
    <Card title={t("المدربون", "Instructors")}>
      <CheckPicker
        id={`${idPrefix}-instructors`}
        label={t("اختر المدربين", "Pick instructors")}
        required={required}
        options={options.instructors.map((instructor) => ({
          value: instructor.legacy_trainer_id,
          label: instructor.name ?? `#${instructor.legacy_trainer_id}`,
        }))}
        selected={instructorIds}
        onToggle={(value) => onChange(toggled(instructorIds, Number(value)))}
        onClear={() => onChange([])}
        searchPlaceholder={t("ابحث في المدربين…", "Search instructors…")}
        emptyText={t("لا مدربون متاحون.", "No instructors available.")}
      />
    </Card>
  );
}
