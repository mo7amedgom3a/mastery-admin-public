import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { createLiveDiploma } from "@/lib/api";
import { productTabHref } from "@/lib/refs";
import { useT } from "@/lib/i18n";
import { toast } from "@/components/ui/toast";
import { Card, Field, PageHead } from "@/components/ui/kit";
import {
  ClassificationCard,
  EMPTY_GENERAL_INFO,
  GeneralInfoCard,
  InstructorsCard,
  isGeneralInfoValid,
  isPriceRequiredValid,
  isValidSlug,
  ListEditor,
  optional,
  parseOptionalNumber,
  parsePrice,
  ProductFormAside,
  SlugField,
  toSlug,
  useCatalogOptions,
  type GeneralInfo,
} from "@/features/learning/product-form";

/**
 * Create a live diploma (`POST /admin/catalog/live-diplomas`). A cohort-based, live-taught diploma;
 * cohorts are scheduled afterwards from the product page.
 */

const TIMEZONES: [string, string][] = [
  ["Asia/Riyadh", "Asia/Riyadh"],
  ["Asia/Dubai", "Asia/Dubai"],
  ["Africa/Cairo", "Africa/Cairo"],
  ["Europe/London", "Europe/London"],
  ["UTC", "UTC"],
];

export default function LiveDiplomaNewPage() {
  const t = useT();
  const navigate = useNavigate();
  const options = useCatalogOptions();

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [priceUsd, setPriceUsd] = useState("");
  const [published, setPublished] = useState(false);
  const [timezone, setTimezone] = useState("Asia/Riyadh");
  const [startsAt, setStartsAt] = useState("");
  const [sessionCount, setSessionCount] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [brochureUrl, setBrochureUrl] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const [learningOutcomes, setLearningOutcomes] = useState<string[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [instructorIds, setInstructorIds] = useState<number[]>([]);
  const [general, setGeneral] = useState<GeneralInfo>(EMPTY_GENERAL_INFO);

  const setTitleSafe = (value: string) => {
    setTitle(value);
    if (!slugEdited) setSlug(toSlug(value));
  };

  const priceValue = parsePrice(priceUsd);
  const priceInvalid = !isPriceRequiredValid(priceUsd, 0.01);

  const create = useMutation({
    mutationFn: () =>
      createLiveDiploma({
        slug,
        title: title.trim(),
        short_description: optional(shortDescription),
        description: optional(description),
        price_usd: priceValue ?? 0,
        status: published ? "published" : "draft",
        seat_capacity: 0,
        starts_at: startsAt ? new Date(startsAt).toISOString() : null,
        timezone_name: timezone,
        session_count: sessionCount.trim() === "" ? null : Number(sessionCount),
        brochure_url: optional(brochureUrl),
        source_url: optional(sourceUrl),
        image_url: optional(imageUrl),
        tags,
        skill_ids: skillIds,
        learning_outcomes: learningOutcomes.map((item) => item.trim()).filter(Boolean),
        category_ids: categoryIds,
        instructor_ids: instructorIds,
        access_duration_days: general.lifetimeAccess ? null : Number(general.accessDurationDays),
        duration_hours: parseOptionalNumber(general.durationHours),
      }),
    onSuccess: (diploma) => {
      toast.success(t("تم إنشاء الدبلوم المباشر", "Live diploma created"));
      navigate(productTabHref(diploma.ref, "live_diploma"));
    },
  });

  const invalid =
    !title.trim() ||
    !isValidSlug(slug) ||
    priceInvalid ||
    categoryIds.length === 0 ||
    instructorIds.length === 0 ||
    !isGeneralInfoValid(general);

  return (
    <>
      <PageHead
        title={t("إنشاء دبلوم مباشر", "Create a live diploma")}
        sub={t(
          "دبلوم يُقدَّم مباشرة عبر جلسات؛ تُجدول المجموعات بعد الإنشاء من صفحة المنتج.",
          "A live-taught diploma; cohorts are scheduled after creating it, from the product page.",
        )}
        back={{ href: "/learning/catalog?type=live_diploma", label: t("المنتجات", "Products") }}
      />

      <form
        className="ma-form-layout"
        onSubmit={(event) => {
          event.preventDefault();
          if (!invalid) create.mutate();
        }}
      >
        <div className="ma-form-main">
          <Card title={t("البيانات الأساسية", "Basic details")}>
            <div className="ma-form">
              <Field id="ld-title" label={t("الاسم", "Name")} required value={title} onChange={setTitleSafe} />
              <SlugField
                id="ld-slug"
                required
                value={slug}
                onChange={(value) => {
                  setSlug(value);
                  setSlugEdited(true);
                }}
                onRegenerate={() => {
                  setSlug(toSlug(title));
                  setSlugEdited(false);
                }}
                hint={t(
                  "مطلوب؛ حروف لاتينية صغيرة وأرقام وشرطات فقط.",
                  "Required; lowercase Latin letters, numbers and hyphens only.",
                )}
              />
              {slug && !isValidSlug(slug) ? (
                <span className="ma-help" style={{ color: "var(--danger)" }}>
                  {t("صيغة الرابط غير صحيحة.", "Invalid slug format.")}
                </span>
              ) : null}
              <Field
                id="ld-short"
                label={t("وصف مختصر", "Short description")}
                value={shortDescription}
                onChange={setShortDescription}
              />
              <Field
                id="ld-description"
                type="textarea"
                rows={5}
                label={t("الوصف", "Description")}
                value={description}
                onChange={setDescription}
              />
            </div>
          </Card>

          <Card title={t("التسعير والجدولة", "Pricing & schedule")}>
            <div className="ma-form">
              <div className="ma-form-grid ma-form-grid--2">
                <Field
                  id="ld-price"
                  type="number"
                  min={0.01}
                  step="0.01"
                  dir="ltr"
                  required
                  label={t("السعر (USD)", "Price (USD)")}
                  value={priceUsd}
                  onChange={setPriceUsd}
                  hint={priceInvalid ? t("مطلوب؛ أكبر من صفر.", "Required; greater than zero.") : undefined}
                />
                <Field
                  id="ld-timezone"
                  label={t("المنطقة الزمنية", "Timezone")}
                  options={TIMEZONES}
                  value={timezone}
                  onChange={setTimezone}
                />
                <Field
                  id="ld-start"
                  type="datetime-local"
                  dir="ltr"
                  label={t("تاريخ البدء", "Starts at")}
                  value={startsAt}
                  onChange={setStartsAt}
                />
                <Field
                  id="ld-sessions"
                  type="number"
                  min={1}
                  dir="ltr"
                  label={t("عدد الجلسات", "Session count")}
                  value={sessionCount}
                  onChange={setSessionCount}
                />
              </div>
            </div>
          </Card>

          <Card title={t("الروابط والوسائط", "Links & media")}>
            <div className="ma-form">
              <Field id="ld-image" dir="ltr" label={t("رابط الصورة", "Image URL")} value={imageUrl} onChange={setImageUrl} />
              <div className="ma-form-grid ma-form-grid--2">
                <Field id="ld-brochure" dir="ltr" label={t("رابط البروشور", "Brochure URL")} value={brochureUrl} onChange={setBrochureUrl} />
                <Field id="ld-source" dir="ltr" label={t("رابط المصدر", "Source URL")} value={sourceUrl} onChange={setSourceUrl} />
              </div>
            </div>
          </Card>

          <GeneralInfoCard
            idPrefix="ld"
            info={general}
            onChange={(patch) => setGeneral((prev) => ({ ...prev, ...patch }))}
            showLevel={false}
          />

          <ClassificationCard
            idPrefix="ld"
            options={options}
            categoryIds={categoryIds}
            onCategoriesChange={setCategoryIds}
            skillIds={skillIds}
            onSkillsChange={setSkillIds}
            tags={tags}
            onTagsChange={setTags}
          >
            <ListEditor
              label={t("مخرجات التعلّم", "Learning outcomes")}
              items={learningOutcomes}
              onChange={setLearningOutcomes}
              placeholder={t("مخرَج تعلّم…", "A learning outcome…")}
            />
          </ClassificationCard>

          <InstructorsCard idPrefix="ld" options={options} instructorIds={instructorIds} onChange={setInstructorIds} />
        </div>

        <ProductFormAside
          typeLabel={t("دبلوم مباشر", "Live diploma")}
          price={priceUsd}
          priceLabel={t("السعر (USD)", "Price (USD)")}
          counts={[
            { label: t("التصنيفات", "Categories"), value: categoryIds.length },
            { label: t("المدربون", "Instructors"), value: instructorIds.length },
            { label: t("المهارات", "Skills"), value: skillIds.length },
            { label: t("الوسوم", "Tags"), value: tags.length },
            { label: t("مخرجات التعلّم", "Outcomes"), value: learningOutcomes.filter((item) => item.trim()).length },
          ]}
          published={published}
          onPublishedChange={setPublished}
          submitLabel={t("حفظ الدبلوم", "Save diploma")}
          pending={create.isPending}
          disabled={invalid}
          cancelHref="/learning/catalog?type=live_diploma"
          error={create.error}
          errorTitle={t("تعذّر حفظ الدبلوم", "Couldn't save the diploma")}
        />
      </form>
    </>
  );
}
