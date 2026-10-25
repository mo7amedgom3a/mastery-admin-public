import { useState, useRef, type FormEvent } from "react";
import { Clock, FileText, Upload, Check, ExternalLink } from "lucide-react";

import { Modal } from "@/components/ui/modal";
import { Button, ErrorAlert } from "@/components/ui/kit";
import { useT } from "@/lib/i18n";
import { formatDurationSeconds } from "@/lib/format";
import { uploadStudioAsset, type CurriculumLesson, type CreateLessonInput, type UpdateLessonInput } from "@/lib/api";

export interface LessonModalProps {
  productRef: string;
  unitId: number;
  lesson?: CurriculumLesson | null;
  loading?: boolean;
  error?: unknown;
  onSave: (data: CreateLessonInput | UpdateLessonInput) => void;
  onClose: () => void;
}

export function LessonModal({
  productRef,
  unitId: _unitId,
  lesson,
  loading,
  error,
  onSave,
  onClose,
}: LessonModalProps) {
  const t = useT();
  const isEdit = Boolean(lesson);

  const initialDuration = lesson?.duration != null ? Math.round(lesson.duration) : 0;
  const initialHours = Math.floor(initialDuration / 3600);
  const initialMins = Math.floor((initialDuration % 3600) / 60);
  const initialSecs = initialDuration % 60;

  const [name, setName] = useState(lesson?.name ?? "");
  const [hours, setHours] = useState(initialHours > 0 ? String(initialHours) : "");
  const [mins, setMins] = useState(initialMins > 0 ? String(initialMins) : "");
  const [secs, setSecs] = useState(initialSecs > 0 ? String(initialSecs) : "");
  const [isFree, setIsFree] = useState(lesson?.is_free ?? false);
  const [link, setLink] = useState(lesson?.link ?? "");
  const [notes, setNotes] = useState(lesson?.notes ?? lesson?.body ?? "");

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const file = files[0];
    setUploading(true);
    setUploadError(null);
    try {
      const asset = await uploadStudioAsset(productRef, file);
      setLink(asset.url);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : t("فشل رفع الملف", "Failed to upload file"));
    } finally {
      setUploading(false);
    }
  };

  const parsedHours = parseInt(hours || "0", 10) || 0;
  const parsedMins = parseInt(mins || "0", 10) || 0;
  const parsedSecs = parseInt(secs || "0", 10) || 0;
  const totalSeconds = (parsedHours * 3600) + (parsedMins * 60) + parsedSecs;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const duration = totalSeconds > 0 ? totalSeconds : undefined;

    const payload = {
      name: name.trim(),
      duration,
      is_free: isFree,
      link: link.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    onSave(payload);
  };

  const modalTitle = isEdit ? t("تعديل الدرس", "Edit Lesson") : t("إضافة درس جديد", "Add Lesson");

  return (
    <Modal
      open={true}
      onOpenChange={(open) => !open && onClose()}
      title={modalTitle}
      size="md"
    >
      <ErrorAlert error={error ?? uploadError} />

        <form onSubmit={handleSubmit} className="ma-stack" style={{ gap: "var(--space-3)" }}>
          <label className="ma-field">
            <span className="ma-field__label">{t("عنوان الدرس", "Lesson Title")} *</span>
            <input
              type="text"
              required
              autoFocus
              className="ma-field__input"
              placeholder={t("مثال: استعدادات ما قبل الاجتماع", "e.g. Pre-meeting preparations")}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          {/* Duration fields: Hours, Minutes & Seconds */}
          <div className="ma-field">
            <span className="ma-field__label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Clock size={14} aria-hidden />
              {t("مدة الدرس (ساعة : دقيقة : ثانية)", "Lesson Duration (hours : minutes : seconds)")}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="number"
                min="0"
                className="ma-field__input"
                style={{ width: "80px", textAlign: "center" }}
                placeholder={t("ساعة", "hrs")}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
              <span style={{ fontWeight: "bold", fontSize: "16px" }}>:</span>
              <input
                type="number"
                min="0"
                max="59"
                className="ma-field__input"
                style={{ width: "80px", textAlign: "center" }}
                placeholder={t("دقيقة", "mins")}
                value={mins}
                onChange={(e) => setMins(e.target.value)}
              />
              <span style={{ fontWeight: "bold", fontSize: "16px" }}>:</span>
              <input
                type="number"
                min="0"
                max="59"
                className="ma-field__input"
                style={{ width: "80px", textAlign: "center" }}
                placeholder={t("ثانية", "secs")}
                value={secs}
                onChange={(e) => setSecs(e.target.value)}
              />
              {totalSeconds > 0 ? (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--primary)",
                    background: "var(--surface-alt)",
                    padding: "4px 8px",
                    borderRadius: "var(--radius-pill)",
                    border: "1px solid var(--line)",
                    marginInlineStart: "4px",
                  }}
                >
                  <Clock size={12} aria-hidden />
                  {formatDurationSeconds(totalSeconds)}
                </span>
              ) : null}
            </div>
          </div>

          {/* Is Free Preview checkbox */}
          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", userSelect: "none" }}>
            <input
              type="checkbox"
              checked={isFree}
              onChange={(e) => setIsFree(e.target.checked)}
              style={{ width: "18px", height: "18px", accentColor: "var(--primary)" }}
            />
            <span style={{ fontSize: "14px", fontWeight: 500 }}>
              {t("معاينة مجانية (متاح لجميع الزوار بدون شراء)", "Free preview (accessible to all visitors without purchase)")}
            </span>
          </label>

          {/* Video or Asset Link & S3 Upload */}
          <div className="ma-field">
            <span className="ma-field__label" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>{t("رابط الفيديو أو الملف المرفق", "Video or Attached File URL")}</span>
              <button
                type="button"
                className="ma-sblock__btn"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                style={{ fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}
              >
                <Upload size={12} aria-hidden />
                {uploading ? t("جارٍ الرفع…", "Uploading…") : t("رفع ملف إلى S3", "Upload file to S3")}
              </button>
            </span>
            <input
              ref={fileInputRef}
              type="file"
              hidden
              onChange={(e) => {
                handleFileUpload(e.target.files);
                e.target.value = "";
              }}
            />
            <input
              type="text"
              className="ma-field__input"
              placeholder={t("https://… أو رابط الفيديو / الملف المرفق", "https://… or video / attached file link")}
              value={link}
              onChange={(e) => setLink(e.target.value)}
            />
            {link ? (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "6px", fontSize: "12px", color: "var(--text-muted)" }}>
                <FileText size={14} aria-hidden />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", direction: "ltr" }}>
                  {link}
                </span>
                <a href={link} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", color: "var(--primary)" }} title={t("فتح الرابط", "Open link")}>
                  <ExternalLink size={12} />
                </a>
              </div>
            ) : null}
          </div>

          {/* Notes / Body */}
          <label className="ma-field">
            <span className="ma-field__label">{t("ملاحظات أو نص الدرس", "Notes or lesson description")}</span>
            <textarea
              rows={3}
              className="ma-field__input"
              placeholder={t("أي ملاحظات توضيحية أو ملخص لمحتوى الدرس…", "Any explanatory notes or summary of the lesson…")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
            <Button kind="secondary" label={t("إلغاء", "Cancel")} onClick={onClose} disabled={loading || uploading} />
            <Button
              kind="primary"
              type="submit"
              label={isEdit ? t("حفظ التعديلات", "Save Changes") : t("إضافة الدرس", "Add Lesson")}
              disabled={loading || uploading || !name.trim()}
            />
          </div>
        </form>
    </Modal>
  );
}
