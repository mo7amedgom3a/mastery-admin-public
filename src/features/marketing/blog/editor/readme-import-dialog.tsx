import { useMemo, useState } from "react";
import { BookOpen, FileCode, Layers, ListTree, RotateCcw, Sparkles } from "lucide-react";

import { Button, ErrorAlert } from "@/components/ui/kit";
import { toast } from "@/components/ui/toast";
import { useT } from "@/lib/i18n";
import { sanitizeParsedBlocks } from "@/features/marketing/blog/model/document";
import type { BlogEditor, BlogPartialBlock } from "@/features/marketing/blog/editor/blog-schema";

const TEMPLATES = {
  full: `# كيف تبدأ رحلتك في تعلّم البرمجة من الصفر

دليل عملي مختصر يشرح الخطوات الأولى لتعلم البرمجة، وكيف تختار مسارك وتتجنب الأخطاء الشائعة.

## لماذا نتعلّم البرمجة الآن؟
البرمجة أصبحت مهارة أساسية في معظم المجالات، من تحليل البيانات إلى تصميم المنتجات الرقمية. تعلمها يمنحك القدرة على بناء حلول حقيقية بدل الاعتماد على الأدوات الجاهزة فقط.

## الخطوة الأولى: اختر لغة واحدة
- ابدأ بلغة واحدة تناسب هدفك
- تعلّم الأساسيات قبل الأطر الحديثة
- خصص وقتاً ثابتاً للتدريب اليومي

## الخطوة الثانية: ابنِ مشروعاً صغيراً
> أفضل طريقة للتعلم هي بناء شيء تستخدمه فعلاً، حتى لو كان بسيطاً.

## الخطوة الثالثة: راجع وتعلّم من الأخطاء
- اقرأ رسائل الخطأ بتمعّن
- ابحث عن الحل ثم أعد كتابته بنفسك
- شارك مشروعك واطلب ملاحظات

## الخلاصة
التعلم المستمر والتطبيق العملي هما الفرق الحقيقي بين من يبدأ ومن يستمر.
`,

  listicle: `# 7 عادات يومية لتحسين إنتاجيتك في التعلم

عادات صغيرة يمكن تطبيقها اليوم لتحسين تركيزك ونتائجك الدراسية.

## 1. ابدأ بأصعب مهمة
- حدد المهمة الأصعب في بداية اليوم
- أنجزها قبل فتح البريد أو وسائل التواصل

## 2. راجع ما تعلمته أمس
- خمس دقائق مراجعة تكفي لتثبيت المعلومة
- اكتب سؤالاً واحداً يحتاج توضيحاً

## 3. تعلّم في جلسات قصيرة
> جلسات 25 دقيقة مع استراحة 5 دقائق أفضل من ساعات متصلة بلا تركيز.

## 4. طبّق فوراً
- حوّل كل مفهوم إلى تمرين صغير
- اكتب ملاحظة تطبيقية بعد كل درس

## 5. قس تقدمك أسبوعياً
- سجل ما أنجزته
- حدد هدفاً واحداً للأسبوع القادم

## الخلاصة
العادات الصغيرة المتكررة تصنع فرقاً كبيراً مع الوقت.
`,

  case: `# دراسة حالة: كيف وتحسّن أداء فريق صغير؟

ملخص تجربة عملية لتحسين سير العمل وتقليل الوقت المهدر داخل فريق من خمسة أشخاص.

## المشكلة
كان الفريق يعمل على مهام متداخلة دون وضوح في الأولويات، ما أدى إلى تأخير التسليم وتكرار العمل.

## ما الذي جرّبناه؟
- توحيد قناة واحدة للمهام
- اجتماع أسبوعي قصير لتحديد الأولويات
- مراجعة أسبوعية للنتائج

## النتائج
> انخفض وقت الاجتماعات إلى النصف، وتحسّن وضوح المسؤوليات بشكل ملحوظ.

## الدروس المستفادة
- الوضوح أهم من كثرة الأدوات
- المراجعة المنتظمة تكشف المشكلات مبكراً
- التوثيق البسيط يقلل الاعتماد على الأفراد
`,
};

