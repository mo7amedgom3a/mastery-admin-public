import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { createProduct } from "@/lib/api";
import { productTabHref } from "@/lib/refs";
import { useT } from "@/lib/i18n";
import { toast } from "@/components/ui/toast";
import { Card, PageHead } from "@/components/ui/kit";
import { productTypeLabel } from "@/lib/product-types";
import {
  CheckPicker,
  CoreCatalogFields,
  generalInfoPayload,
  isGeneralInfoValid,
  isPriceRequiredValid,
  PRICE_CURRENCY,
  optional,
  parsePrice,
  ProductFormAside,
  SelectedChips,
  trimmed,
  useCatalogForm,
  useCatalogOptions,
  useProductCards,
} from "@/features/learning/product-form";

/**
 * Create a B2C package (`POST /admin/catalog/products`, `product_type` = `package`) bundling
 * one or more courses/diplomas via `course_refs` (`b2c:<product_id>`).
 */
export default function PackageNewPage() {
  const t = useT();
  const navigate = useNavigate();
  const options = useCatalogOptions();
  const { cards, isLoading: cardsLoading } = useProductCards(["course", "diploma"]);
  const catalog = useCatalogForm();
  const { form, toggle } = catalog;

  const memberOptions = cards.map((card) => ({
    value: `b2c:${card.product_id}`,
    label: card.title ?? card.slug,
    hint: t(productTypeLabel(card.product_type).ar, productTypeLabel(card.product_type).en),
  }));
  const selectedMembers = memberOptions.filter((option) => form.courseRefs.includes(option.value as string));

  const create = useMutation({
    mutationFn: () =>
      createProduct({
        product_type: "package",
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
        course_refs: form.courseRefs,
      }),
    onSuccess: (view) => {
      toast.success(t("تم إنشاء الباقة بنجاح", "Bundle created"));
      navigate(productTabHref(view.ref, "package"));
    },
  });

  const invalid =
    !form.title.trim() ||
    !isPriceRequiredValid(form.price) ||
    !isGeneralInfoValid(form) ||
    form.courseRefs.length === 0;

  return (
    <>
      <PageHead
        title={t("إنشاء باقة", "Create a bundle")}
        sub={t(
          "اجمع دورات ودبلومات في باقة واحدة بسعر موحّد.",
          "Bundle courses and diplomas into one bundle at a single price.",
        )}
        back={{ href: "/learning/bundles", label: t("المنتجات", "Products") }}
      />

      <form
        className="ma-form-layout"
        onSubmit={(event) => {
          event.preventDefault();
          if (!invalid) create.mutate();
        }}
      >
        <div className="ma-form-main">
          <Card title={t("دورات الباقة", "Bundle courses")}>
            <div className="ma-form">
              <SelectedChips
                items={selectedMembers}
                onRemove={(value) => toggle("courseRefs", value)}
                empty={t("لم تُضف دورات بعد.", "No courses added yet.")}
              />
              <CheckPicker
                id="package-courses"
                label={t("اختر الدورات والدبلومات", "Pick courses & diplomas")}
                options={memberOptions}
                selected={form.courseRefs}
                onToggle={(value) => toggle("courseRefs", value)}
                onClear={() => catalog.setList("courseRefs", [])}
                searchPlaceholder={t("ابحث…", "Search…")}
                emptyText={
                  cardsLoading
                    ? t("جارٍ تحميل الدورات…", "Loading courses…")
                    : t("لا دورات منشورة متاحة.", "No published courses available.")
                }
              />
            </div>
          </Card>

          <CoreCatalogFields {...catalog} form={form} options={options} showInstructors instructorsRequired={false} />
        </div>

        <ProductFormAside
          typeLabel={t("باقة", "Bundle")}
          price={form.price}
          counts={[
            { label: t("الدورات المضمّنة", "Bundled courses"), value: form.courseRefs.length },
            { label: t("التصنيفات", "Categories"), value: form.categoryIds.length },
            { label: t("المهارات", "Skills"), value: form.skillIds.length },
            { label: t("المدربون", "Instructors"), value: form.instructorIds.length },
          ]}
          published={form.published}
          onPublishedChange={(checked) => catalog.setField("published", checked)}
          submitLabel={t("حفظ الباقة", "Save bundle")}
          pending={create.isPending}
          disabled={invalid}
          cancelHref="/learning/bundles"
          error={create.error}
          errorTitle={t("تعذّر حفظ الباقة", "Couldn't save the bundle")}
        />
      </form>
    </>
  );
}
