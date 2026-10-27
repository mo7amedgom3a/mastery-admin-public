import { useQueries, useQuery } from "@tanstack/react-query";

import { catalogQueries, consultantsQueries, instructorsQueries, searchQueries } from "@/lib/api";

import type { PickerOption } from "./pickers";

/**
 * Every option list the product pages need.
 *
 * Ids come from the catalog reads the create endpoints accept (`/catalog/categories` gives the
 * category UUIDs, `/catalog/onboarding-options` the skill UUIDs), and the human names + product
 * counts come from `/search/options` — the same facet vocabulary the storefront search page uses —
 * so a picker reads "التسويق المتكامل · 12" the way search does. Fetched once per page and cached.
 */
export function useCatalogOptions() {
  const onboarding = useQuery(catalogQueries.onboardingOptions());
  const categories = useQuery(catalogQueries.categories());
  const facets = useQuery(searchQueries.options());
  const instructors = useQuery(instructorsQueries.adminList({ limit: 200 }));
  const consultants = useQuery(consultantsQueries.list({ limit: 200 }));

  const countsByCode = (options?: { code: string; count: number }[]) =>
    new Map((options ?? []).map((option) => [option.code, option.count]));

  const categoryCounts = countsByCode(facets.data?.categories);
  const skillCounts = countsByCode(facets.data?.skills);

  /** Category options keyed by the UUID the create endpoint wants. */
  const categoryOptions: PickerOption[] = (categories.data ?? []).map((category) => {
    const count = categoryCounts.get(category.slug) ?? category.product_count;
    return {
      value: category.category_id,
      label: category.name ?? category.slug,
      hint: count != null ? String(count) : undefined,
    };
  });

  /** Each category's parent (`null` for a field, i.e. a top-level category). */
  const categoryParents = new Map((categories.data ?? []).map((category) => [category.category_id, category.parent_id]));

  /** Skill options keyed by the UUID the create endpoint wants. */
  const skillOptions: PickerOption[] = (onboarding.data?.skills ?? []).map((skill) => ({
    value: skill.skill_id,
    label: skill.name,
    hint: skillCounts.has(skill.slug) ? String(skillCounts.get(skill.slug)) : undefined,
  }));

  /** Tag options with counts; search facets first, onboarding tags as the fallback. */
  const tagOptions: { value: string; label: string; count: number }[] = facets.data?.tags?.length
    ? facets.data.tags.map((tag) => ({ value: tag.code, label: tag.name, count: tag.count }))
    : (onboarding.data?.tags ?? []).map((tag) => ({ value: tag.tag, label: tag.tag, count: tag.count }));

  /** Product types with counts (course, diploma, package, bundle, consultation, live_diploma). */
  const productTypes = facets.data?.product_types ?? onboarding.data?.product_types ?? [];

  return {
    categoryOptions,
    categoryParents,
    skillOptions,
    tagOptions,
    productTypes,
    /** Suggestion labels for the keyword/tag input. */
    tags: tagOptions.map((tag) => tag.label),
    instructors: instructors.data?.items ?? [],
    consultants: consultants.data?.items ?? [],
    isLoading:
      onboarding.isLoading || categories.isLoading || instructors.isLoading || consultants.isLoading,
  };
}

/** Slim published product cards for the package/bundle member pickers. */
export function useProductCards(productTypes: string[]) {
  const pages = useQueries({
    queries: [0, 200, 400].map((offset) => catalogQueries.cards({ product_type: productTypes, limit: 200, offset })),
  });
  return { cards: pages.flatMap((page) => page.data?.items ?? []), isLoading: pages.some((page) => page.isLoading) };
}

/**
 * The skills and tags curated for the picked categories (union, in pick order). The pickers show
 * these first; nothing is ever removed from a selection because a category changed.
 */
export function useCategorySuggestions(categoryIds: string[]) {
  const results = useQueries({ queries: categoryIds.map((id) => catalogQueries.categorySuggestions(id)) });
  const skillIds = new Set<string>();
  const tags = new Set<string>();
  for (const result of results) {
    for (const id of result.data?.skill_ids ?? []) skillIds.add(id);
    for (const tag of result.data?.tags ?? []) tags.add(tag);
  }
  return { skillIds, tags: [...tags], isLoading: results.some((result) => result.isLoading) };
}
