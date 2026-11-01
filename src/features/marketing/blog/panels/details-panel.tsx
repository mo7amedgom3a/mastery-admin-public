import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ImageIcon, Plus, Trash2 } from "lucide-react";

import { Field } from "@/components/ui/kit";
import { MultiSelect } from "@/components/ui/multi-select";
import { SelectField } from "@/components/ui/select";
import { blogQueries, type BlogCoverImage } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { isSafeUrl } from "@/features/marketing/blog/model/document";

export type BlogDetailsValue = {
  title: string;
  summary: string;
  slug: string;
  authorId: string | null;
  categoryIds: string[];
  tags: string[];
  cover: BlogCoverImage | null;
  seoTitle: string;
  seoDescription: string;
};

/** Post details: title, summary, slug, author, categories, tags, cover and SEO fields. */
export function DetailsPanel({
  value,
  editable = true,
  onChange,
  pickAsset,
}: {
  value: BlogDetailsValue;
  editable?: boolean;
  onChange: (patch: Partial<BlogDetailsValue>) => void;
  pickAsset: () => Promise<{ url: string; alt_text?: string | null } | null>;
}) {
  const t = useT();
  const [tagDraft, setTagDraft] = useState("");
  const authors = useQuery(blogQueries.authors());
  const categories = useQuery(blogQueries.categories());

  const authorOptions = [
    { value: "", label: t("بدون مؤلف", "No author") },
    ...(authors.data ?? []).map((author) => ({ value: author.instructor_id, label: author.name })),
  ];
  const categoryOptions = (categories.data ?? []).map((category) => ({
    value: category.category_id,
    label: category.name,
  }));

  const addTag = (raw: string) => {
    const tag = raw.trim();
    setTagDraft("");
    if (!tag || value.tags.length >= 10 || value.tags.some((item) => item.toLowerCase() === tag.toLowerCase())) return;
    onChange({ tags: [...value.tags, tag.slice(0, 100)] });
  };

  return (
    <div className="ma-studio-meta">
      <Field
        id="blog-title"
        label={t("العنوان", "Title")}
        value={value.title}
        maxLength={500}
        disabled={!editable}
        onChange={(title) => onChange({ title })}
      />
      <Field
        id="blog-summary"
        type="textarea"
        rows={4}
        label={t("النبذة", "Summary")}
        hint={t("تظهر تحت العنوان في صفحة المقال وقائمة المدونة.", "Shown under the title on the post page and the blog index.")}
        value={value.summary}
        maxLength={2000}
        disabled={!editable}
        onChange={(summary) => onChange({ summary })}
      />
      <Field
        id="blog-slug"
        label={t("الرابط (slug)", "Slug")}
        value={value.slug}
        maxLength={220}
        hint={t("أحرف إنجليزية صغيرة وأرقام وشرطات فقط.", "Lowercase letters, numbers and dashes only.")}
        disabled={!editable}
        onChange={(slug) => onChange({ slug })}
      />

      <div className="ma-field">
        <span className="ma-label">{t("المؤلف", "Author")}</span>
        <SelectField
          label={t("المؤلف", "Author")}
          value={value.authorId ?? ""}
          onChange={(authorId) => onChange({ authorId: authorId || null })}
          options={authorOptions}
          size="md"
          fullWidth
        />
        {authors.isError ? <span className="ma-help">{t("تعذّر تحميل المؤلفين.", "Couldn't load authors.")}</span> : null}
      </div>

      <div className="ma-field">
        <span className="ma-label">{t("التصنيفات", "Categories")}</span>
        <MultiSelect
          label={t("التصنيفات", "Categories")}
          options={categoryOptions}
          selected={value.categoryIds}
          onChange={(categoryIds) => onChange({ categoryIds })}
          searchPlaceholder={t("ابحث في التصنيفات…", "Search categories…")}
        />
        {categories.isError ? <span className="ma-help">{t("تعذّر تحميل التصنيفات.", "Couldn't load categories.")}</span> : null}
      </div>

      <div className="ma-field">
        <span className="ma-label">{t("الوسوم", "Tags")}</span>
        <div className="ma-taginput">
          {value.tags.map((tag) => (
            <span key={tag} className="ma-tag ma-tag--soft">
              {tag}
              {editable ? (
                <button
                  type="button"
                  aria-label={t(`إزالة ${tag}`, `Remove ${tag}`)}
                  onClick={() => onChange({ tags: value.tags.filter((item) => item !== tag) })}
                >
                  ×
                </button>
              ) : null}
            </span>
          ))}
          {editable ? (
            <input
              className="ma-input ma-taginput__input"
              value={tagDraft}
              placeholder={t("اكتب ثم Enter…", "Type then Enter…")}
              onChange={(event) => setTagDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === "," || event.key === "،") {
                  event.preventDefault();
                  addTag(tagDraft);
                } else if (event.key === "Backspace" && !tagDraft && value.tags.length) {
                  onChange({ tags: value.tags.slice(0, -1) });
                }
              }}
              onBlur={() => addTag(tagDraft)}
            />
          ) : null}
        </div>
        <span className="ma-help">{t("حتى 10 وسوم، تظهر في صفحة المقال.", "Up to 10 tags, shown on the post page.")}</span>
      </div>

      <div className="ma-field">
        <span className="ma-label">{t("صورة الغلاف", "Cover image")}</span>
        <div className="ma-studio-image">
          <button
            type="button"
            className="ma-studio-image__thumb"
            disabled={!editable}
            onClick={async () => {
              const asset = await pickAsset();
              if (asset) onChange({ cover: { url: asset.url, alt: asset.alt_text ?? value.title } });
            }}
          >
            {value.cover && isSafeUrl(value.cover.url) ? (
              <img src={value.cover.url} alt={value.cover.alt} />
            ) : (
              <ImageIcon size={22} aria-hidden />
            )}
          </button>
          <div className="ma-studio-image__side">
            <button
              type="button"
              className="ma-sblock__btn"
              disabled={!editable}
              onClick={async () => {
                const asset = await pickAsset();
                if (asset) onChange({ cover: { url: asset.url, alt: asset.alt_text ?? value.title } });
              }}
            >
              {value.cover ? t("تغيير الصورة", "Change image") : t("اختر من الوسائط", "Choose from assets")}
            </button>
            {value.cover ? (
              <button type="button" className="ma-sblock__btn" disabled={!editable} onClick={() => onChange({ cover: null })}>
                <Trash2 size={14} aria-hidden /> {t("إزالة", "Remove")}
              </button>
            ) : null}
          </div>
        </div>
        {value.cover ? (
          <Field
            id="blog-cover-alt"
            label={t("نص بديل للغلاف", "Cover alt text")}
            value={value.cover.alt}
            disabled={!editable}
            onChange={(alt) => onChange({ cover: { url: value.cover?.url ?? "", alt } })}
          />
        ) : null}
        {value.cover ? (
          <Field
            id="blog-cover-url"
            label={t("رابط الغلاف", "Cover URL")}
            value={value.cover.url}
            disabled={!editable}
            onChange={(url) => onChange({ cover: { url, alt: value.cover?.alt ?? "" } })}
          />
        ) : null}
      </div>

      <Field
        id="blog-seo-title"
        label={t("عنوان SEO (اختياري)", "SEO title (optional)")}
        value={value.seoTitle}
        maxLength={200}
        disabled={!editable}
        onChange={(seoTitle) => onChange({ seoTitle })}
      />
      <Field
        id="blog-seo-description"
        type="textarea"
        rows={3}
        label={t("وصف SEO (اختياري)", "SEO description (optional)")}
        value={value.seoDescription}
        maxLength={500}
        disabled={!editable}
        onChange={(seoDescription) => onChange({ seoDescription })}
      />
      <p className="ma-blog-hint">
        <Plus size={12} aria-hidden /> {t("تُحفظ كل التغييرات تلقائياً في المسودة.", "Every change is autosaved to the draft.")}
      </p>
    </div>
  );
}