export type ReadmeImportDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  editor: BlogEditor | null;
  initialMarkdown?: string;
  onApplyBlocks: (blocks: BlogPartialBlock[], mode: "replace" | "append") => void;
  onUpdateMeta?: (meta: { title?: string; summary?: string }) => void;
};

/** First `#` heading and the first plain paragraph: what the importer offers as the post title and summary. */
function articleMeta(markdown: string): { title: string; summary: string } {
  let title = "";
  let summary = "";
  for (const raw of markdown.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (!title && /^#\s+/.test(line)) {
      title = line.replace(/^#\s+/, "").trim();
      continue;
    }
    if (title && !summary && !line.startsWith("#") && !line.startsWith("-") && !line.startsWith("*") && !line.startsWith(">")) {
      summary = line;
      break;
    }
  }
  return { title, summary };
}

/** Markdown textarea + article templates; parses to blog blocks and replaces or appends them. */
export function ReadmeImportDialog({
  isOpen,
  onClose,
  editor,
  initialMarkdown,
  onApplyBlocks,
  onUpdateMeta,
}: ReadmeImportDialogProps) {
  const t = useT();
  const [markdown, setMarkdown] = useState(initialMarkdown?.trim() ? initialMarkdown : TEMPLATES.full);
  const [applyMode, setApplyMode] = useState<"replace" | "append">("replace");
  const [updateMeta, setUpdateMeta] = useState(true);
  const [isBuilding, setIsBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meta = useMemo(() => articleMeta(markdown), [markdown]);

  if (!isOpen) return null;

  const build = async () => {
    const trimmed = markdown.trim();
    if (!trimmed) {
      setError(t("يرجى إدخال نص Markdown أولاً.", "Please enter Markdown text first."));
      return;
    }
    if (!editor) {
      setError(t("المحرر غير جاهز حالياً. يرجى المحاولة بعد لحظات.", "Editor is not ready yet. Please try again."));
      return;
    }
    try {
      setIsBuilding(true);
      setError(null);
      const rawBlocks = await Promise.resolve(editor.tryParseMarkdownToBlocks(trimmed));
      const blocks = sanitizeParsedBlocks(rawBlocks);
      if (!blocks.length) throw new Error(t("تعذّر تحويل النص إلى كتل صالحة.", "Failed to convert text into valid blocks."));
      onApplyBlocks(blocks, applyMode);
      if (updateMeta && onUpdateMeta) {
        onUpdateMeta({ title: meta.title || undefined, summary: meta.summary || undefined });
      }
      toast.success(
        t(`تم بناء محتوى المقال (${blocks.length} كتلة).`, `Article content built (${blocks.length} blocks).`),
      );
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsBuilding(false);
    }
  };

  return (
    <div className="ma-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        className="ma-studio-dialog"
        style={{ inlineSize: "min(860px, calc(100vw - 32px))" }}
        role="dialog"
        aria-modal="true"
        aria-label={t("بناء المقال من Markdown", "Build the article from Markdown")}
        onKeyDown={(event) => event.key === "Escape" && onClose()}
      >
        <div className="ma-studio-dialog__head">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div className="ma-blog-dialog__icon">
              <FileCode size={20} />
            </div>
            <div>
              <strong style={{ fontSize: "16px", display: "block" }}>
                {t("استيراد README / Markdown", "Import README / Markdown")}
              </strong>
              <p className="ma-studio-dialog__text" style={{ fontSize: "12px", margin: 0 }}>
                {t(
                  "حوّل نص Markdown إلى كتل قابلة للتحرير في المحرر. يمكنك استبدال المحتوى أو إضافته في النهاية.",
                  "Turn Markdown text into editable blocks. Replace the content or append it at the end.",
                )}
              </p>
            </div>
          </div>
          <button type="button" className="ma-sblock__btn" onClick={onClose} aria-label={t("إغلاق", "Close")}>
            ×
          </button>
        </div>

        <div className="ma-blog-templates">
          <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)" }}>
            {t("نماذج جاهزة:", "Templates:")}
          </span>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <button type="button" className="ma-sblock__btn" onClick={() => setMarkdown(TEMPLATES.full)}>
              <Sparkles size={12} /> {t("مقال كامل", "Full article")}
            </button>
            <button type="button" className="ma-sblock__btn" onClick={() => setMarkdown(TEMPLATES.listicle)}>
              <ListTree size={12} /> {t("قائمة مرقمة", "Listicle")}
            </button>
            <button type="button" className="ma-sblock__btn" onClick={() => setMarkdown(TEMPLATES.case)}>
              <BookOpen size={12} /> {t("دراسة حالة", "Case study")}
            </button>
            <button type="button" className="ma-sblock__btn" style={{ color: "var(--danger)" }} onClick={() => setMarkdown("")}>
              <RotateCcw size={12} /> {t("مسح", "Clear")}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="blog-readme-code" className="ma-label" style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
            <span>{t("نص Markdown:", "Markdown text:")}</span>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "normal" }}>
              {t("# عنوان  ## قسم  - نقطة  > اقتباس", "# Title  ## Section  - Bullet  > Quote")}
            </span>
          </label>
          <textarea
            id="blog-readme-code"
            className="ma-input ma-textarea"
            rows={12}
            value={markdown}
            onChange={(event) => setMarkdown(event.target.value)}
            placeholder={t("اكتب أو الصق نص Markdown هنا…", "Write or paste Markdown here…")}
            style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "13px", lineHeight: "1.6", unicodeBidi: "plaintext", resize: "vertical" }}
            autoFocus
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", fontSize: "12px", color: "var(--text-muted)" }}>
          {meta.title ? (
            <span className="ma-blog-chip">
              <strong>{t("العنوان:", "Title:")}</strong> {meta.title}
            </span>
          ) : null}
          <span className="ma-blog-chip">
            <Layers size={13} /> <strong>{t("الأسطر:", "Lines:")}</strong> {markdown.split("\n").filter((line) => line.trim()).length}
          </span>
        </div>

        <div className="ma-blog-dialog__options">
          <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600 }}>{t("طريقة التطبيق:", "Apply as:")}</span>
            <label className="ma-check">
              <input type="radio" name="blog-import-mode" checked={applyMode === "replace"} onChange={() => setApplyMode("replace")} />
              <span>{t("استبدال المحتوى بالكامل", "Replace the whole article")}</span>
            </label>
            <label className="ma-check">
              <input type="radio" name="blog-import-mode" checked={applyMode === "append"} onChange={() => setApplyMode("append")} />
              <span>{t("إضافة إلى النهاية", "Append at the end")}</span>
            </label>
          </div>
          <label className="ma-check">
            <input type="checkbox" checked={updateMeta} onChange={(event) => setUpdateMeta(event.target.checked)} />
            <span>{t("تحديث عنوان ونبذة المقال تلقائياً", "Update the post title and summary automatically")}</span>
          </label>
        </div>

        {error ? <ErrorAlert error={error} title={t("خطأ أثناء بناء المحتوى", "Error building content")} /> : null}

        <div className="ma-studio-actions">
          <Button
            kind="primary"
            icon="check"
            label={isBuilding ? t("جارٍ البناء…", "Building…") : t("بناء المقال", "Build the article")}
            disabled={isBuilding || !markdown.trim()}
            onClick={() => void build()}
          />
          <Button kind="ghost" label={t("إلغاء", "Cancel")} onClick={onClose} disabled={isBuilding} />
        </div>
      </div>
    </div>
  );
}
