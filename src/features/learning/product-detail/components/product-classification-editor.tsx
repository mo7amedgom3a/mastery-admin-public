import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { catalogQueries, productKeys, searchKeys, updateProduct, type ProductView } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { toast } from "@/components/ui/toast";
import { Button, ErrorAlert, FormActions } from "@/components/ui/kit";
import { ClassificationCard, useCatalogOptions } from "@/features/learning/product-form";

type Selection = { categoryIds: string[]; skillIds: string[]; tags: string[] };

const selectionOf = (data: ProductView): Selection => ({
  categoryIds: (data.b2c?.category_ids ?? []).map(String),
  skillIds: (data.b2c?.skills ?? []).map((skill) => skill.skill_id),
  tags: data.b2c?.admin_tags ?? [],
});

const same = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");

/**
 * Attach a B2C course/diploma to its field (top-level category), sub-categories, skills and tags
 * after creation — the same picker the create page uses, saved through
 * `PATCH /admin/catalog/products/{ref}` (`category_ids`, `skill_ids`, `keywords`). The backend then
 * refreshes the storefront's search and course page caches, so `/search` filters see the change.
 */
export function ProductClassificationEditor({ productRef, data }: { productRef: string; data: ProductView }) {
  const t = useT();
  const queryClient = useQueryClient();
  const options = useCatalogOptions();
  const initial = selectionOf(data);
  const [selection, setSelection] = useState<Selection>(initial);
  const dirty =
    !same(initial.categoryIds, selection.categoryIds) ||
    !same(initial.skillIds, selection.skillIds) ||
    !same(initial.tags, selection.tags);
  const invalid = selection.categoryIds.length === 0;

  const save = useMutation({
    mutationFn: () =>
      updateProduct(productRef, {
        category_ids: selection.categoryIds,
        skill_ids: selection.skillIds,
        keywords: selection.tags,
      }),
    onSuccess: (next) => {
      toast.success(t("تم حفظ التصنيف", "Classification saved"));
      setSelection(selectionOf(next));
      queryClient.setQueryData(productKeys.detail(productRef), next);
      queryClient.invalidateQueries({ queryKey: productKeys.all });
      // New tags/skills show up in the pickers' suggestion lists.
      queryClient.invalidateQueries({ queryKey: [...searchKeys.all, "options"] });
      queryClient.invalidateQueries({ queryKey: catalogQueries.onboardingOptions().queryKey });
    },
  });

  if (!data.b2c) return null;

  return (
    <form
      className="ma-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!invalid && dirty) save.mutate();
      }}
    >
      <ClassificationCard
        idPrefix="classification"
        options={options}
        categoryIds={selection.categoryIds}
        onCategoriesChange={(categoryIds) => setSelection((prev) => ({ ...prev, categoryIds }))}
        skillIds={selection.skillIds}
        onSkillsChange={(skillIds) => setSelection((prev) => ({ ...prev, skillIds }))}
        tags={selection.tags}
        onTagsChange={(tags) => setSelection((prev) => ({ ...prev, tags }))}
      >
        {invalid ? (
          <p className="ma-help" role="alert">
            {t("اختر مجالًا واحدًا على الأقل.", "Pick at least one field.")}
          </p>
        ) : null}
        <ErrorAlert error={save.error} title={t("تعذّر حفظ التصنيف", "Couldn't save the classification")} />
        <FormActions>
          <Button
            type="submit"
            kind="primary"
            icon="check"
            disabled={save.isPending || !dirty || invalid}
            label={save.isPending ? t("جارٍ الحفظ…", "Saving…") : t("حفظ التصنيف", "Save classification")}
          />
          {dirty ? (
            <Button kind="ghost" label={t("تجاهل التغييرات", "Discard changes")} onClick={() => setSelection(initial)} />
          ) : null}
        </FormActions>
      </ClassificationCard>
    </form>
  );
}
