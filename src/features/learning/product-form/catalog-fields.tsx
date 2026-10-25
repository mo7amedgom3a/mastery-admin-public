import { type ReactNode } from "react";

import { Card, Field } from "@/components/ui/kit";
import { useT } from "@/lib/i18n";

import { isPriceValid, toSlug, type CatalogFormState, type CatalogListKey } from "./model";
import { PriceField, SlugField, ToggleField } from "./fields";
import type { useCatalogOptions } from "./options";
import { ClassificationCard, GeneralInfoCard, InstructorsCard } from "./sections";

type Options = ReturnType<typeof useCatalogOptions>;

type FieldSetters = {
  setField: <K extends keyof CatalogFormState>(key: K, value: CatalogFormState[K]) => void;
  setTitle: (value: string) => void;
  setTitleEn: (value: string) => void;
  setSlug: (value: string) => void;
  toggle: (key: CatalogListKey, value: string | number) => void;
  setList: (key: CatalogListKey, value: (string | number)[]) => void;
};

/**
 * The catalog fields shared by course, diploma, package and consultation. Each page adds its own
 * type-specific section (package members, consultation experts) around this block.
 */
export function CoreCatalogFields({
  form,
  options,
  showInstructors = true,
  showGeneralInfo = true,
  instructorsRequired = true,
  extra,
  ...setters
}: {
  form: CatalogFormState;
  options: Options;
  showInstructors?: boolean;
  showGeneralInfo?: boolean;
  instructorsRequired?: boolean;
  extra?: ReactNode;
} & FieldSetters) {
  const t = useT();
  const { setField, setTitle, setTitleEn, setSlug } = setters;
  const priceInvalid = !isPriceValid(form.price);

  return (
    <>
      <Card title={t("البيانات الأساسية", "Basic details")}>
        <div className="ma-form">
          <Field id="product-title" label={t("الاسم", "Name")} required value={form.title} onChange={setTitle} />
          <Field
            id="product-title-en"
            label={t("الاسم بالإنجليزية", "English name")}
            dir="ltr"
            value={form.titleEn}
            onChange={setTitleEn}
          />
          <Field
            id="product-short-description"
            label={t("وصف مختصر", "Short description")}
            value={form.shortDescription}
            onChange={(value) => setField("shortDescription", value)}
          />
          <Field
            id="product-description"
            type="textarea"
            rows={5}
            label={t("الوصف", "Description")}
            value={form.description}
            onChange={(value) => setField("description", value)}
          />
          <div className="ma-form-grid ma-form-grid--2">
            <SlugField
              id="product-slug"
              value={form.slug}
              onChange={setSlug}
              onRegenerate={() => setSlug(toSlug(form.titleEn || form.title))}
            />
            <PriceField
              id="product-price"
              value={form.price}
              onChange={(value) => setField("price", value)}
              invalid={priceInvalid}
            />
          </div>
        </div>
      </Card>

      {showGeneralInfo ? (
        <GeneralInfoCard
          idPrefix="product"
          info={form}
          onChange={(patch) => Object.entries(patch).forEach(([key, value]) => setField(key as keyof CatalogFormState, value as never))}
        />
      ) : null}

      <ClassificationCard
        idPrefix="product"
        options={options}
        categoryIds={form.categoryIds}
        onCategoriesChange={(ids) => setters.setList("categoryIds", ids)}
        skillIds={form.skillIds}
        onSkillsChange={(ids) => setters.setList("skillIds", ids)}
        tags={form.keywords}
        onTagsChange={(tags) => setters.setList("keywords", tags)}
      >
        <div className="ma-form-grid ma-form-grid--2">
          <Field
            id="product-marketing-tag"
            label={t("الوسم التسويقي", "Marketing tag")}
            value={form.marketingTag}
            onChange={(value) => setField("marketingTag", value)}
            list="product-marketing-tags"
          />
          <datalist id="product-marketing-tags">
            {options.tags.map((tag) => (
              <option key={tag} value={tag} />
            ))}
          </datalist>
        </div>
      </ClassificationCard>

      {showInstructors ? (
        <InstructorsCard
          idPrefix="product"
          options={options}
          required={instructorsRequired}
          instructorIds={form.instructorIds}
          onChange={(ids) => setters.setList("instructorIds", ids)}
        />
      ) : null}

      {extra}

      <Card title={t("المتاجر والخصائص", "Stores & flags")}>
        <div className="ma-form">
          <div className="ma-form-grid ma-form-grid--2">
            <Field
              id="product-apple-store-id"
              label={t("المعرّف في متجر آبل", "Apple App Store ID")}
              dir="ltr"
              value={form.appleStoreId}
              onChange={(value) => setField("appleStoreId", value)}
            />
            <Field
              id="product-google-store-id"
              label={t("المعرّف في متجر جوجل", "Google Play Store ID")}
              dir="ltr"
              value={form.googleStoreId}
              onChange={(value) => setField("googleStoreId", value)}
            />
          </div>
          <ToggleField
            id="product-featured"
            label={t("منتج مميز", "Featured")}
            checked={form.featured}
            onChange={(checked) => setField("featured", checked)}
          />
          <ToggleField
            id="product-manual-accounting"
            label={t("حساب يدوي", "Manual accounting")}
            checked={form.manualAccounting}
            onChange={(checked) => setField("manualAccounting", checked)}
          />
        </div>
      </Card>
    </>
  );
}
