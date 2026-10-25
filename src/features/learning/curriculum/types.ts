import type { CurriculumLesson, CurriculumUnit } from "@/lib/api";

export type UnitModalState =
  | { mode: "create" }
  | { mode: "edit"; unit: CurriculumUnit }
  | null;

export type LessonModalState =
  | { mode: "create"; unitId: number }
  | { mode: "edit"; unitId: number; lesson: CurriculumLesson }
  | null;
