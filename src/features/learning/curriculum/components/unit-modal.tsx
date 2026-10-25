import { useState, type FormEvent } from "react";
import { Clock } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button, ErrorAlert } from "@/components/ui/kit";
import { useT } from "@/lib/i18n";
import { formatDurationSeconds, formatHumanDuration } from "@/lib/format";
import type { CurriculumUnit, CreateUnitInput, UpdateUnitInput } from "@/lib/api";

export interface UnitModalProps {
  unit?: CurriculumUnit | null;
  loading?: boolean;
  error?: unknown;
  onSave: (data: CreateUnitInput | UpdateUnitInput) => void;
  onClose: () => void;
}

export function UnitModal({ unit, loading, error, onSave, onClose }: UnitModalProps) {
  const t = useT();
  const isEdit = Boolean(unit);

  const initialDuration = unit?.duration != null ? Math.round(unit.duration) : 0;
  const initialHours = Math.floor(initialDuration / 3600);
  const initialMins = Math.floor((initialDuration % 3600) / 60);
  const initialSecs = initialDuration % 60;

  const [name, setName] = useState(unit?.name ?? "");
  const [description, setDescription] = useState(unit?.description ?? "");
  const [hours, setHours] = useState(initialHours > 0 ? String(initialHours) : "");
  const [mins, setMins] = useState(initialMins > 0 ? String(initialMins) : "");
  const [secs, setSecs] = useState(initialSecs > 0 ? String(initialSecs) : "");

  const parsedHours = parseInt(hours || "0", 10) || 0;
  const parsedMins = parseInt(mins || "0", 10) || 0;
  const parsedSecs = parseInt(secs || "0", 10) || 0;
  const totalSeconds = (parsedHours * 3600) + (parsedMins * 60) + parsedSecs;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const parsedDuration = totalSeconds > 0 ? totalSeconds : undefined;

    if (isEdit) {
      onSave({
        name: name.trim(),
        description: description.trim() || null,
        duration: parsedDuration,
      });
    } else {
      onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        duration: parsedDuration,
      });
    }
  };

  const modalTitle = isEdit
    ? t("تعديل القسم / الوحدة", "Edit Unit")
    : t("إضافة قسم / وحدة جديدة", "Add Unit");

  return (
    <Modal
      open={true}
      onOpenChange={(open) => !open && onClose()}
      title={modalTitle}
      size="sm"
    >
      <ErrorAlert error={error} />

      <form onSubmit={handleSubmit} className="ma-stack" style={{ gap: "var(--space-4)" }}>
        <label className="ma-field">
          <span className="ma-field__label">{t("عنوان القسم / الوحدة", "Unit Title")} *</span>
          <input
            type="text"
            required
            autoFocus
            className="ma-field__input"
            placeholder={t("مثال: الجزء الأول: أساسيات الاجتماع الفعال", "e.g. Part 1: Effective Meeting Basics")}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className="ma-field">
          <span className="ma-field__label">{t("وصف اختياري", "Description (optional)")}</span>
          <textarea
            rows={3}
            className="ma-field__input"
            placeholder={t("نبذة عن هذا القسم وما يتعلمه الطالب…", "Overview of what is covered in this section…")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        {/* Duration Section: Hours, Minutes, Seconds */}
        <div className="ma-field">
          <span className="ma-field__label">{t("المدة التقديرية للقسم (اختياري)", "Estimated Unit Duration (optional)")}</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-2)" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{t("ساعات", "Hours")}</span>
              <input
                type="number"
                min="0"
                className="ma-field__input"
                placeholder="0"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{t("دقائق", "Minutes")}</span>
              <input
                type="number"
                min="0"
                max="59"
                className="ma-field__input"
                placeholder="0"
                value={mins}
                onChange={(e) => setMins(e.target.value)}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{t("ثواني", "Seconds")}</span>
              <input
                type="number"
                min="0"
                max="59"
                className="ma-field__input"
                placeholder="0"
                value={secs}
                onChange={(e) => setSecs(e.target.value)}
              />
            </label>
          </div>

          {totalSeconds > 0 ? (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                marginTop: "8px",
                padding: "4px 10px",
                background: "var(--surface-alt)",
                borderRadius: "var(--radius-pill)",
                border: "1px solid var(--line)",
                fontSize: "12px",
                color: "var(--primary)",
                fontWeight: 600,
              }}
            >
              <Clock size={13} aria-hidden />
              <span>
                {t(
                  `المدة المحددة: ${formatHumanDuration(totalSeconds)} (${formatDurationSeconds(totalSeconds)})`,
                  `Duration: ${formatHumanDuration(totalSeconds, false)} (${formatDurationSeconds(totalSeconds)})`
                )}
              </span>
            </div>
          ) : null}

          <small style={{ color: "var(--text-muted)", fontSize: "12px", marginTop: "4px", display: "block" }}>
            {t("إذا تُركت فارغة، تُحسب مدة القسم تلقائيًا من مجموع مدة دروسه.", "If left blank, section duration is computed automatically from its lessons.")}
          </small>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
          <Button kind="secondary" label={t("إلغاء", "Cancel")} onClick={onClose} disabled={loading} />
          <Button
            kind="primary"
            type="submit"
            label={isEdit ? t("حفظ التعديلات", "Save Changes") : t("إضافة القسم", "Add Unit")}
            disabled={loading || !name.trim()}
          />
        </div>
      </form>
    </Modal>
  );
}
