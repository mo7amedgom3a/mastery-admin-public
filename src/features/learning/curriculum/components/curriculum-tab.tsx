import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { can } from "@/lib/permissions";
import {
  createCurriculumLesson,
  createCurriculumUnit,
  curriculumKeys,
  curriculumQueries,
  deleteCurriculumLesson,
  deleteCurriculumUnit,
  reorderCurriculumLessons,
  reorderCurriculumUnits,
  studioKeys,
  updateCurriculumLesson,
  updateCurriculumUnit,
  type CreateLessonInput,
  type CreateUnitInput,
  type CurriculumLesson,
  type CurriculumUnit,
  type UpdateLessonInput,
  type UpdateUnitInput,
} from "@/lib/api";
import { CurriculumView } from "./curriculum-view";
import { UnitModal } from "./unit-modal";
import { LessonModal } from "./lesson-modal";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useT } from "@/lib/i18n";
import { toast } from "@/components/ui/toast";
import type { LessonModalState, UnitModalState } from "../types";

export function CurriculumTab({ productRef }: { productRef: string }) {
  const t = useT();
  const queryClient = useQueryClient();
  const canEdit = can("catalog.write") || can("studio.edit");

  const [unitModal, setUnitModal] = useState<UnitModalState>(null);
  const [lessonModal, setLessonModal] = useState<LessonModalState>(null);
  const [deleteTarget, setDeleteTarget] = useState<
    | { type: "unit"; unit: CurriculumUnit }
    | { type: "lesson"; unit: CurriculumUnit; lesson: CurriculumLesson }
    | null
  >(null);

  const unitsQuery = useQuery(curriculumQueries.units(productRef));
  const units = unitsQuery.data ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: curriculumKeys.units(productRef) });
    queryClient.invalidateQueries({ queryKey: studioKeys.previewBase(productRef) });
  };

  // Unit Mutations
  const createUnit = useMutation({
    mutationFn: (data: CreateUnitInput) => createCurriculumUnit(productRef, data),
    onSuccess: () => {
      toast.success(t("تمت إضافة القسم بنجاح", "Unit added successfully"));
      invalidate();
      setUnitModal(null);
    },
    onError: (err: unknown) => {
      toast.error(
        t("فشل في إضافة القسم", "Failed to add unit"),
        err instanceof Error ? err.message : undefined
      );
    },
  });

  const updateUnit = useMutation({
    mutationFn: ({ unitId, data }: { unitId: number; data: UpdateUnitInput }) =>
      updateCurriculumUnit(productRef, unitId, data),
    onSuccess: () => {
      toast.success(t("تم تحديث القسم بنجاح", "Unit updated successfully"));
      invalidate();
      setUnitModal(null);
    },
    onError: (err: unknown) => {
      toast.error(
        t("فشل في تحديث القسم", "Failed to update unit"),
        err instanceof Error ? err.message : undefined
      );
    },
  });

  const deleteUnit = useMutation({
    mutationFn: (unitId: number) => deleteCurriculumUnit(productRef, unitId),
    onSuccess: () => {
      toast.success(t("تم حذف القسم بنجاح", "Unit deleted successfully"));
      invalidate();
      setDeleteTarget(null);
    },
    onError: (err: unknown) => {
      toast.error(
        t("فشل في حذف القسم", "Failed to delete unit"),
        err instanceof Error ? err.message : undefined
      );
    },
  });

  const reorderUnits = useMutation({
    mutationFn: (ids: number[]) => reorderCurriculumUnits(productRef, ids),
    onSuccess: () => {
      toast.success(t("تم تحديث ترتيب الأقسام", "Units reordered successfully"));
      invalidate();
    },
    onError: (err: unknown) => {
      toast.error(
        t("فشل في تحديث ترتيب الأقسام", "Failed to reorder units"),
        err instanceof Error ? err.message : undefined
      );
    },
  });

  // Lesson Mutations
  const createLesson = useMutation({
    mutationFn: ({ unitId, data }: { unitId: number; data: CreateLessonInput }) =>
      createCurriculumLesson(productRef, unitId, data),
    onSuccess: () => {
      toast.success(t("تمت إضافة الدرس بنجاح", "Lesson added successfully"));
      invalidate();
      setLessonModal(null);
    },
    onError: (err: unknown) => {
      toast.error(
        t("فشل في إضافة الدرس", "Failed to add lesson"),
        err instanceof Error ? err.message : undefined
      );
    },
  });

  const updateLesson = useMutation({
    mutationFn: ({ unitId, lessonId, data }: { unitId: number; lessonId: number; data: UpdateLessonInput }) =>
      updateCurriculumLesson(productRef, unitId, lessonId, data),
    onSuccess: () => {
      toast.success(t("تم تحديث الدرس بنجاح", "Lesson updated successfully"));
      invalidate();
      setLessonModal(null);
    },
    onError: (err: unknown) => {
      toast.error(
        t("فشل في تحديث الدرس", "Failed to update lesson"),
        err instanceof Error ? err.message : undefined
      );
    },
  });

  const deleteLesson = useMutation({
    mutationFn: ({ unitId, lessonId }: { unitId: number; lessonId: number }) =>
      deleteCurriculumLesson(productRef, unitId, lessonId),
    onSuccess: () => {
      toast.success(t("تم حذف الدرس بنجاح", "Lesson deleted successfully"));
      invalidate();
      setDeleteTarget(null);
    },
    onError: (err: unknown) => {
      toast.error(
        t("فشل في حذف الدرس", "Failed to delete lesson"),
        err instanceof Error ? err.message : undefined
      );
    },
  });

  const reorderLessons = useMutation({
    mutationFn: ({ unitId, ids }: { unitId: number; ids: number[] }) =>
      reorderCurriculumLessons(productRef, unitId, ids),
    onSuccess: () => {
      toast.success(t("تم تحديث ترتيب الدروس", "Lessons reordered successfully"));
      invalidate();
    },
    onError: (err: unknown) => {
      toast.error(
        t("فشل في تحديث ترتيب الدروس", "Failed to reorder lessons"),
        err instanceof Error ? err.message : undefined
      );
    },
  });

  // Reorder handlers with optimistic cache updates
  const handleReorderUnits = (sourceIndex: number, targetIndex: number) => {
    if (sourceIndex === targetIndex || targetIndex < 0 || targetIndex >= units.length) return;
    const reordered = [...units];
    const [removed] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, removed);
    queryClient.setQueryData(curriculumKeys.units(productRef), reordered);
    queryClient.invalidateQueries({ queryKey: studioKeys.previewBase(productRef) });
    reorderUnits.mutate(reordered.map((u) => u.id));
  };

  const handleMoveUnit = (index: number, direction: "up" | "down") => {
    handleReorderUnits(index, direction === "up" ? index - 1 : index + 1);
  };

  const handleReorderLessons = (unit: CurriculumUnit, sourceIndex: number, targetIndex: number) => {
    const lessons = unit.lessons ?? [];
    if (sourceIndex === targetIndex || targetIndex < 0 || targetIndex >= lessons.length) return;
    const reorderedLessons = [...lessons];
    const [removed] = reorderedLessons.splice(sourceIndex, 1);
    reorderedLessons.splice(targetIndex, 0, removed);
    const updatedUnits = units.map((u) => (u.id === unit.id ? { ...u, lessons: reorderedLessons } : u));
    queryClient.setQueryData(curriculumKeys.units(productRef), updatedUnits);
    queryClient.invalidateQueries({ queryKey: studioKeys.previewBase(productRef) });
    reorderLessons.mutate({ unitId: unit.id, ids: reorderedLessons.map((l) => l.id) });
  };

  const handleMoveLesson = (unit: CurriculumUnit, index: number, direction: "up" | "down") => {
    handleReorderLessons(unit, index, direction === "up" ? index - 1 : index + 1);
  };

  return (
    <>
      <CurriculumView
        units={units}
        loading={unitsQuery.isLoading}
        error={unitsQuery.error}
        canEdit={canEdit}
        onAddUnit={() => setUnitModal({ mode: "create" })}
        onEditUnit={(unit) => setUnitModal({ mode: "edit", unit })}
        onDeleteUnit={(unit) => setDeleteTarget({ type: "unit", unit })}
        onMoveUnit={handleMoveUnit}
        onReorderUnits={handleReorderUnits}
        onAddLesson={(unit) => setLessonModal({ mode: "create", unitId: unit.id })}
        onEditLesson={(unit, lesson) => setLessonModal({ mode: "edit", unitId: unit.id, lesson })}
        onDeleteLesson={(unit, lesson) => setDeleteTarget({ type: "lesson", unit, lesson })}
        onMoveLesson={handleMoveLesson}
        onReorderLessons={handleReorderLessons}
      />

      <ConfirmModal
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        tone="danger"
        title={
          deleteTarget?.type === "unit"
            ? t("حذف القسم / الوحدة", "Delete Unit")
            : t("حذف الدرس", "Delete Lesson")
        }
        message={
          deleteTarget?.type === "unit"
            ? t(
                `هل أنت متأكد من حذف قسم "${deleteTarget.unit.name}" وجميع دروسه؟`,
                `Are you sure you want to delete unit "${deleteTarget.unit.name}" and all its lessons?`
              )
            : deleteTarget
            ? t(
                `هل أنت متأكد من حذف درس "${deleteTarget.lesson.name}"؟`,
                `Are you sure you want to delete lesson "${deleteTarget.lesson.name}"?`
              )
            : ""
        }
        description={t(
          "سيتم حذف هذا العنصر بشكل نهائي ولا يمكن التراجع عن هذه العملية.",
          "This item will be permanently deleted and this action cannot be undone."
        )}
        confirmLabel={t("حذف نهائي", "Delete")}
        cancelLabel={t("إلغاء", "Cancel")}
        loading={deleteUnit.isPending || deleteLesson.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          if (deleteTarget.type === "unit") {
            deleteUnit.mutate(deleteTarget.unit.id);
          } else {
            deleteLesson.mutate({
              unitId: deleteTarget.unit.id,
              lessonId: deleteTarget.lesson.id,
            });
          }
        }}
      />

      {unitModal ? (
        <UnitModal
          unit={unitModal.mode === "edit" ? unitModal.unit : null}
          loading={createUnit.isPending || updateUnit.isPending}
          error={createUnit.error || updateUnit.error}
          onSave={(data) => {
            if (unitModal.mode === "edit") {
              updateUnit.mutate({ unitId: unitModal.unit.id, data });
            } else {
              createUnit.mutate(data as CreateUnitInput);
            }
          }}
          onClose={() => setUnitModal(null)}
        />
      ) : null}

      {lessonModal ? (
        <LessonModal
          productRef={productRef}
          unitId={lessonModal.unitId}
          lesson={lessonModal.mode === "edit" ? lessonModal.lesson : null}
          loading={createLesson.isPending || updateLesson.isPending}
          error={createLesson.error || updateLesson.error}
          onSave={(data) => {
            if (lessonModal.mode === "edit") {
              updateLesson.mutate({
                unitId: lessonModal.unitId,
                lessonId: lessonModal.lesson.id,
                data,
              });
            } else {
              createLesson.mutate({
                unitId: lessonModal.unitId,
                data: data as CreateLessonInput,
              });
            }
          }}
          onClose={() => setLessonModal(null)}
        />
      ) : null}
    </>
  );
}
