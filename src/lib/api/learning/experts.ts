import { queryOptions } from "@tanstack/react-query";

import { apiGet } from "@/lib/api/client";
import type { PathParams, SuccessResponse } from "@/lib/api/operation-types";

/*
 * Public expert profile, read from B2C (`GET /catalog/experts/{key}`): the person (a trainer by their id, a
 * consultant-only expert as `c{id}`, or a B2C-only expert by uuid) with their courses, diplomas, packages and
 * consultations. The B2C cards are adapted to the row shapes the instructor page renders.
 */

type ExpertOp = "expert_api_v1_catalog_experts__key__get";
type RawExpert = SuccessResponse<ExpertOp>;
type Card = NonNullable<RawExpert["courses"]>[number];

export type ExpertProfile = {
  key: string;
  name: string;
  profile_image: string | null;
  trainer_id: number | null;
  consultant_ids: number[];
};
type Priced = { price: number | null; current_price: { price: number } | null; active: boolean; image: string | null };
export type ExpertCourse = Priced & { id: number; name: string; category_name: string | null; duration: number | null };
export type ExpertPackage = Priced & { id: number; name: string; course_count: number };
export type ExpertConsultation = Priced & { id: number; name: string; number_of_sessions: number; available_slot_count: number };
export type ExpertCategory = { id: number; name: string; description?: string | null };
export type ExpertHighlights = { what_i_do: string[]; who_i_help: string[]; source: string };
export type ExpertDetail = {
  expert: ExpertProfile;
  categories: ExpertCategory[];
  courses: ExpertCourse[];
  diplomas: ExpertCourse[];
  packages: ExpertPackage[];
  consultations: ExpertConsultation[];
  highlights: ExpertHighlights;
};

export const expertsPaths = {
  expert: "catalog/experts/{key}",
} as const;

export const expertsKeys = {
  all: ["learning", "experts"] as const,
  detail: (key: string) => [...expertsKeys.all, "detail", key] as const,
};

const idOf = (card: Card) => Number(card.slug.match(/(\d+)$/)?.[1] ?? 0);
const priced = (card: Card): Priced => ({
  price: card.price?.amount ?? null,
  current_price: card.price ? { price: card.price.amount } : null,
  active: true,
  image: card.image ?? null,
});

function adapt(raw: RawExpert): ExpertDetail {
  const key = raw.expert.key;
  const consultantOnly = /^c\d+$/.test(key);
  const course = (card: Card): ExpertCourse => ({
    ...priced(card),
    id: idOf(card),
    name: card.title ?? card.slug,
    category_name: card.category ?? null,
    duration: card.duration_seconds ? Math.round((card.duration_seconds / 3600) * 10) / 10 : null,
  });
  return {
    expert: {
      key,
      name: raw.expert.name?.trim(),
      profile_image: raw.expert.avatar ?? null,
      trainer_id: /^\d+$/.test(key) ? Number(key) : null,
      consultant_ids: consultantOnly ? [Number(key.slice(1))] : [],
    },
    categories: (raw.categories ?? []).map((name, index) => ({ id: index + 1, name })),
    courses: (raw.courses ?? []).map(course),
    diplomas: (raw.diplomas ?? []).map(course),
    packages: (raw.packages ?? []).map((card) => ({ ...priced(card), id: idOf(card), name: card.title ?? card.slug, course_count: 0 })),
    consultations: (raw.consultations ?? []).map((card) => ({
      ...priced(card),
      id: idOf(card),
      name: card.title ?? card.slug,
      number_of_sessions: 1,
      available_slot_count: 0,
    })),
    highlights: {
      what_i_do: raw.highlights?.what_i_do ?? [],
      who_i_help: raw.highlights?.who_i_help ?? [],
      source: raw.highlights?.source ?? "extracted",
    },
  };
}

/** `GET /catalog/experts/{key}` — one public expert profile with everything they offer. */
export async function getExpert(key: PathParams<ExpertOp>["key"]): Promise<ExpertDetail> {
  return adapt(await apiGet<RawExpert>(expertsPaths.expert, { path: { key } }));
}

export const expertsQueries = {
  detail: (key: string) => queryOptions({ queryKey: expertsKeys.detail(key), queryFn: () => getExpert(key) }),
};
