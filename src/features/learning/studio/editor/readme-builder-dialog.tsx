import { useState, useMemo } from "react";
import { BookOpen, FileCode, Layers, ListTree, RotateCcw, Sparkles } from "lucide-react";

import { Button, ErrorAlert } from "@/components/ui/kit";
import { useT } from "@/lib/i18n";
import { toast } from "@/components/ui/toast";
import type { StudioEditor as Editor, StudioPartialBlock } from "@/features/learning/studio/editor/schema";
import type { StudioMeta } from "@/lib/api";
import { extractSyllabusFromMarkdown, sanitizeParsedBlocks } from "./readme-parser";

const TEMPLATES = {
  full: `# دورة تطوير الويب الشاملة (Full-Stack Web Development)

دورة تدريبية عملية وشاملة تأخذك خطوة بخطوة من الصفر نحو الاحتراف في بناء وتطوير تطبيقات الويب الحديثة.

## نبذة عن الدورة
تغطي هذه الدورة كافة المفاهيم الأساسية والمتقدمة في بناء الواجهات التفاعلية والأنظمة الخلفية وقواعد البيانات مع تطبيق عملي على مشاريع حقيقية.

## ما ستتعلمه في هذه الدورة
- إتقان تقنيات الويب الأساسية وتطوير واجهات متجاوبة
- بناء مكونات برمجية تفاعلية وإدارة الحالة بكفاءة
- تصميم واجهات خلفية قوية وربطها بقواعد البيانات
- نشر وإدارة التطبيقات واختبار أدائها واستقرارها

## المتطلبات الأساسية
- شغف حقيقي بالتعلم والممارسة العملية المستمرة
- جهاز حاسوب متصل بالإنترنت ومعد للأدوات الأساسية

## محاور وأقسام الدورة
### الوحدة 1: الأساسيات وإعداد بيئة العمل
- نظرة عامة على الدورة وخريطة الطريق
- تثبيت الأدوات وضبط بيئة التطوير
### الوحدة 2: بناء وتصميم الواجهات
- أساسيات بناء المكونات التفاعلية
- التنسيق والتصميم المتجاوب مع الشاشات
### الوحدة 3: النظم الخلفية وقواعد البيانات
- تصميم واجهات برمجة التطبيقات APIs
- التعامل مع البيانات وتأمين العمليات
### الوحدة 4: المشروع العملي النهائي والنشر
- تجميع ميزات المشروع الشامل
- إطلاق ونشر التطبيق على السحابة

## الأسئلة الشائعة
> هل سأحصل على شهادة إتمام؟
> نعم، يحصل المتدرب على شهادة إتمام معتمدة فور إكمال كافة متطلبات الدورة ومشاريعها.
`,

  sectionsOnly: `# هيكل ومحاور منهج الدورة

## الوحدة 1: المفاهيم التأسيسية
- الدرس 1: نظرة تمهيدية وأهداف الوحدة
- الدرس 2: إعداد الأدوات ومتطلبات العمل
- الدرس 3: تدريب تمهيدي وتطبيق سريع

## الوحدة 2: المهارات الجوهرية والتطبيق العملي
- الدرس 1: التعمق في المفاهيم الأساسية
- الدرس 2: بناء أول نموذج عملي
- الدرس 3: أفضل الممارسات وحل المشكلات

## الوحدة 3: المشروع العملي والتقييم
- الدرس 1: متطلبات المشروع النهائي
- الدرس 2: التنفيذ والاختبار
- الدرس 3: مراجعة المشروع والخطوات القادمة
`,

  workshop: `# ورشة عمل تدريبية مكثفة

برنامج تدريبي تطبيقي مركز يهدف إلى نقل المعرفة العملية وتنفيذ نموذج واقعي خلال فترة وجيزة.

## أهداف ورشة العمل
- اكتساب المهارات العملية بشكل فوري ومباشر
- إنجاز نموذج تطبيقي متكامل خلال ورشة العمل

## جدول الأيام والمحاور
### اليوم الأول: التأسيس والتجهيز
- مقدمة في موضوع الورشة وأهم أهدافه
- التجهيز والبدء في الجزء العملي
### اليوم الثاني: التطبيق العملي وبناء النموذج
- العمل على النموذج الأولي خطوة بخطوة
- استعراض النتائج والتحسينات

## إرشادات هامة
> يُنصح بمتابعة الشرح وتطبيق كل خطوة بشكل فوري لضمان الاستفادة القصوى.
`,
};

export type ReadmeBuilderDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  editor: Editor | null;
  meta: StudioMeta;
  /** The product's current README: prefilled so the dialog starts from real content, not a template. */
  initialMarkdown?: string;
  onUpdateMeta?: (meta: StudioMeta) => void;
  onApplyBlocks: (blocks: StudioPartialBlock[], mode: "replace" | "append") => void;
  onSyncCurriculum?: (syllabus: { unitName: string; lessons: string[] }[]) => Promise<void>;
};

