import type { ProductType } from "@/lib/api";

/** Arabic/English labels of every catalog product type (`b2c.products.product_type`). */
export const PRODUCT_TYPE_LABELS: Record<ProductType, { ar: string; en: string }> = {
  course: { ar: "دورة", en: "Course" },
  diploma: { ar: "دبلوم", en: "Diploma" },
  package: { ar: "باقة", en: "Bundle" },
  bundle: { ar: "حزمة", en: "Package" },
  consultation: { ar: "استشارة", en: "Consultation" },
  live_diploma: { ar: "دبلوم مباشر", en: "Live diploma" },
};

/** Label of a product type; falls back to the raw value for anything unknown. */
export function productTypeLabel(type: string | null | undefined): { ar: string; en: string } {
  const known = PRODUCT_TYPE_LABELS[(type ?? "") as ProductType];
  return known ?? { ar: type ?? "—", en: type ?? "—" };
}

/** Product types that have a legacy course/package page and therefore a curriculum editor. */
export const CURRICULUM_TYPES: ProductType[] = ["course", "diploma", "package"];
