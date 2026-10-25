import { queryOptions } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api/client";

export interface CurriculumLesson {
  id: number;
  unit_id: number;
  name: string;
  duration?: number | null;
  order?: number | null;
  link?: string | null;
  link2?: string | null;
  notes?: string | null;
  body?: string | null;
  is_free: boolean;
  file_id?: number | null;
  file_name?: string | null;
  asset_url?: string | null;
}

export interface CurriculumUnit {
  id: number;
  course_id: number;
  name: string;
  description?: string | null;
  order?: number | null;
  duration?: number | null;
  lessons_count: number;
  lessons: CurriculumLesson[];
}

export interface CreateUnitInput {
  name: string;
  description?: string | null;
  order?: number | null;
  duration?: number | null;
}

export interface UpdateUnitInput {
  name?: string | null;
  description?: string | null;
  order?: number | null;
  duration?: number | null;
}

export interface CreateLessonInput {
  name: string;
  duration?: number | null;
  order?: number | null;
  link?: string | null;
  link2?: string | null;
  notes?: string | null;
  body?: string | null;
  is_free?: boolean;
  file_id?: number | null;
}

export interface UpdateLessonInput {
  name?: string | null;
  duration?: number | null;
  order?: number | null;
  link?: string | null;
  link2?: string | null;
  notes?: string | null;
  body?: string | null;
  is_free?: boolean | null;
  file_id?: number | null;
}

export const curriculumKeys = {
  all: ["curriculum"] as const,
  units: (productRef: string) => [...curriculumKeys.all, "units", productRef] as const,
};

export const curriculumPaths = {
  units: "admin/catalog/products/{product_ref}/units",
  unit: "admin/catalog/products/{product_ref}/units/{unit_id}",
  unitReorder: "admin/catalog/products/{product_ref}/units/reorder",
  lessons: "admin/catalog/products/{product_ref}/units/{unit_id}/lessons",
  lesson: "admin/catalog/products/{product_ref}/units/{unit_id}/lessons/{lesson_id}",
  lessonReorder: "admin/catalog/products/{product_ref}/units/{unit_id}/lessons/reorder",
} as const;

export function getCurriculumUnits(productRef: string): Promise<CurriculumUnit[]> {
  return apiGet<CurriculumUnit[]>(curriculumPaths.units, { path: { product_ref: productRef } });
}

export function createCurriculumUnit(productRef: string, input: CreateUnitInput): Promise<CurriculumUnit> {
  return apiPost<CurriculumUnit>(curriculumPaths.units, { body: input, path: { product_ref: productRef } });
}

export function updateCurriculumUnit(productRef: string, unitId: number, input: UpdateUnitInput): Promise<CurriculumUnit> {
  return apiPut<CurriculumUnit>(curriculumPaths.unit, { body: input, path: { product_ref: productRef, unit_id: unitId } });
}

export function deleteCurriculumUnit(productRef: string, unitId: number): Promise<void> {
  return apiDelete<void>(curriculumPaths.unit, { path: { product_ref: productRef, unit_id: unitId } });
}

export function reorderCurriculumUnits(productRef: string, ids: number[]): Promise<void> {
  return apiPost<void>(curriculumPaths.unitReorder, { body: { ids }, path: { product_ref: productRef } });
}

export function createCurriculumLesson(productRef: string, unitId: number, input: CreateLessonInput): Promise<CurriculumLesson> {
  return apiPost<CurriculumLesson>(curriculumPaths.lessons, { body: input, path: { product_ref: productRef, unit_id: unitId } });
}

export function updateCurriculumLesson(productRef: string, unitId: number, lessonId: number, input: UpdateLessonInput): Promise<CurriculumLesson> {
  return apiPut<CurriculumLesson>(curriculumPaths.lesson, { body: input, path: { product_ref: productRef, unit_id: unitId, lesson_id: lessonId } });
}

export function deleteCurriculumLesson(productRef: string, unitId: number, lessonId: number): Promise<void> {
  return apiDelete<void>(curriculumPaths.lesson, { path: { product_ref: productRef, unit_id: unitId, lesson_id: lessonId } });
}

export function reorderCurriculumLessons(productRef: string, unitId: number, ids: number[]): Promise<void> {
  return apiPost<void>(curriculumPaths.lessonReorder, { body: { ids }, path: { product_ref: productRef, unit_id: unitId } });
}

export const curriculumQueries = {
  units: (productRef: string) =>
    queryOptions({
      queryKey: curriculumKeys.units(productRef),
      queryFn: () => getCurriculumUnits(productRef),
    }),
};
