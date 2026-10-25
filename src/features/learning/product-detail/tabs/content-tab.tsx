import { useState, type DragEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  curriculumKeys,
  curriculumQueries,
  createCurriculumLesson,
  createCurriculumUnit,
  updateCurriculumLesson,
  deleteCurriculumLesson,
  reorderCurriculumLessons,
  type CurriculumLesson,
  type CurriculumUnit,
} from "@/lib/api/learning/curriculum";
import { can } from "@/lib/permissions";
import { useT } from "@/lib/i18n";
import { dur, longDur } from "../model";
import { Icon } from "@/components/ui/icon";

interface ContentTabProps {
  productRef: string;
}

export function ContentTab({ productRef }: ContentTabProps) {
  const t = useT();
  const queryClient = useQueryClient();
  const canEdit = can("catalog.write") || can("studio.edit");

  const unitsQuery = useQuery(curriculumQueries.units(productRef));
  const units = unitsQuery.data ?? [];

  const [selectedUnitId, setSelectedUnitId] = useState<number | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [collapsedUnits, setCollapsedUnits] = useState<Record<number, boolean>>({});
  const [editingLessonId, setEditingLessonId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [draggingLessonId, setDraggingLessonId] = useState<number | null>(null);

  // Simple modal prompt state
  const [modalState, setModalState] = useState<
    | { type: "add-unit" }
    | { type: "add-lesson"; unitId: number }
    | { type: "delete-lesson"; unitId: number; lesson: CurriculumLesson }
    | null
  >(null);
  const [inputValue, setInputValue] = useState("");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: curriculumKeys.units(productRef) });
  };

  const createUnitMut = useMutation({
    mutationFn: (name: string) => createCurriculumUnit(productRef, { name }),
    onSuccess: () => {
      invalidate();
      setModalState(null);
      setInputValue("");
    },
  });

  const createLessonMut = useMutation({
    mutationFn: ({ unitId, name }: { unitId: number; name: string }) =>
      createCurriculumLesson(productRef, unitId, { name, duration: 300 }),
    onSuccess: () => {
      invalidate();
      setModalState(null);
      setInputValue("");
    },
  });

  const updateLessonMut = useMutation({
    mutationFn: ({ unitId, lessonId, name }: { unitId: number; lessonId: number; name: string }) =>
      updateCurriculumLesson(productRef, unitId, lessonId, { name }),
    onSuccess: () => {
      invalidate();
      setEditingLessonId(null);
    },
  });

  const deleteLessonMut = useMutation({
    mutationFn: ({ unitId, lessonId }: { unitId: number; lessonId: number }) =>
      deleteCurriculumLesson(productRef, unitId, lessonId),
    onSuccess: () => {
      invalidate();
      setModalState(null);
    },
  });

  const reorderLessonsMut = useMutation({
    mutationFn: ({ unitId, ids }: { unitId: number; ids: number[] }) =>
      reorderCurriculumLessons(productRef, unitId, ids),
    onSuccess: () => {
      invalidate();
    },
  });

  const totalLessons = units.reduce((acc, u) => acc + (u.lessons?.length || 0), 0);
  const totalDuration = units.reduce(
    (acc, u) => acc + (u.lessons || []).reduce((sum, l) => sum + (l.duration || 0), 0),
    0
  );

  const secSec = (u: CurriculumUnit) =>
    (u.lessons || []).reduce((sum, l) => sum + (l.duration || 0), 0);

  // Count occurrences of lesson names for duplicate warning
  const nameCounts = new Map<string, number>();
  for (const u of units) {
    for (const l of u.lessons || []) {
      const nm = (l.name || "").trim().toLowerCase();
      if (nm) nameCounts.set(nm, (nameCounts.get(nm) || 0) + 1);
    }
  }

  const handleMoveLesson = (unit: CurriculumUnit, lessonIndex: number, delta: number) => {
    if (!canEdit) return;
    const ls = [...(unit.lessons || [])];
    const newIdx = lessonIndex + delta;
    if (newIdx < 0 || newIdx >= ls.length) return;
    const [moved] = ls.splice(lessonIndex, 1);
    ls.splice(newIdx, 0, moved);
    reorderLessonsMut.mutate({ unitId: unit.id, ids: ls.map((l) => l.id) });
  };

  const handleStartRename = (l: CurriculumLesson) => {
    if (!canEdit) return;
    setEditingLessonId(l.id);
    setEditingTitle(l.name);
  };

  const handleSaveRename = (unitId: number, lessonId: number) => {
    const trimmed = editingTitle.trim();
    if (trimmed) {
      updateLessonMut.mutate({ unitId, lessonId, name: trimmed });
    } else {
      setEditingLessonId(null);
    }
  };

  // Drag and Drop
  const handleDragStart = (e: DragEvent<HTMLLIElement>, lessonId: number) => {
    if (viewMode !== "list" || !canEdit) return;
    setDraggingLessonId(lessonId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(lessonId));
  };

  const handleDragOver = (e: DragEvent<HTMLLIElement>) => {
    if (viewMode !== "list" || !canEdit) return;
    e.preventDefault();
  };

  const handleDrop = (e: DragEvent<HTMLLIElement>, unit: CurriculumUnit, targetLessonId: number) => {
    if (viewMode !== "list" || !canEdit || !draggingLessonId || draggingLessonId === targetLessonId) return;
    e.preventDefault();
    const ls = [...(unit.lessons || [])];
    const fromIdx = ls.findIndex((l) => l.id === draggingLessonId);
    const toIdx = ls.findIndex((l) => l.id === targetLessonId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = ls.splice(fromIdx, 1);
    ls.splice(toIdx, 0, moved);
    setDraggingLessonId(null);
    reorderLessonsMut.mutate({ unitId: unit.id, ids: ls.map((l) => l.id) });
  };

  const filteredUnits = units
    .filter((u) => selectedUnitId === "all" || u.id === selectedUnitId)
    .map((u, ui) => {
      const q = searchQuery.trim().toLowerCase();
      const lessons = (u.lessons || []).filter((l) => !q || l.name.toLowerCase().includes(q));
      return { unit: u, unitIndex: ui, lessons };
    });

  return (
    <div className="cd-studio">
      {/* Sticky Units Outline */}
      <nav className="cd-card cd-outline" aria-label={t("المنهج الدراسي", "Curriculum")}>
        <div className="cd-card__b" style={{ padding: 12, gap: 2 }}>
          <button
            type="button"
            aria-current={selectedUnitId === "all"}
            onClick={() => setSelectedUnitId("all")}
          >
            <span className="cd-outline__n">
              <Icon name="layers" className="cd-ic--sm" />
            </span>
            <span className="cd-outline__t">
              <span>{t("جميع الوحدات", "All sections")}</span>
              <small>
                {totalLessons} {t("دروس", "lessons")} · {longDur(totalDuration)}
              </small>
            </span>
          </button>

          {units.map((u, i) => (
            <button
              key={u.id}
              type="button"
              aria-current={selectedUnitId === u.id}
              onClick={() => setSelectedUnitId(u.id)}
            >
              <span className="cd-outline__n">{i + 1}</span>
              <span className="cd-outline__t">
                <span>{u.name}</span>
                <small>
                  {u.lessons?.length || 0} {t("دروس", "lessons")} · {longDur(secSec(u))}
                </small>
              </span>
            </button>
          ))}

          {canEdit && (
            <button
              type="button"
              className="ma-btn ma-btn--soft ma-btn--sm"
              style={{ marginBlockStart: 8, justifyContent: "center" }}
              onClick={() => {
                setInputValue("");
                setModalState({ type: "add-unit" });
              }}
            >
              <Icon name="plus" className="cd-ic--sm" />
              {t("إضافة وحدة", "Add Section")}
            </button>
          )}
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="cd-page">
        {/* Toolbar */}
        <div className="cd-card">
          <div className="cd-toolbar">
            <input
              className="cd-input"
              type="search"
              placeholder={t("بحث في الدروس...", "Search lessons...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label={t("بحث في الدروس", "Search lessons")}
            />
            <button
              type="button"
              className="ma-btn ma-btn--sm ma-btn--soft"
              onClick={() => {
                const map: Record<number, boolean> = {};
                units.forEach((u) => (map[u.id] = false));
                setCollapsedUnits(map);
              }}
            >
              {t("توسيع الكل", "Expand all")}
            </button>
            <button
              type="button"
              className="ma-btn ma-btn--sm ma-btn--soft"
              onClick={() => {
                const map: Record<number, boolean> = {};
                units.forEach((u) => (map[u.id] = true));
                setCollapsedUnits(map);
              }}
            >
              {t("طي الكل", "Collapse all")}
            </button>
            <div className="cd-seg" role="group">
              <button
                type="button"
                aria-pressed={viewMode === "list"}
                onClick={() => setViewMode("list")}
                title={t("عرض القائمة", "List view")}
              >
                <Icon name="list" className="cd-ic--sm" />
              </button>
              <button
                type="button"
                aria-pressed={viewMode === "grid"}
                onClick={() => setViewMode("grid")}
                title={t("عرض الشبكة", "Grid view")}
              >
                <Icon name="grid" className="cd-ic--sm" />
              </button>
            </div>
          </div>
        </div>

        {/* Units & Lessons */}
        <div className="cd-page">
          {filteredUnits.length === 0 ? (
            <div className="cd-empty">
              <Icon name="search" />
              <strong>{t("لم يتم العثور على نتائج", "No matching lessons")}</strong>
            </div>
          ) : (
            filteredUnits.map(({ unit, unitIndex, lessons }) => {
              const isCollapsed = Boolean(collapsedUnits[unit.id]);
              return (
                <section key={unit.id} className="cd-sec">
                  <div className="cd-sec__h">
                    <span className="cd-sec__n">{unitIndex + 1}</span>
                    <h3>{unit.name}</h3>
                    <span className="cd-muted cd-num" style={{ fontSize: 13 }}>
                      {unit.lessons?.length || 0} {t("دروس", "lessons")} · {longDur(secSec(unit))}
                    </span>
                    <div className="cd-sec__tools">
                      {canEdit && (
                        <button
                          type="button"
                          className="ma-btn ma-btn--sm ma-btn--soft"
                          onClick={() => {
                            setInputValue("");
                            setModalState({ type: "add-lesson", unitId: unit.id });
                          }}
                        >
                          <Icon name="plus" className="cd-ic--sm" />
                          {t("إضافة درس", "Add lesson")}
                        </button>
                      )}
                      <button
                        type="button"
                        className="cd-iconbtn"
                        onClick={() =>
                          setCollapsedUnits((prev) => ({ ...prev, [unit.id]: !isCollapsed }))
                        }
                        aria-expanded={!isCollapsed}
                        aria-label={isCollapsed ? t("توسيع", "Expand") : t("طي", "Collapse")}
                      >
                        <span
                          style={{
                            display: "grid",
                            transform: `rotate(${isCollapsed ? 0 : 180}deg)`,
                            transition: "transform 140ms ease",
                          }}
                        >
                          <Icon name="chevron" />
                        </span>
                      </button>
                    </div>
                  </div>

                  {!isCollapsed && (
                    <ul
                      className={`cd-lessons ${viewMode === "grid" ? "cd-lessons--grid" : ""}`}
                    >
                      {lessons.length === 0 ? (
                        <li className="cd-empty" style={{ padding: "16px 0" }}>
                          <span className="cd-muted">{t("لا توجد دروس في هذه الوحدة", "No lessons in this unit")}</span>
                        </li>
                      ) : (
                        lessons.map((l, li) => {
                          const isDup = (nameCounts.get((l.name || "").trim().toLowerCase()) || 0) > 1;
                          const isEditing = editingLessonId === l.id;

                          return (
                            <li
                              key={l.id}
                              id={`les-${l.id}`}
                              className="cd-lesson"
                              draggable={viewMode === "list" && canEdit}
                              onDragStart={(e) => handleDragStart(e, l.id)}
                              onDragOver={handleDragOver}
                              onDrop={(e) => handleDrop(e, unit, l.id)}
                            >
                              {viewMode === "list" && canEdit && (
                                <span
                                  className="cd-lesson__grip"
                                  title={t("اسحب لإعادة الترتيب", "Drag to reorder")}
                                >
                                  <Icon name="grip" />
                                </span>
                              )}
                              <span
                                className="cd-lesson__ic"
                                style={{ "--c": "var(--sky)" } as React.CSSProperties}
                              >
                                <Icon name="video" />
                              </span>
                              <div className="cd-lesson__body">
                                {isEditing ? (
                                  <input
                                    className="cd-input cd-rename"
                                    value={editingTitle}
                                    autoFocus
                                    onChange={(e) => setEditingTitle(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") handleSaveRename(unit.id, l.id);
                                      if (e.key === "Escape") setEditingLessonId(null);
                                    }}
                                    onBlur={() => handleSaveRename(unit.id, l.id)}
                                  />
                                ) : (
                                  <div
                                    className="cd-lesson__t"
                                    onDoubleClick={() => handleStartRename(l)}
                                  >
                                    {l.name}
                                  </div>
                                )}
                                <div className="cd-lesson__m">
                                  <span className="cd-lesson__dur">
                                    <Icon name="clock" className="cd-ic--sm" />
                                    {dur(l.duration || 0)}
                                  </span>
                                  {l.is_free && (
                                    <span className="cd-chip cd-chip--plain cd-chip--warn" style={{ height: 18, fontSize: 11 }}>
                                      {t("مجاني", "Free")}
                                    </span>
                                  )}
                                  {isDup && (
                                    <span className="cd-flag cd-flag--dup">
                                      <Icon name="alert" className="cd-ic--sm" />
                                      {t("اسم مكرر", "Duplicate")}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {canEdit && (
                                <div className="cd-lesson__tools">
                                  <button
                                    type="button"
                                    className="cd-iconbtn"
                                    onClick={() => handleStartRename(l)}
                                    aria-label={t("تعديل الاسم", "Rename")}
                                    title={t("تعديل الاسم", "Rename")}
                                  >
                                    <Icon name="edit" className="cd-ic--sm" />
                                  </button>
                                  <button
                                    type="button"
                                    className="cd-iconbtn"
                                    disabled={li === 0}
                                    onClick={() => handleMoveLesson(unit, li, -1)}
                                    aria-label={t("تحريك لأعلى", "Move up")}
                                    title={t("تحريك لأعلى", "Move up")}
                                  >
                                    <Icon name="up" className="cd-ic--sm" />
                                  </button>
                                  <button
                                    type="button"
                                    className="cd-iconbtn"
                                    disabled={li === lessons.length - 1}
                                    onClick={() => handleMoveLesson(unit, li, 1)}
                                    aria-label={t("تحريك لأسفل", "Move down")}
                                    title={t("تحريك لأسفل", "Move down")}
                                  >
                                    <Icon name="down" className="cd-ic--sm" />
                                  </button>
                                  <button
                                    type="button"
                                    className="cd-iconbtn"
                                    onClick={() =>
                                      setModalState({ type: "delete-lesson", unitId: unit.id, lesson: l })
                                    }
                                    aria-label={t("حذف", "Delete")}
                                    title={t("حذف", "Delete")}
                                  >
                                    <Icon name="trash" className="cd-ic--sm" />
                                  </button>
                                </div>
                              )}
                            </li>
                          );
                        })
                      )}
                    </ul>
                  )}
                </section>
              );
            })
          )}
        </div>
      </div>

      {/* Modal Dialog for Add Unit, Add Lesson, Delete Lesson */}
      {modalState && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "grid",
            placeItems: "center",
            zIndex: 1000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalState(null);
          }}
        >
          <div
            className="cd-card"
            style={{ width: "min(460px, 92vw)", padding: 24, boxShadow: "var(--sh-xl)" }}
          >
            {modalState.type === "add-unit" && (
              <div>
                <h2 className="cd-modal__h">{t("إضافة وحدة دراسية جديدة", "Add New Section")}</h2>
                <div style={{ marginBlock: "16px" }}>
                  <label className="ma-label" style={{ color: "var(--text)" }}>
                    {t("عنوان الوحدة", "Section name")}
                    <input
                      className="ma-input"
                      autoFocus
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && inputValue.trim()) {
                          createUnitMut.mutate(inputValue.trim());
                        }
                      }}
                      placeholder={t("مثال: الوحدة الأولى", "e.g. Unit 1")}
                      style={{ marginBlockStart: 8 }}
                    />
                  </label>
                </div>
                <div className="cd-modal__f" style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button
                    type="button"
                    className="ma-btn ma-btn--soft"
                    onClick={() => setModalState(null)}
                  >
                    {t("إلغاء", "Cancel")}
                  </button>
                  <button
                    type="button"
                    className="ma-btn ma-btn--primary"
                    disabled={!inputValue.trim() || createUnitMut.isPending}
                    onClick={() => createUnitMut.mutate(inputValue.trim())}
                  >
                    {createUnitMut.isPending ? t("جاري الحفظ...", "Saving...") : t("إضافة", "Add")}
                  </button>
                </div>
              </div>
            )}

            {modalState.type === "add-lesson" && (
              <div>
                <h2 className="cd-modal__h">{t("إضافة درس جديد", "Add New Lesson")}</h2>
                <div style={{ marginBlock: "16px" }}>
                  <label className="ma-label" style={{ color: "var(--text)" }}>
                    {t("عنوان الدرس", "Lesson name")}
                    <input
                      className="ma-input"
                      autoFocus
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && inputValue.trim()) {
                          createLessonMut.mutate({ unitId: modalState.unitId, name: inputValue.trim() });
                        }
                      }}
                      placeholder={t("مثال: مقدمة في المفهوم", "e.g. Introduction")}
                      style={{ marginBlockStart: 8 }}
                    />
                  </label>
                </div>
                <div className="cd-modal__f" style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button
                    type="button"
                    className="ma-btn ma-btn--soft"
                    onClick={() => setModalState(null)}
                  >
                    {t("إلغاء", "Cancel")}
                  </button>
                  <button
                    type="button"
                    className="ma-btn ma-btn--primary"
                    disabled={!inputValue.trim() || createLessonMut.isPending}
                    onClick={() =>
                      createLessonMut.mutate({ unitId: modalState.unitId, name: inputValue.trim() })
                    }
                  >
                    {createLessonMut.isPending ? t("جاري الإضافة...", "Adding...") : t("إضافة", "Add")}
                  </button>
                </div>
              </div>
            )}

            {modalState.type === "delete-lesson" && (
              <div>
                <h2 className="cd-modal__h">{t("تأكيد حذف الدرس", "Confirm Delete Lesson")}</h2>
                <p className="cd-muted" style={{ marginBlock: "12px 20px" }}>
                  {t(
                    `هل أنت متأكد من حذف الدرس "${modalState.lesson.name}"؟`,
                    `Are you sure you want to delete lesson "${modalState.lesson.name}"?`
                  )}
                </p>
                <div className="cd-modal__f" style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button
                    type="button"
                    className="ma-btn ma-btn--soft"
                    onClick={() => setModalState(null)}
                  >
                    {t("إلغاء", "Cancel")}
                  </button>
                  <button
                    type="button"
                    className="ma-btn ma-btn--danger-soft"
                    disabled={deleteLessonMut.isPending}
                    onClick={() =>
                      deleteLessonMut.mutate({
                        unitId: modalState.unitId,
                        lessonId: modalState.lesson.id,
                      })
                    }
                  >
                    {deleteLessonMut.isPending ? t("جاري الحذف...", "Deleting...") : t("حذف", "Delete")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
