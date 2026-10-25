import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { createProduct } from "@/lib/api";
import { productTabHref } from "@/lib/refs";
import { useT } from "@/lib/i18n";
import { toast } from "@/components/ui/toast";
import { Card, Field, PageHead } from "@/components/ui/kit";
import {
  CheckPicker,
  ClassificationCard,
  isPriceRequiredValid,
  optional,
  parsePrice,
  PriceField,
  PRICE_CURRENCY,
  ProductFormAside,
  trimmed,
  useCatalogForm,
  useCatalogOptions,
} from "@/features/learning/product-form";

/**
 * Create a B2C consultation (`POST /admin/catalog/products`, `product_type` = `consultation`):
 * only the basic info, price and session length, plus the expert who takes the bookings. The
 * rest (availability, details) is added from the consultation's page right after it is created.
 */
export default function ConsultationNewPage() {
  const t = useT();
  const navigate = useNavigate();
  const options = useCatalogOptions();
  const catalog = useCatalogForm();
  const { form, toggle, setField } = catalog;

  const minutes = Number(form.durationMinutes);
  const minutesValid = Number.isInteger(minutes) && minutes >= 5 && minutes <= 600;

  const create = useMutation({
    mutationFn: () =>
      createProduct({
        product_type: "consultation",
        title: trimmed(form.title),
        title_en: optional(form.titleEn),
        short_description: optional(form.shortDescription),
        description: optional(form.description),
        price: parsePrice(form.price),
        currency_code: PRICE_CURRENCY,
        duration_minutes: minutes,
        published: form.published,
        category_ids: form.categoryIds,
        expert_ids: form.expertIds,
      }),
    onSuccess: (view) => {
      toast.success(t("تم إنشاء الاستشارة — أضف التفاصيل الآن", "Consultation created — add its details now"));
      navigate(productTabHref(view.ref, "consultation"));
    },
  });

  const invalid =
    !form.title.trim() ||
    !isPriceRequiredValid(form.price, 0.01) ||
    !minutesValid ||
    form.categoryIds.length === 0 ||
    form.expertIds.length === 0;

  return (
    <>
      <PageHead
        title={t("إنشاء استشارة", "Create a consultation")}
        sub={t(
          "أدخل البيانات الأساسية للاستشارة، ثم أكمل تفاصيلها بعد الإنشاء.",
          "Enter the consultation's basics; you'll complete its details right after creating it.",
        )}
        back={{ href: "/learning/catalog?type=consultation", label: t("المنتجات", "Products") }}
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
              <Field
                id="consultation-title"
                label={t("الاسم", "Name")}
                required
                value={form.title}
                onChange={catalog.setTitle}
              />
              <Field
                id="consultation-title-en"
                label={t("الاسم بالإنجليزية", "English name")}
                dir="ltr"
                value={form.titleEn}
                onChange={catalog.setTitleEn}
              />
              <Field
                id="consultation-short"
                label={t("وصف مختصر", "Short description")}
                value={form.shortDescription}
                onChange={(value) => setField("shortDescription", value)}
              />
              <Field
                id="consultation-description"
                type="textarea"
                rows={4}
                label={t("الوصف", "Description")}
                value={form.description}
                onChange={(value) => setField("description", value)}
              />
              <div className="ma-form-grid ma-form-grid--2">
                <PriceField
                  id="consultation-price"
                  label={t("سعر الجلسة (USD)", "Session price (USD)")}
                  value={form.price}
                  onChange={(value) => setField("price", value)}
                  invalid={form.price.trim() !== "" && !isPriceRequiredValid(form.price, 0.01)}
                />
                <Field
                  id="consultation-duration"
                  type="number"
                  min={5}
                  max={600}
                  step={5}
                  dir="ltr"
                  required
                  label={t("مدة الجلسة (دقيقة)", "Session length (minutes)")}
                  value={form.durationMinutes}
                  onChange={(value) => setField("durationMinutes", value)}
                  hint={!minutesValid ? t("بين 5 و600 دقيقة.", "Between 5 and 600 minutes.") : undefined}
                />
              </div>
            </div>
          </Card>

          <ClassificationCard
            idPrefix="consultation"
            options={options}
            categoryIds={form.categoryIds}
            onCategoriesChange={(ids) => catalog.setList("categoryIds", ids)}
            skillIds={[]}
            onSkillsChange={() => undefined}
            showSkills={false}
          />

          <Card title={t("الخبراء", "Experts")}>
            <div className="ma-form">
              <CheckPicker
                id="consultation-experts"
                label={t("اختر الخبراء", "Pick experts")}
                required
                options={options.consultants.map((consultant) => ({
                  value: consultant.legacy_consultant_id,
                  label: consultant.name ?? `#${consultant.legacy_consultant_id}`,
                }))}
                selected={form.expertIds}
                onToggle={(value) => toggle("expertIds", value)}
                onClear={() => catalog.setList("expertIds", [])}
                searchPlaceholder={t("ابحث في الخبراء…", "Search experts…")}
                emptyText={t("لا خبراء متاحون.", "No experts available.")}
                hint={t(
                  "تُعرض الاستشارة للخبراء المختارين فقط.",
                  "The consultation is offered by the selected experts only.",
                )}
              />
            </div>
          </Card>
        </div>

        <ProductFormAside
          typeLabel={t("استشارة", "Consultation")}
          price={form.price}
          counts={[
            { label: t("الخبراء", "Experts"), value: form.expertIds.length },
            { label: t("التصنيفات", "Categories"), value: form.categoryIds.length },
          ]}
          published={form.published}
          onPublishedChange={(checked) => setField("published", checked)}
          submitLabel={t("حفظ الاستشارة", "Save consultation")}
          pending={create.isPending}
          disabled={invalid}
          cancelHref="/learning/catalog?type=consultation"
          error={create.error}
          errorTitle={t("تعذّر حفظ الاستشارة", "Couldn't save the consultation")}
        />
      </form>
    </>
  );
}
