import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { catalogQueries, expertProfilesKeys, putExpertExpertise, type ExpertProfileDetail } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { toast } from "@/components/ui/toast";
import { Button, Card, ErrorAlert, FormActions } from "@/components/ui/kit";
import { CheckPicker, SelectedChips, type PickerOption } from "@/features/learning/product-form/pickers";

/*
 * The fields (categories) and skills the expert page shows under «المجالات والمهارات». While none are saved the
 * storefront falls back to the categories and skills of the expert's published items. Suggestions come from all
 * their items, drafts included (skills not from packages or bundles, which mix other experts' courses).
 */

const MAX_CATEGORIES = 5;
const MAX_SKILLS = 20;

type Selection = { categoryIds: string[]; skillIds: string[] };

function selectionOf(expert: ExpertProfileDetail): Selection {
  return {
    categoryIds: (expert.categories ?? []).map((item) => item.category_id),
    skillIds: (expert.skills ?? []).map((item) => item.skill_id),
  };
}

const toggled = (ids: string[], id: string) => (ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]);
const same = (a: string[], b: string[]) => a.length === b.length && a.every((value, index) => value === b[index]);

export function ExpertExpertiseCard({ expert }: { expert: ExpertProfileDetail }) {
  const t = useT();
  const queryClient = useQueryClient();
  const categories = useQuery(catalogQueries.categories());
  const onboarding = useQuery(catalogQueries.onboardingOptions());
  const initial = selectionOf(expert);
  const [selection, setSelection] = useState<Selection>(initial);
  const dirty = !same(initial.categoryIds, selection.categoryIds) || !same(initial.skillIds, selection.skillIds);
  const tooMany = selection.categoryIds.length > MAX_CATEGORIES || selection.skillIds.length > MAX_SKILLS;

  const categoryOptions: PickerOption[] = (categories.data ?? []).map((category) => ({
    value: category.category_id,
    label: category.name ?? category.slug,
  }));
  const skillOptions: PickerOption[] = (onboarding.data?.skills ?? []).map((skill) => ({ value: skill.skill_id, label: skill.name }));
  // Saved and suggested names cover ids the option lists don't have yet (still loading, or an inactive skill).
  const names = new Map<string, string>([
    ...categoryOptions.map((option) => [String(option.value), option.label] as [string, string]),
    ...skillOptions.map((option) => [String(option.value), option.label] as [string, string]),
    ...[...(expert.categories ?? []), ...(expert.suggested_categories ?? [])].map((item) => [item.category_id, item.name] as [string, string]),
    ...[...(expert.skills ?? []), ...(expert.suggested_skills ?? [])].map((item) => [item.skill_id, item.name] as [string, string]),
  ]);
  const chips = (ids: string[]) => ids.map((id) => ({ value: id, label: names.get(id) ?? id }));

  const suggested: Selection = {
    categoryIds: (expert.suggested_categories ?? []).map((item) => item.category_id),
    skillIds: (expert.suggested_skills ?? []).map((item) => item.skill_id).slice(0, 12),
  };
  const hasSuggestions = suggested.categoryIds.length > 0 || suggested.skillIds.length > 0;
  const usingFallback = initial.categoryIds.length === 0 && initial.skillIds.length === 0;

  const save = useMutation({
    mutationFn: () => putExpertExpertise(expert.key, { category_ids: selection.categoryIds, skill_ids: selection.skillIds }),
    onSuccess: (next) => {
      toast.success(t("تم حفظ المجالات والمهارات", "Fields & skills saved"));
      setSelection(selectionOf(next));
      queryClient.setQueryData(expertProfilesKeys.detail(expert.key), next);
      queryClient.invalidateQueries({ queryKey: expertProfilesKeys.all });
    },
  });

  return (
    <Card title={t("المجالات والمهارات", "Fields & skills")}>
      <form
        className="ma-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (dirty && !tooMany) save.mutate();
        }}
      >
        <p className="ma-help">
          {usingFallback
            ? t(
                "لم تُحفظ مجالات بعد: صفحة الخبير تعرض تصنيفات ومهارات منتجاته المنشورة.",
                "Nothing saved yet: the expert page shows the categories and skills of their published products.",
              )
            : t("تظهر في صفحة الخبير بهذا الترتيب.", "Shown on the expert page in this order.")}
        </p>

        <SelectedChips
          items={chips(selection.categoryIds)}
          onRemove={(value) => setSelection((current) => ({ ...current, categoryIds: toggled(current.categoryIds, String(value)) }))}
        />
        <CheckPicker
          id="expert-fields"
          label={t(`المجالات (حتى ${MAX_CATEGORIES})`, `Fields (up to ${MAX_CATEGORIES})`)}
          options={categoryOptions}
          selected={selection.categoryIds}
          onToggle={(value) => setSelection((current) => ({ ...current, categoryIds: toggled(current.categoryIds, String(value)) }))}
          onClear={() => setSelection((current) => ({ ...current, categoryIds: [] }))}
          searchPlaceholder={t("ابحث في التصنيفات…", "Search categories…")}
          emptyText={t("لا تصنيفات متاحة.", "No categories available.")}
        />

        <SelectedChips
          items={chips(selection.skillIds)}
          onRemove={(value) => setSelection((current) => ({ ...current, skillIds: toggled(current.skillIds, String(value)) }))}
        />
        <CheckPicker
          id="expert-skills"
          label={t(`المهارات (حتى ${MAX_SKILLS})`, `Skills (up to ${MAX_SKILLS})`)}
          options={skillOptions}
          selected={selection.skillIds}
          onToggle={(value) => setSelection((current) => ({ ...current, skillIds: toggled(current.skillIds, String(value)) }))}
          onClear={() => setSelection((current) => ({ ...current, skillIds: [] }))}
          searchPlaceholder={t("ابحث في المهارات…", "Search skills…")}
          emptyText={t("لا مهارات متاحة.", "No skills available.")}
        />

        {tooMany ? (
          <p className="ma-help" role="alert">
            {t(
              `اختر حتى ${MAX_CATEGORIES} مجالات و${MAX_SKILLS} مهارة.`,
              `Pick up to ${MAX_CATEGORIES} fields and ${MAX_SKILLS} skills.`,
            )}
          </p>
        ) : null}
        <ErrorAlert error={save.error} title={t("تعذّر حفظ المجالات والمهارات", "Couldn't save fields & skills")} />
        <FormActions>
          <Button
            type="submit"
            kind="primary"
            icon="check"
            disabled={save.isPending || !dirty || tooMany}
            label={save.isPending ? t("جارٍ الحفظ…", "Saving…") : t("حفظ", "Save")}
          />
          {hasSuggestions ? (
            <Button
              kind="ghost"
              label={t("استخدام المقترح من منتجاته", "Use suggestions from their products")}
              onClick={() => setSelection(suggested)}
            />
          ) : null}
          {dirty ? <Button kind="ghost" label={t("تجاهل التغييرات", "Discard changes")} onClick={() => setSelection(initial)} /> : null}
        </FormActions>
      </form>
    </Card>
  );
}
