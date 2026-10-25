import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  FileText,
  FolderPlus,
  GripVertical,
  MoveDown,
  MoveUp,
  Pencil,
  Plus,
  Trash2,
  ExternalLink,
} from "lucide-react";

import { Button, Card, Empty, ErrorAlert, Loading } from "@/components/ui/kit";
import { useT } from "@/lib/i18n";
import { formatDurationSeconds, formatHumanDuration } from "@/lib/format";
import type { CurriculumLesson, CurriculumUnit } from "@/lib/api";

export interface CurriculumViewProps {
  units: CurriculumUnit[];
  loading?: boolean;
  error?: unknown;
  canEdit?: boolean;
  onAddUnit: () => void;
  onEditUnit: (unit: CurriculumUnit) => void;
  onDeleteUnit: (unit: CurriculumUnit) => void;
  onMoveUnit: (index: number, direction: "up" | "down") => void;
  onReorderUnits?: (sourceIndex: number, targetIndex: number) => void;
  onAddLesson: (unit: CurriculumUnit) => void;
  onEditLesson: (unit: CurriculumUnit, lesson: CurriculumLesson) => void;
  onDeleteLesson: (unit: CurriculumUnit, lesson: CurriculumLesson) => void;
  onMoveLesson: (unit: CurriculumUnit, index: number, direction: "up" | "down") => void;
  onReorderLessons?: (unit: CurriculumUnit, sourceIndex: number, targetIndex: number) => void;
}

