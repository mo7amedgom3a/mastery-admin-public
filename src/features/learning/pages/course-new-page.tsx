import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { createProduct } from "@/lib/api";
import { studioHref } from "@/lib/refs";
import { useT } from "@/lib/i18n";
import { toast } from "@/components/ui/toast";
import { Card, PageHead } from "@/components/ui/kit";
import {
  CoreCatalogFields,
  generalInfoPayload,
  isGeneralInfoValid,
  isPriceRequiredValid,
  PRICE_CURRENCY,
  optional,
  parsePrice,
  ProductFormAside,
  SegmentedChoice,
  trimmed,
  useCatalogForm,
  useCatalogOptions,
} from "@/features/learning/product-form";

/**
 * Create a course or a diploma (`POST /admin/catalog/products`, `product_type` = `course` |
 * `diploma`). Diplomas are the same B2C product with a different type; both open in the Studio.
 */

const TYPE_OPTIONS: { value: "course" | "diploma"; ar: string; en: string }[] = [
  { value: "course", ar: "دورة", en: "Course" },
  { value: "diploma", ar: "دبلوم", en: "Diploma" },
];

export default function CourseNewPage() {
  const t = useT();
  const navigate = useNavigate();
  const options = useCatalogOptions();
  const [productType, setProductType] = useState<"course" | "diploma">("course");
  const catalog = useCatalogForm();
  const { form } = catalog;

  const create = useMutation({
    mutationFn: () =>
      createProduct({
        product_type: productType,
        title: trimmed(form.title),
        title_en: optional(form.titleEn),
        short_description: optional(form.shortDescription),
        description: optional(form.description),
        price: parsePrice(form.price),
        currency_code: PRICE_CURRENCY,
        ...generalInfoPayload(form),
        slug: optional(form.slug),
        published: form.published,
        category_ids: form.categoryIds,
        keywords: form.keywords,
        marketing_tag: optional(form.marketingTag),
        skill_ids: form.skillIds,
        featured: form.featured,
        manual_accounting: form.manualAccounting,
        apple_store_id: optional(form.appleStoreId),
        google_store_id: optional(form.googleStoreId),
        instructor_ids: form.instructorIds,
      }),
    onSuccess: (view) => {
      toast.success(t("تم إنشاء المنتج بنجاح", "Product created"));
      navigate(studioHref(view.ref));
    },
  });

  const invalid =
    !form.title.trim() ||
    !isPriceRequiredValid(form.price) ||
    !isGeneralInfoValid(form) ||
    form.categoryIds.length === 0 ||
    form.instructorIds.length === 0;
  const typeLabel = productType === "diploma" ? t("دبلوم", "Diploma") : t("دورة", "Course");
  // Counts come from the same facets the storefront search page reads (`/search/options`).
  const typeCount = (code: string) => options.productTypes.find((item) => item.code === code)?.count;

  return (
    <>
      <PageHead
        title={t("إنشاء دورة أو دبلوم", "Create a course or diploma")}
        sub={t(
          "يُنشَأ المنتج على المنصة ثم يُفتح في الاستوديو لبناء المحتوى.",
          "Create the product, then open it in the Studio to build its content.",
        )}
        back={{ href: "/learning/catalog?type=course", label: t("المنتجات", "Products") }}
      />

      <form
        className="ma-form-layout"
        onSubmit={(event) => {
          event.preventDefault();
          if (!invalid) create.mutate();
        }}
      >
        <div className="ma-form-main">
          <Card title={t("نوع المنتج", "Product type")}>
            <div className="ma-form">
              <SegmentedChoice
                label={t("اختر النوع", "Choose a type")}
                value={productType}
                options={TYPE_OPTIONS.map((option) => {
                  const count = typeCount(option.value);
                  return {
                    value: option.value,
                    label: (
                      <>
                        {t(option.ar, option.en)}
                        {count != null ? <span className="ma-member__meta"> · {count}</span> : null}
                      </>
                    ),
                  };
                })}
                onChange={setProductType}
              />
              <p className="ma-note">
                {t(
                  "الدورة والدبلوم نوعان للمنتج نفسه؛ يختلفان في العرض داخل المتجر.",
                  "A course and a diploma are the same product with a different type; the storefront presents them differently.",
                )}
              </p>
            </div>
          </Card>

          <CoreCatalogFields {...catalog} form={form} options={options} showInstructors />
        </div>

        <ProductFormAside
          typeLabel={typeLabel}
          price={form.price}
          counts={[
            { label: t("التصنيفات", "Categories"), value: form.categoryIds.length },
            { label: t("المهارات", "Skills"), value: form.skillIds.length },
            { label: t("الكلمات", "Keywords"), value: form.keywords.length },
            { label: t("المدربون", "Instructors"), value: form.instructorIds.length },
          ]}
          published={form.published}
          onPublishedChange={(checked) => catalog.setField("published", checked)}
          submitLabel={t("حفظ المنتج", "Save product")}
          pending={create.isPending}
          disabled={invalid}
          cancelHref="/learning/catalog?type=course"
          error={create.error}
        />
      </form>
    </>
  );
}
