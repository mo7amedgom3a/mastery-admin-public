import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { createBundle } from "@/lib/api";
import { productTabHref } from "@/lib/refs";
import { useT } from "@/lib/i18n";
import { toast } from "@/components/ui/toast";
import { Card, Field, PageHead } from "@/components/ui/kit";
import { productTypeLabel } from "@/lib/product-types";
import {
  CheckPicker,
  ClassificationCard,
  isPriceRequiredValid,
  PRICE_CURRENCY,
  isValidSlug,
  ListEditor,
  optional,
  parsePrice,
  ProductFormAside,
  SlugField,
  ToggleField,
  toSlug,
  useCatalogOptions,
  useProductCards,
} from "@/features/learning/product-form";

/** `POST /admin/bundles` — a bundle product sold together with an ordered member list and a price. */

type MemberDraft = { product_id: string; quantity: string };

export default function BundleNewPage() {
  const t = useT();
  const navigate = useNavigate();
  const options = useCatalogOptions();
  const { cards, isLoading: cardsLoading } = useProductCards(["course", "diploma", "consultation", "package"]);

  const [title, setTitle] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [amount, setAmount] = useState("");
  const [accessDays, setAccessDays] = useState("");
  const [cpdEligible, setCpdEligible] = useState(false);
  const [published, setPublished] = useState(false);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const [learningOutcomes, setLearningOutcomes] = useState<string[]>([]);
  const [members, setMembers] = useState<MemberDraft[]>([]);

  const cardsById = useMemo(() => new Map(cards.map((card) => [card.product_id, card])), [cards]);
  const memberOptions = cards.map((card) => ({
    value: card.product_id,
    label: card.title ?? card.slug,
    hint: t(productTypeLabel(card.product_type).ar, productTypeLabel(card.product_type).en),
  }));

  const setTitleSafe = (value: string) => {
    setTitle(value);
    if (!slugEdited) setSlug(toSlug(value));
  };

  const addMember = (productId: string) =>
    setMembers((prev) =>
      prev.some((member) => member.product_id === productId) ? prev : [...prev, { product_id: productId, quantity: "1" }],
    );
  const removeMember = (productId: string) => setMembers((prev) => prev.filter((member) => member.product_id !== productId));
  const moveMember = (productId: string, direction: -1 | 1) =>
    setMembers((prev) => {
      const index = prev.findIndex((member) => member.product_id === productId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  const setQuantity = (productId: string, quantity: string) =>
    setMembers((prev) => prev.map((member) => (member.product_id === productId ? { ...member, quantity } : member)));

  const create = useMutation({
    mutationFn: () =>
      createBundle({
        slug,
        title: title.trim(),
        short_description: optional(shortDescription),
        description: optional(description),
        status: published ? "published" : "draft",
        currency_code: PRICE_CURRENCY,
        amount: parsePrice(amount) ?? 0,
        access_duration_days: accessDays.trim() === "" ? null : Number(accessDays),
        cpd_eligible: cpdEligible,
        category_ids: categoryIds,
        members: members.map((member, index) => ({
          product_id: member.product_id,
          sort_order: index,
          quantity: Math.max(1, Number(member.quantity) || 1),
        })),
        learning_outcomes: learningOutcomes.map((item) => item.trim()).filter(Boolean),
        skill_ids: skillIds,
      }),
    onSuccess: (bundle) => {
      toast.success(t("تم إنشاء الحزمة بنجاح", "Package created"));
      navigate(productTabHref(bundle.ref, "bundle"));
    },
  });

  const invalid =
    !title.trim() ||
    !slug.trim() ||
    !isValidSlug(slug) ||
    !isPriceRequiredValid(amount) ||
    members.length === 0 ||
    categoryIds.length === 0;

  return (
    <>
      <PageHead
        title={t("إنشاء حزمة", "Create a package")}
        sub={t(
          "حزمة تجمع دورات ودبلومات واستشارات وباقات بسعر واحد مع ترتيب العناصر.",
          "Sell courses, diplomas, consultations and packages together for one price, in a set order.",
        )}
        back={{ href: "/learning/packages", label: t("المنتجات", "Products") }}
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
              <Field id="bundle-title" label={t("الاسم", "Name")} required value={title} onChange={setTitleSafe} />
              <Field
                id="bundle-short"
                label={t("وصف مختصر", "Short description")}
                value={shortDescription}
                onChange={setShortDescription}
              />
              <Field
                id="bundle-description"
                type="textarea"
                rows={4}
                label={t("الوصف", "Description")}
                value={description}
                onChange={setDescription}
              />
              <div className="ma-form-grid ma-form-grid--2">
                <SlugField
                  id="bundle-slug"
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
                <div className="ma-form-grid">
                  <Field
                    id="bundle-amount"
                    type="number"
                    min={0}
                    step="any"
                    dir="ltr"
                    label={t("السعر (USD)", "Price (USD)")}
                    required
                    value={amount}
                    onChange={setAmount}
                    hint={!isPriceRequiredValid(amount) ? t("أدخل رقمًا صحيحًا ≥ 0.", "Enter a valid number ≥ 0.") : undefined}
                  />
                </div>
              </div>
              <div className="ma-form-grid ma-form-grid--2">
                <Field
                  id="bundle-access"
                  type="number"
                  min={1}
                  dir="ltr"
                  label={t("مدة الوصول (أيام)", "Access duration (days)")}
                  value={accessDays}
                  onChange={setAccessDays}
                  hint={t("اتركه فارغًا للوصول الدائم.", "Leave empty for lifetime access.")}
                />
                <div className="ma-field">
                  <span className="ma-label">{t("مؤهل للاعتماد المهني (CPD)", "CPD eligible")}</span>
                  <ToggleField
                    id="bundle-cpd"
                    label={t("مؤهل", "Eligible")}
                    checked={cpdEligible}
                    onChange={setCpdEligible}
                  />
                </div>
              </div>
            </div>
          </Card>

          <Card title={t("عناصر الحزمة", "Bundle items")}>
            <div className="ma-form">
              {members.length > 0 ? (
                <div className="ma-members">
                  {members.map((member, index) => {
                    const card = cardsById.get(member.product_id);
                    return (
                      <div className="ma-member" key={member.product_id}>
                        <span className="ma-member_handle" aria-hidden="true">{index + 1}</span>
                        <span className="ma-member__title">
                          {card?.title ?? card?.slug ?? member.product_id}
                          {card ? (
                            <span className="ma-member__meta">
                              {" "}
                              · {t(productTypeLabel(card.product_type).ar, productTypeLabel(card.product_type).en)}
                            </span>
                          ) : null}
                        </span>
                        <input
                          className="ma-input ma-member__qty"
                          type="number"
                          min={1}
                          dir="ltr"
                          aria-label={t("الكمية", "Quantity")}
                          value={member.quantity}
                          onChange={(event) => setQuantity(member.product_id, event.target.value)}
                        />
                        <span className="ma-member__meta">
                          <button
                            type="button"
                            className="ma-link"
                            aria-label={t("أعلى", "Move up")}
                            disabled={index === 0}
                            onClick={() => moveMember(member.product_id, -1)}
                          >
                            ↑
                          </button>{" "}
                          <button
                            type="button"
                            className="ma-link"
                            aria-label={t("أسفل", "Move down")}
                            disabled={index === members.length - 1}
                            onClick={() => moveMember(member.product_id, 1)}
                          >
                            ↓
                          </button>{" "}
                          <button
                            type="button"
                            className="ma-link"
                            aria-label={t("حذف", "Remove")}
                            onClick={() => removeMember(member.product_id)}
                          >
                            ×
                          </button>
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : null}
              <CheckPicker
                id="bundle-members"
                label={t("أضف منتجات إلى الحزمة", "Add products to the bundle")}
                options={memberOptions}
                selected={members.map((member) => member.product_id)}
                onToggle={(value) =>
                  members.some((member) => member.product_id === value) ? removeMember(value as string) : addMember(value as string)
                }
                onClear={() => setMembers([])}
                searchPlaceholder={t("ابحث في المنتجات…", "Search products…")}
                emptyText={
                  cardsLoading
                    ? t("جارٍ تحميل المنتجات…", "Loading products…")
                    : t("لا منتجات منشورة متاحة.", "No published products available.")
                }
                hint={t("عنصر واحد على الأقل.", "At least one item.")}
              />
            </div>
          </Card>

          <ClassificationCard
            idPrefix="bundle"
            options={options}
            categoryIds={categoryIds}
            onCategoriesChange={setCategoryIds}
            skillIds={skillIds}
            onSkillsChange={setSkillIds}
          >
            <ListEditor
              label={t("مخرجات التعلّم", "Learning outcomes")}
              items={learningOutcomes}
              onChange={setLearningOutcomes}
              placeholder={t("مخرَج تعلّم…", "A learning outcome…")}
            />
          </ClassificationCard>
        </div>

        <ProductFormAside
          typeLabel={t("حزمة", "Package")}
          price={amount}
          priceLabel={t("السعر (USD)", "Price (USD)")}
          counts={[
            { label: t("العناصر", "Items"), value: members.length },
            { label: t("مخرجات التعلّم", "Outcomes"), value: learningOutcomes.filter((item) => item.trim()).length },
          ]}
          published={published}
          onPublishedChange={setPublished}
          submitLabel={t("حفظ الحزمة", "Save package")}
          pending={create.isPending}
          disabled={invalid}
          cancelHref="/learning/packages"
          error={create.error}
          errorTitle={t("تعذّر حفظ الحزمة", "Couldn't save the package")}
        />
      </form>
    </>
  );
}