export function CurriculumView({
  units,
  loading,
  error,
  canEdit = true,
  onAddUnit,
  onEditUnit,
  onDeleteUnit,
  onMoveUnit,
  onReorderUnits,
  onAddLesson,
  onEditLesson,
  onDeleteLesson,
  onMoveLesson,
  onReorderLessons,
}: CurriculumViewProps) {
  const t = useT();

  // Collapsed units state (default: all units expanded)
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(() => new Set());

  // Drag and Drop State for Units
  const [draggingUnitIndex, setDraggingUnitIndex] = useState<number | null>(null);
  const [dragOverUnitIndex, setDragOverUnitIndex] = useState<number | null>(null);

  // Drag and Drop State for Lessons
  const [draggingLesson, setDraggingLesson] = useState<{ unitId: number; index: number } | null>(null);
  const [dragOverLesson, setDragOverLesson] = useState<{ unitId: number; index: number } | null>(null);

  const toggleUnit = (id: number) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => setCollapsedIds(new Set());
  const collapseAll = () => setCollapsedIds(new Set(units.map((u) => u.id)));

  if (loading) return <Loading label={t("جارٍ تحميل محتوى الدورة…", "Loading course curriculum…")} />;
  if (error) return <ErrorAlert error={error} title={t("تعذّر تحميل محتوى الدورة", "Failed to load curriculum")} />;

  const totalLessons = units.reduce((acc, u) => acc + (u.lessons?.length || u.lessons_count || 0), 0);
  const totalSeconds = units.reduce((acc, u) => {
    const unitSecs = u.lessons?.reduce((lAcc, l) => lAcc + (l.duration || 0), 0) || u.duration || 0;
    return acc + unitSecs;
  }, 0);

  return (
    <div className="ma-stack" style={{ gap: "var(--space-4)" }}>
      {/* Top Header Bar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-3)",
          padding: "var(--space-3) var(--space-4)",
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-card)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <h2 className="ma-head" style={{ margin: 0, fontSize: "18px" }}>
            {t("محتوى الدورة", "Course Curriculum")}
          </h2>
          {units.length > 0 ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "2px 10px",
                background: "var(--surface-alt)",
                borderRadius: "var(--radius-pill)",
                fontSize: "13px",
                color: "var(--text-muted)",
              }}
            >
              <span>{units.length} {t("أقسام", "sections")}</span>
              <span>·</span>
              <span>{totalLessons} {t("درسًا", "lessons")}</span>
              {totalSeconds > 0 ? (
                <>
                  <span>·</span>
                  <span>{formatHumanDuration(totalSeconds)}</span>
                </>
              ) : null}
            </span>
          ) : null}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          {units.length > 0 ? (
            <>
              <button
                type="button"
                className="ma-sblock__btn"
                onClick={collapsedIds.size === 0 ? collapseAll : expandAll}
                style={{ fontSize: "13px" }}
              >
                {collapsedIds.size === 0 ? t("طي الكل", "Collapse All") : t("توسيع الكل", "Expand All")}
              </button>
            </>
          ) : null}

          {canEdit ? (
            <Button
              kind="primary"
              icon="plus"
              label={t("إضافة قسم / وحدة", "Add Unit")}
              onClick={onAddUnit}
            />
          ) : null}
        </div>
      </div>

      {/* Units List or Empty State */}
      {!units.length ? (
        <Card>
          <Empty
            icon="book"
            text={t("لا توجد أقسام أو دروس بعد في محتوى هذه الدورة.", "No sections or lessons in this course yet.")}
          />
          {canEdit ? (
            <div style={{ display: "flex", justifyContent: "center", marginTop: "var(--space-3)" }}>
              <Button kind="primary" icon="plus" label={t("إضافة أول قسم", "Add First Section")} onClick={onAddUnit} />
            </div>
          ) : null}
        </Card>
      ) : (
        <div className="ma-stack" style={{ gap: "var(--space-3)" }}>
          {units.map((unit, unitIndex) => {
            const isExpanded = !collapsedIds.has(unit.id);
            const unitLessons = unit.lessons ?? [];
            const unitDurationSecs =
              unitLessons.reduce((acc, l) => acc + (l.duration || 0), 0) || unit.duration || 0;

            const isUnitDragging = draggingUnitIndex === unitIndex;
            const isUnitDragOver = dragOverUnitIndex === unitIndex && draggingUnitIndex !== unitIndex;

            return (
              <div
                key={unit.id}
                draggable={canEdit && units.length > 1}
                onDragStart={(e) => {
                  if ((e.target as HTMLElement).closest("button, a, input, select, textarea")) {
                    e.preventDefault();
                    return;
                  }
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("application/x-curriculum-unit", String(unitIndex));
                  setDraggingUnitIndex(unitIndex);
                }}
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes("application/x-curriculum-unit")) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (dragOverUnitIndex !== unitIndex) {
                      setDragOverUnitIndex(unitIndex);
                    }
                  }
                }}
                onDragLeave={() => {
                  if (dragOverUnitIndex === unitIndex) {
                    setDragOverUnitIndex(null);
                  }
                }}
                onDrop={(e) => {
                  if (e.dataTransfer.types.includes("application/x-curriculum-unit")) {
                    e.preventDefault();
                    const raw = e.dataTransfer.getData("application/x-curriculum-unit");
                    const sourceIndex = draggingUnitIndex ?? (raw !== "" ? Number(raw) : null);
                    if (sourceIndex !== null && !isNaN(sourceIndex) && sourceIndex !== unitIndex) {
                      onReorderUnits?.(sourceIndex, unitIndex);
                    }
                    setDraggingUnitIndex(null);
                    setDragOverUnitIndex(null);
                  }
                }}
                onDragEnd={() => {
                  setDraggingUnitIndex(null);
                  setDragOverUnitIndex(null);
                }}
                style={{
                  background: "var(--surface)",
                  border: isUnitDragOver
                    ? "2px solid var(--primary)"
                    : isUnitDragging
                    ? "1px dashed var(--line-strong, #888)"
                    : "1px solid var(--line)",
                  borderRadius: "var(--radius-card)",
                  overflow: "hidden",
                  opacity: isUnitDragging ? 0.45 : 1,
                  transform: isUnitDragOver ? "scale(1.005)" : "none",
                  transition: "border 0.15s, opacity 0.15s, transform 0.15s, box-shadow 0.15s",
                  boxShadow: isUnitDragOver ? "0 4px 12px rgba(0, 0, 0, 0.08)" : "none",
                }}
              >
                {/* Unit Header */}
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "var(--space-3) var(--space-4)",
                    background: isExpanded ? "var(--surface)" : "var(--surface-alt)",
                    borderBottom: isExpanded ? "1px solid var(--line)" : "none",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                  onClick={() => toggleUnit(unit.id)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flex: "1 1 auto" }}>
                    {canEdit && units.length > 1 ? (
                      <span
                        aria-hidden
                        title={t("اسحب لإعادة الترتيب", "Drag to reorder")}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          cursor: "grab",
                          color: "var(--text-muted)",
                          padding: "2px 0",
                          opacity: 0.6,
                        }}
                      >
                        <GripVertical size={16} />
                      </span>
                    ) : null}

                    <button
                      type="button"
                      style={{
                        background: "none",
                        border: 0,
                        cursor: "pointer",
                        color: "var(--text-muted)",
                        padding: "4px",
                      }}
                      aria-label={isExpanded ? t("طي", "Collapse") : t("توسيع", "Expand")}
                    >
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>

                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                        <span
                          style={{
                            display: "inline-grid",
                            placeItems: "center",
                            width: "24px",
                            height: "24px",
                            borderRadius: "50%",
                            background: "var(--surface-alt)",
                            border: "1px solid var(--line)",
                            fontSize: "12px",
                            fontWeight: "bold",
                          }}
                        >
                          {unitIndex + 1}
                        </span>
                        <strong style={{ fontSize: "15px" }}>{unit.name}</strong>
                      </div>

                      {unit.description ? (
                        <span style={{ fontSize: "13px", color: "var(--text-muted)", paddingInlineStart: "32px" }}>
                          {unit.description}
                        </span>
                      ) : null}
                    </div>

                    {/* Badge: e.g. "8 دروس · 32 دقيقة" */}
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "2px 8px",
                        background: "var(--surface-alt)",
                        border: "1px solid var(--line)",
                        borderRadius: "var(--radius-pill)",
                        fontSize: "12px",
                        color: "var(--text-muted)",
                        marginInlineStart: "auto",
                      }}
                    >
                      <span>
                        {unitLessons.length} {t("دروس", "lessons")}
                      </span>
                      {unitDurationSecs > 0 ? (
                        <>
                          <span>·</span>
                          <span>{formatHumanDuration(unitDurationSecs)}</span>
                        </>
                      ) : null}
                    </span>
                  </div>

                  {/* Unit Actions */}
                  {canEdit ? (
                    <div
                      style={{ display: "flex", alignItems: "center", gap: "6px", marginInlineStart: "var(--space-3)" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="ma-sblock__btn"
                        onClick={() => onAddLesson(unit)}
                        style={{ fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                        title={t("إضافة درس في هذا القسم", "Add lesson to this section")}
                      >
                        <Plus size={13} aria-hidden />
                        {t("إضافة درس", "Add Lesson")}
                      </button>

                      <button
                        type="button"
                        className="ma-sblock__btn"
                        disabled={unitIndex === 0}
                        onClick={() => onMoveUnit(unitIndex, "up")}
                        title={t("تحريك لأعلى", "Move Up")}
                        aria-label={t("تحريك القسم لأعلى", "Move Section Up")}
                        style={{
                          opacity: unitIndex === 0 ? 0.35 : 1,
                          cursor: unitIndex === 0 ? "not-allowed" : "pointer",
                        }}
                      >
                        <MoveUp size={13} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="ma-sblock__btn"
                        disabled={unitIndex === units.length - 1}
                        onClick={() => onMoveUnit(unitIndex, "down")}
                        title={t("تحريك لأسفل", "Move Down")}
                        aria-label={t("تحريك القسم لأسفل", "Move Section Down")}
                        style={{
                          opacity: unitIndex === units.length - 1 ? 0.35 : 1,
                          cursor: unitIndex === units.length - 1 ? "not-allowed" : "pointer",
                        }}
                      >
                        <MoveDown size={13} aria-hidden />
                      </button>

                      <button
                        type="button"
                        className="ma-sblock__btn"
                        onClick={() => onEditUnit(unit)}
                        title={t("تعديل القسم", "Edit Unit")}
                      >
                        <Pencil size={13} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="ma-sblock__btn"
                        onClick={() => onDeleteUnit(unit)}
                        style={{ color: "var(--danger)" }}
                        title={t("حذف القسم", "Delete Unit")}
                      >
                        <Trash2 size={13} aria-hidden />
                      </button>
                    </div>
                  ) : null}
                </div>

                {/* Unit Lessons Body */}
                {isExpanded ? (
                  <div style={{ padding: "var(--space-2) var(--space-4)" }}>
                    {!unitLessons.length ? (
                      <div
                        style={{
                          padding: "var(--space-4)",
                          textAlign: "center",
                          color: "var(--text-muted)",
                          fontSize: "13px",
                        }}
                      >
                        {t("لا توجد دروس في هذا القسم بعد.", "No lessons in this section yet.")}
                        {canEdit ? (
                          <div style={{ marginTop: "var(--space-2)" }}>
                            <Button
                              sm
                              kind="secondary"
                              icon="plus"
                              label={t("إضافة أول درس", "Add First Lesson")}
                              onClick={() => onAddLesson(unit)}
                            />
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <ol
                        style={{
                          listStyle: "none",
                          margin: 0,
                          padding: 0,
                          display: "grid",
                          gap: "6px",
                        }}
                      >
                        {unitLessons.map((lesson, lessonIndex) => {
                          const isLessonDragging =
                            draggingLesson?.unitId === unit.id && draggingLesson?.index === lessonIndex;
                          const isLessonDragOver =
                            dragOverLesson?.unitId === unit.id &&
                            dragOverLesson?.index === lessonIndex &&
                            !isLessonDragging;

                          return (
                            <li
                              key={lesson.id}
                              draggable={canEdit && unitLessons.length > 1}
                              onDragStart={(e) => {
                                if ((e.target as HTMLElement).closest("button, a, input, select, textarea")) {
                                  e.preventDefault();
                                  return;
                                }
                                e.stopPropagation();
                                e.dataTransfer.effectAllowed = "move";
                                e.dataTransfer.setData(
                                  "application/x-curriculum-lesson",
                                  JSON.stringify({ unitId: unit.id, index: lessonIndex })
                                );
                                setDraggingLesson({ unitId: unit.id, index: lessonIndex });
                              }}
                              onDragOver={(e) => {
                                if (e.dataTransfer.types.includes("application/x-curriculum-lesson")) {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  e.dataTransfer.dropEffect = "move";
                                  if (dragOverLesson?.unitId !== unit.id || dragOverLesson?.index !== lessonIndex) {
                                    setDragOverLesson({ unitId: unit.id, index: lessonIndex });
                                  }
                                }
                              }}
                              onDragLeave={(e) => {
                                e.stopPropagation();
                                if (dragOverLesson?.unitId === unit.id && dragOverLesson?.index === lessonIndex) {
                                  setDragOverLesson(null);
                                }
                              }}
                              onDrop={(e) => {
                                if (e.dataTransfer.types.includes("application/x-curriculum-lesson")) {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  try {
                                    let sourceIndex =
                                      draggingLesson?.unitId === unit.id ? draggingLesson.index : null;
                                    if (sourceIndex === null) {
                                      const parsed = JSON.parse(
                                        e.dataTransfer.getData("application/x-curriculum-lesson")
                                      );
                                      if (parsed?.unitId === unit.id) sourceIndex = parsed.index;
                                    }
                                    if (sourceIndex !== null && sourceIndex !== lessonIndex) {
                                      onReorderLessons?.(unit, sourceIndex, lessonIndex);
                                    }
                                  } catch {}
                                  setDraggingLesson(null);
                                  setDragOverLesson(null);
                                }
                              }}
                              onDragEnd={(e) => {
                                e.stopPropagation();
                                setDraggingLesson(null);
                                setDragOverLesson(null);
                              }}
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "10px 14px",
                                background: isLessonDragOver
                                  ? "var(--surface-hover, rgba(99, 102, 241, 0.08))"
                                  : "var(--surface-alt)",
                                border: isLessonDragOver
                                  ? "1px solid var(--primary)"
                                  : isLessonDragging
                                  ? "1px dashed var(--line-strong, #888)"
                                  : "1px solid var(--line)",
                                borderRadius: "var(--radius-soft)",
                                gap: "var(--space-2)",
                                opacity: isLessonDragging ? 0.45 : 1,
                                transition: "border 0.15s, background 0.15s, opacity 0.15s",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "var(--space-3)",
                                  flex: "1 1 auto",
                                }}
                              >
                                {canEdit && unitLessons.length > 1 ? (
                                  <span
                                    aria-hidden
                                    title={t("اسحب لإعادة الترتيب", "Drag to reorder")}
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      cursor: "grab",
                                      color: "var(--text-muted)",
                                      padding: "2px 0",
                                      opacity: 0.5,
                                    }}
                                  >
                                    <GripVertical size={14} />
                                  </span>
                                ) : null}

                                {/* Duration Badge: e.g. "1:03", "5:24" */}
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    padding: "2px 8px",
                                    background: "var(--surface)",
                                    border: "1px solid var(--line)",
                                    borderRadius: "var(--radius-soft)",
                                    fontSize: "12px",
                                    fontWeight: 600,
                                    fontVariantNumeric: "tabular-nums",
                                    color: "var(--text)",
                                    minWidth: "54px",
                                    justifyContent: "center",
                                  }}
                                  title={t("مدة الدرس", "Duration")}
                                >
                                  <Clock size={12} style={{ color: "var(--text-muted)" }} aria-hidden />
                                  {formatDurationSeconds(lesson.duration)}
                                </span>

                                {/* Lesson Title */}
                                <span style={{ fontSize: "14px", fontWeight: 500 }}>{lesson.name}</span>

                                {/* Free Preview Badge */}
                                {lesson.is_free ? (
                                  <span
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px",
                                      padding: "2px 8px",
                                      background: "rgba(16, 185, 129, 0.1)",
                                      border: "1px solid rgba(16, 185, 129, 0.3)",
                                      borderRadius: "var(--radius-pill)",
                                      fontSize: "11px",
                                      fontWeight: 600,
                                      color: "var(--success, #10b981)",
                                    }}
                                  >
                                    <Eye size={11} aria-hidden />
                                    {t("معاينة مجانية", "Free Preview")}
                                  </span>
                                ) : null}

                                {/* Asset / File Attached indicator */}
                                {lesson.link ? (
                                  <a
                                    href={lesson.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px",
                                      padding: "2px 8px",
                                      background: "var(--surface)",
                                      border: "1px solid var(--line)",
                                      borderRadius: "var(--radius-pill)",
                                      fontSize: "11px",
                                      color: "var(--primary)",
                                      textDecoration: "none",
                                    }}
                                    title={lesson.link}
                                  >
                                    <FileText size={11} aria-hidden />
                                    <span>{lesson.file_name ?? t("ملف مرفق / فيديو", "Attached / Video")}</span>
                                    <ExternalLink size={10} aria-hidden />
                                  </a>
                                ) : null}
                              </div>

                              {/* Lesson Actions */}
                              {canEdit ? (
                                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                  <button
                                    type="button"
                                    className="ma-sblock__btn"
                                    disabled={lessonIndex === 0}
                                    onClick={() => onMoveLesson(unit, lessonIndex, "up")}
                                    title={t("تحريك لأعلى", "Move Up")}
                                    aria-label={t("تحريك الدرس لأعلى", "Move Lesson Up")}
                                    style={{
                                      opacity: lessonIndex === 0 ? 0.35 : 1,
                                      cursor: lessonIndex === 0 ? "not-allowed" : "pointer",
                                    }}
                                  >
                                    <MoveUp size={12} aria-hidden />
                                  </button>
                                  <button
                                    type="button"
                                    className="ma-sblock__btn"
                                    disabled={lessonIndex === unitLessons.length - 1}
                                    onClick={() => onMoveLesson(unit, lessonIndex, "down")}
                                    title={t("تحريك لأسفل", "Move Down")}
                                    aria-label={t("تحريك الدرس لأسفل", "Move Lesson Down")}
                                    style={{
                                      opacity: lessonIndex === unitLessons.length - 1 ? 0.35 : 1,
                                      cursor: lessonIndex === unitLessons.length - 1 ? "not-allowed" : "pointer",
                                    }}
                                  >
                                    <MoveDown size={12} aria-hidden />
                                  </button>
                                  <button
                                    type="button"
                                    className="ma-sblock__btn"
                                    onClick={() => onEditLesson(unit, lesson)}
                                    title={t("تعديل الدرس", "Edit Lesson")}
                                  >
                                    <Pencil size={12} aria-hidden />
                                  </button>
                                  <button
                                    type="button"
                                    className="ma-sblock__btn"
                                    onClick={() => onDeleteLesson(unit, lesson)}
                                    style={{ color: "var(--danger)" }}
                                    title={t("حذف الدرس", "Delete Lesson")}
                                  >
                                    <Trash2 size={12} aria-hidden />
                                  </button>
                                </div>
                              ) : null}
                            </li>
                          );
                        })}
                      </ol>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
