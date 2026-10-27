import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { catalogQueries, createSkill } from "@/lib/api";
import { Button, Card, ErrorAlert, Field } from "@/components/ui/kit";
import { toast } from "@/components/ui/toast";
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
 * Field-first classification. A field is a top-level category; its sub-categories are picked
 * under it, and both go to the product's `category_ids` (removing a field drops its
 * sub-categories). Picking categories floats their curated skills/tags to the top of the pickers
 * (the full lists stay available), and "Add suggested" applies them in one click. A skill that
 * doesn't exist yet can be created from the skill search. Tags are optional (`tags` omitted for
 * products that have none, e.g. bundles).
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
  const [skillDraft, setSkillDraft] = useState<{ nameAr: string; nameEn: string } | null>(null);
  const [createdSkills, setCreatedSkills] = useState<PickerOption[]>([]);
  const queryClient = useQueryClient();

  const rootOf = useMemo(() => {
    const parents = options.categoryParents;
    return (id: string): string => {
      let current = id;
      for (let depth = 0; depth < 10; depth += 1) {
        const parent = parents.get(current);
        if (!parent) return current;
        current = parent;
      }
      return current;
    };
  }, [options.categoryParents]);

  const fieldIds = useMemo(() => [...new Set(categoryIds.map(rootOf))], [categoryIds, rootOf]);
  const fieldOptions = useMemo(
    () => options.categoryOptions.filter((option) => !options.categoryParents.get(String(option.value))),
    [options.categoryOptions, options.categoryParents],
  );
  const subCategoryOptions = useMemo(
    () =>
      options.categoryOptions.filter(
        (option) => options.categoryParents.get(String(option.value)) && fieldIds.includes(rootOf(String(option.value))),
      ),
    [options.categoryOptions, options.categoryParents, fieldIds, rootOf],
  );
  const subCategoryIds = categoryIds.filter((id) => !fieldIds.includes(id));

  const toggleField = (value: string) => {
    if (fieldIds.includes(value)) {
      onCategoriesChange(categoryIds.filter((id) => rootOf(id) !== value));
    } else {
      onCategoriesChange([...categoryIds, value]);
    }
  };

  const createSkillMutation = useMutation({
    mutationFn: (draft: { nameAr: string; nameEn: string }) =>
      createSkill({
        name_ar: draft.nameAr.trim(),
        name_en: draft.nameEn.trim() || null,
        category_ids: categoryIds,
      }),
    onSuccess: (skill) => {
      setSkillDraft(null);
      setCreatedSkills((prev) =>
        prev.some((option) => option.value === skill.skill_id) ? prev : [...prev, { value: skill.skill_id, label: skill.name }],
      );
      if (!skillIds.includes(skill.skill_id)) onSkillsChange([...skillIds, skill.skill_id]);
      toast.success(
        skill.created ? t(`تمت إضافة المهارة «${skill.name}»`, `Skill “${skill.name}” added`) : t("المهارة موجودة بالفعل وتم اختيارها", "That skill already existed and was selected"),
      );
      queryClient.invalidateQueries({ queryKey: catalogQueries.onboardingOptions().queryKey });
      queryClient.invalidateQueries({ queryKey: ["catalog", "category-suggestions"] });
    },
  });

  const skillOptions: PickerOption[] = useMemo(() => {
    const suggestedLabel = lang === "ar" ? "مقترح" : "Suggested";
    const newLabel = lang === "ar" ? "جديد" : "New";
    const known = new Set(options.skillOptions.map((option) => String(option.value)));
    const suggested: PickerOption[] = [];
    const rest: PickerOption[] = [];
    for (const option of options.skillOptions) {
      if (suggestions.skillIds.has(String(option.value))) {
        suggested.push({ ...option, hint: suggestedLabel });
      } else {
        rest.push(option);
      }
    }
    const created = createdSkills
      .filter((option) => !known.has(String(option.value)))
      .map((option) => ({ ...option, hint: newLabel }));
    return [...created, ...suggested, ...rest];
  }, [options.skillOptions, suggestions.skillIds, createdSkills, lang]);

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
          id={`${idPrefix}-fields`}
          label={t("المجالات", "Fields")}
          options={fieldOptions}
          selected={fieldIds}
          onToggle={(value) => toggleField(String(value))}
          onClear={() => onCategoriesChange([])}
          searchPlaceholder={t("ابحث في المجالات…", "Search fields…")}
          emptyText={t("لا مجالات متاحة.", "No fields available.")}
          hint={t(
            "اختر المجال أولًا لتظهر تصنيفاته والمهارات والوسوم المقترحة له.",
            "Pick the field first to see its categories and suggested skills and tags.",
          )}
          required
        />
        <CheckPicker
          id={`${idPrefix}-categories`}
          label={t("التصنيفات", "Categories")}
          options={subCategoryOptions}
          selected={subCategoryIds}
          onToggle={(value) => onCategoriesChange(toggled(categoryIds, String(value)))}
          onClear={() => onCategoriesChange(categoryIds.filter((id) => fieldIds.includes(id)))}
          searchPlaceholder={t("ابحث في التصنيفات…", "Search categories…")}
          emptyText={
            fieldIds.length === 0
              ? t("اختر مجالًا لعرض تصنيفاته.", "Pick a field to see its categories.")
              : t("لا تصنيفات فرعية لهذا المجال.", "This field has no sub-categories.")
          }
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
          <>
            <CheckPicker
              id={`${idPrefix}-skills`}
              label={t("المهارات", "Skills")}
              options={skillOptions}
              selected={skillIds}
              onToggle={(value) => onSkillsChange(toggled(skillIds, String(value)))}
              onClear={() => onSkillsChange([])}
              searchPlaceholder={t("ابحث في المهارات أو أضف مهارة جديدة…", "Search skills or add a new one…")}
              emptyText={t("لا مهارات متاحة.", "No skills available.")}
              onCreate={(query) =>
                setSkillDraft(/[\u0600-\u06ff]/.test(query) ? { nameAr: query, nameEn: "" } : { nameAr: query, nameEn: query })
              }
              createLabel={(query) => t(`إنشاء مهارة «${query}»`, `Create skill “${query}”`)}
            />
            {skillDraft ? (
              <div className="ma-inline-create" role="group" aria-label={t("مهارة جديدة", "New skill")}>
                <Field
                  id={`${idPrefix}-new-skill-ar`}
                  label={t("اسم المهارة بالعربية", "Skill name (Arabic)")}
                  value={skillDraft.nameAr}
                  onChange={(nameAr) => setSkillDraft((prev) => (prev ? { ...prev, nameAr } : prev))}
                  required
                />
                <Field
                  id={`${idPrefix}-new-skill-en`}
                  label={t("الاسم بالإنجليزية (يُستخدم في رابط البحث)", "English name (used for the search link)")}
                  value={skillDraft.nameEn}
                  dir="ltr"
                  onChange={(nameEn) => setSkillDraft((prev) => (prev ? { ...prev, nameEn } : prev))}
                />
                <ErrorAlert error={createSkillMutation.error} title={t("تعذّر إنشاء المهارة", "Couldn't create the skill")} />
                <div className="ma-inline-create__actions">
                  <Button
                    sm
                    kind="secondary"
                    icon="plus"
                    label={createSkillMutation.isPending ? t("جارٍ الإنشاء…", "Creating…") : t("إنشاء المهارة", "Create skill")}
                    disabled={createSkillMutation.isPending || !skillDraft.nameAr.trim()}
                    onClick={() => createSkillMutation.mutate(skillDraft)}
                  />
                  <Button sm kind="soft" label={t("إلغاء", "Cancel")} onClick={() => setSkillDraft(null)} />
                </div>
              </div>
            ) : null}
          </>
        ) : null}
        {onTagsChange ? (
          <TagInput
            id={`${idPrefix}-tags`}
            label={t("الوسوم", "Tags")}
            tags={tags ?? []}
            suggestions={tagSuggestions}
            onChange={onTagsChange}
            hint={t("اكتب وسمًا جديدًا ثم Enter، أو اختر من المقترح.", "Type a new tag then Enter, or pick a suggestion.")}
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