export function ReadmeBuilderDialog({
  isOpen,
  onClose,
  editor,
  meta,
  initialMarkdown,
  onUpdateMeta,
  onApplyBlocks,
  onSyncCurriculum,
}: ReadmeBuilderDialogProps) {
  const t = useT();
  const [markdown, setMarkdown] = useState(initialMarkdown?.trim() ? initialMarkdown : TEMPLATES.full);
  const [applyMode, setApplyMode] = useState<"replace" | "append">("replace");
  const [updateMeta, setUpdateMeta] = useState(true);
  const [syncCurriculum, setSyncCurriculum] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedInfo = useMemo(() => {
    return extractSyllabusFromMarkdown(markdown);
  }, [markdown]);

  if (!isOpen) return null;

  const handleBuild = async () => {
    const trimmed = markdown.trim();
    if (!trimmed) {
      setError(t("يرجى إدخال كود README أولاً.", "Please enter README code first."));
      return;
    }
    if (!editor) {
      setError(t("المحرر غير جاهز حالياً. يرجى المحاولة بعد لحظات.", "Editor is not ready yet. Please try again."));
      return;
    }

    try {
      setIsBuilding(true);
      setError(null);

      // Parse markdown to blocks via BlockNote
      const rawBlocks = await Promise.resolve(editor.tryParseMarkdownToBlocks(trimmed));
      const sanitized = sanitizeParsedBlocks(rawBlocks);

      if (!sanitized.length) {
        throw new Error(t("تعذّر تحويل النص إلى كتل صالحة.", "Failed to convert text into valid blocks."));
      }

      // Apply blocks to editor
      onApplyBlocks(sanitized, applyMode);

      // Optionally update meta
      if (updateMeta && onUpdateMeta) {
        const nextTitle = parsedInfo.title || meta.title;
        const nextSummary = parsedInfo.summary || meta.summary;
        if (nextTitle !== meta.title || nextSummary !== meta.summary) {
          onUpdateMeta({
            ...meta,
            title: nextTitle,
            summary: nextSummary,
          });
        }
      }

      // Optionally sync curriculum units & lessons
      if (syncCurriculum && onSyncCurriculum && parsedInfo.units.length > 0) {
        await onSyncCurriculum(parsedInfo.units);
      }

      toast.success(
        t(
          `تم بناء محتوى الصفحة بنجاح (${sanitized.length} كتلة)!`,
          `Page content built successfully (${sanitized.length} blocks)!`
        )
      );
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsBuilding(false);
    }
  };

  return (
    <div className="ma-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="ma-studio-dialog"
        style={{ inlineSize: "min(860px, calc(100vw - 32px))" }}
        role="dialog"
        aria-modal="true"
        aria-label={t("بناء الصفحة من كود README", "Build the page from README code")}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
      >
        <div className="ma-studio-dialog__head">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "var(--radius-soft)",
                background: "var(--surface-alt)",
                border: "1px solid var(--line)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--brand, #2563eb)",
              }}
            >
              <FileCode size={20} />
            </div>
            <div>
              <strong style={{ fontSize: "16px", display: "block" }}>
                {t("بناء سريع لمحتوى الصفحة من كود README", "Quick Build Page Content from README")}
              </strong>
              <p className="ma-studio-dialog__text" style={{ fontSize: "12px", margin: 0 }}>
                {t(
                  "يبدأ الحقل بنص README الحالي للمنتج. عدّله أو الصقه بصيغة Markdown لبناء المحتوى ككتل قابلة للتحرير.",
                  "The field starts with the product's current README. Edit or paste Markdown to build the content as editable blocks."
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="ma-sblock__btn"
            onClick={onClose}
            aria-label={t("إغلاق", "Close")}
            style={{ fontSize: "18px", lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* Templates bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "8px",
            padding: "var(--space-2) var(--space-3)",
            background: "var(--surface-alt)",
            borderRadius: "var(--radius-soft)",
            border: "1px solid var(--line)",
          }}
        >
          <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)" }}>
            {t("نماذج جاهزة للبدء السريع:", "Quick-start templates:")}
          </span>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="ma-sblock__btn"
              onClick={() => setMarkdown(TEMPLATES.full)}
              style={{ fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px" }}
            >
              <Sparkles size={12} />
              {t("دورة شاملة", "Full Course")}
            </button>
            <button
              type="button"
              className="ma-sblock__btn"
              onClick={() => setMarkdown(TEMPLATES.sectionsOnly)}
              style={{ fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px" }}
            >
              <ListTree size={12} />
              {t("محاور وأقسام", "Sections & Syllabus")}
            </button>
            <button
              type="button"
              className="ma-sblock__btn"
              onClick={() => setMarkdown(TEMPLATES.workshop)}
              style={{ fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px" }}
            >
              <BookOpen size={12} />
              {t("ورشة عمل", "Workshop")}
            </button>
            <button
              type="button"
              className="ma-sblock__btn"
              onClick={() => setMarkdown("")}
              style={{ fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px", color: "var(--danger)" }}
            >
              <RotateCcw size={12} />
              {t("مسح", "Clear")}
            </button>
          </div>
        </div>

        {/* Markdown Textarea */}
        <div>
          <label
            htmlFor="readme-code-editor"
            className="ma-label"
            style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}
          >
            <span>{t("كود الـ README (تنسيق Markdown):", "README code (Markdown syntax):")}</span>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "normal" }}>
              {t("# عنوان رئيسي  ## قسم جديد  ### درس فرعي  - عنصر قائمة  > تنبيه", "# Main Title  ## Section  ### Sub-lesson  - Bullet  > Note")}
            </span>
          </label>
          <textarea
            id="readme-code-editor"
            className="ma-input ma-textarea"
            rows={12}
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            placeholder={t("اكتب أو الصق نص الـ README هنا…", "Write or paste your README text here…")}
            style={{
              fontFamily: "var(--font-mono, monospace)",
              fontSize: "13px",
              lineHeight: "1.6",
              unicodeBidi: "plaintext",
              resize: "vertical",
            }}
            autoFocus
          />
          {initialMarkdown?.trim() ? (
            <p className="ma-studio__hint" style={{ margin: "6px 0 0" }}>
              {t(
                "هذا نص README المحفوظ للمنتج. «بناء» يحوّله إلى كتل في المحرر.",
                "This is the product's saved README. \"Build\" turns it into blocks in the editor.",
              )}
            </p>
          ) : null}
        </div>

        {/* Detected Info Chips */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
            fontSize: "12px",
            color: "var(--text-muted)",
          }}
        >
          {parsedInfo.title ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "2px 8px",
                background: "var(--surface-alt)",
                borderRadius: "var(--radius-soft)",
                border: "1px solid var(--line)",
              }}
            >
              <strong>{t("العنوان المكتشف:", "Title:")}</strong> {parsedInfo.title}
            </span>
          ) : null}
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "2px 8px",
              background: "var(--surface-alt)",
              borderRadius: "var(--radius-soft)",
              border: "1px solid var(--line)",
            }}
          >
            <Layers size={13} />
            <strong>{t("الأقسام المكتشفة:", "Sections detected:")}</strong> {parsedInfo.units.length}
          </span>
          {parsedInfo.units.some((u) => u.lessons.length > 0) ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "2px 8px",
                background: "var(--surface-alt)",
                borderRadius: "var(--radius-soft)",
                border: "1px solid var(--line)",
              }}
            >
              <ListTree size={13} />
              <strong>{t("الدروس/المحاور:", "Lessons/Topics:")}</strong>{" "}
              {parsedInfo.units.reduce((acc, u) => acc + u.lessons.length, 0)}
            </span>
          ) : null}
        </div>

        {/* Options */}
        <div
          style={{
            display: "grid",
            gap: "var(--space-2)",
            padding: "var(--space-3)",
            background: "var(--surface-alt)",
            borderRadius: "var(--radius-soft)",
            border: "1px solid var(--line)",
            fontSize: "13px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600 }}>{t("طريقة التطبيق في المحرر:", "Application mode in editor:")}</span>
            <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
              <input
                type="radio"
                name="readme-apply-mode"
                checked={applyMode === "replace"}
                onChange={() => setApplyMode("replace")}
              />
              {t("استبدال المحتوى بالكامل", "Replace entire course body")}
            </label>
            <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
              <input
                type="radio"
                name="readme-apply-mode"
                checked={applyMode === "append"}
                onChange={() => setApplyMode("append")}
              />
              {t("إضافة إلى نهاية المحتوى الحالي", "Append to end of current body")}
            </label>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap", marginTop: "4px" }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={updateMeta}
                onChange={(e) => setUpdateMeta(e.target.checked)}
              />
              {t("تحديث عنوان ونبذة الصفحة تلقائياً (من السطر الأول)", "Auto-update the page title & summary (from the first line)")}
            </label>

            {onSyncCurriculum && parsedInfo.units.length > 0 ? (
              <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={syncCurriculum}
                  onChange={(e) => setSyncCurriculum(e.target.checked)}
                />
                {t(
                  `إنشاء أقسام ودروس المنهج في تبويب محتوى الدورة (${parsedInfo.units.length} وحدات)`,
                  `Also create units & lessons in Curriculum tab (${parsedInfo.units.length} units)`
                )}
              </label>
            ) : null}
          </div>
        </div>

        {error ? <ErrorAlert error={error} title={t("خطأ أثناء بناء المحتوى", "Error building content")} /> : null}

        <div className="ma-studio-actions" style={{ marginTop: "4px" }}>
          <Button
            kind="primary"
            icon="check"
            label={isBuilding ? t("جارٍ البناء…", "Building…") : t("بناء محتوى الصفحة", "Build Page Content")}
            disabled={isBuilding || !markdown.trim()}
            onClick={handleBuild}
          />
          <Button kind="ghost" label={t("إلغاء", "Cancel")} onClick={onClose} disabled={isBuilding} />
        </div>
      </div>
    </div>
  );
}
