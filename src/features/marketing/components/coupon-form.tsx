import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { listCategories, listProducts, type Coupon, type CouponInput } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Button, ErrorAlert, Field, FormActions } from "@/components/ui/kit";
import { MultiSelect } from "@/components/ui/multi-select";

type FormState = {
  code: string;
  name: string;
  description: string;
  kind: "percent" | "fixed";
  value: string;
  maxDiscount: string;
  minSubtotal: string;
  usageLimit: string;
  perCustomerLimit: string;
  startsAt: string;
  endsAt: string;
  productIds: string[];
  categoryIds: string[];
  firstPurchaseOnly: boolean;
  isActive: boolean;
};

const toMajor = (minor: number | null | undefined) => (minor == null ? "" : String(minor / 100));
const toMinor = (major: string) => (major.trim() === "" ? null : Math.round(Number(major) * 100));
const toInt = (value: string) => (value.trim() === "" ? null : Number.parseInt(value, 10));

function initialState(coupon?: Coupon): FormState {
  return {
    code: coupon?.code ?? "",
    name: coupon?.name ?? "",
    description: coupon?.description ?? "",
    kind: coupon?.kind ?? "percent",
    value: coupon ? String(coupon.value) : "",
    maxDiscount: toMajor(coupon?.max_discount_minor),
    minSubtotal: toMajor(coupon?.min_subtotal_minor),
    usageLimit: coupon?.usage_limit != null ? String(coupon.usage_limit) : "",
    perCustomerLimit: coupon?.per_customer_limit != null ? String(coupon.per_customer_limit) : "1",
    startsAt: coupon?.starts_at?.slice(0, 10) ?? "",
    endsAt: coupon?.ends_at?.slice(0, 10) ?? "",
    productIds: coupon?.product_ids ?? [],
    categoryIds: coupon?.category_ids ?? [],
    firstPurchaseOnly: coupon?.first_purchase_only ?? false,
    isActive: coupon?.is_active ?? true,
  };
}

function Check({ id, label, hint, checked, onChange }: { id: string; label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="ma-check" htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>
        {label}
        {hint ? <span className="ma-member__meta"> · {hint}</span> : null}
      </span>
    </label>
  );
}

/** Create/edit form of a native coupon. Amounts are typed in dollars and sent in cents. */
export function CouponForm({
  coupon,
  pending,
  error,
  submitLabel,
  cancelHref,
  onSubmit,
}: {
  coupon?: Coupon;
  pending: boolean;
  error: unknown;
  submitLabel: string;
  cancelHref: string;
  onSubmit: (body: CouponInput) => void;
}) {
  const t = useT();
  const [form, setForm] = useState<FormState>(() => initialState(coupon));
  const set = <K extends keyof FormState>(key: K) => (value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));
  // Reports and customers already know a used code at its value.
  const locked = Boolean(coupon && coupon.stats.redemptions + coupon.stats.reserved > 0);

  const products = useQuery({
    queryKey: ["marketing", "coupons", "product-options"],
    queryFn: () => listProducts({ source: "b2c", limit: 200 }),
    staleTime: 5 * 60_000,
  });
  const categories = useQuery({
    queryKey: ["marketing", "coupons", "category-options"],
    queryFn: () => listCategories({ limit: 200 }),
    staleTime: 5 * 60_000,
  });
  const productOptions = (products.data?.items ?? [])
    .filter((p) => p.product_id)
    .map((p) => ({ value: String(p.product_id), label: p.title ?? p.slug ?? String(p.product_id) }));
  const categoryOptions = (categories.data?.items ?? [])
    .filter((c) => c.category_id)
    .map((c) => ({ value: String(c.category_id), label: c.name ?? String(c.category_id) }));

  const valueInvalid = form.value === "" || Number(form.value) <= 0 || (form.kind === "percent" && Number(form.value) > 100);
  const datesInvalid = Boolean(form.startsAt && form.endsAt && form.endsAt <= form.startsAt);
  const disabled = pending || !form.code.trim() || valueInvalid || datesInvalid;

  const submit = () =>
    onSubmit({
      code: form.code.trim(),
      kind: form.kind,
      value: form.value,
      name: form.name.trim() || null,
      description: form.description.trim() || null,
      currency_code: "USD",
      max_discount_minor: form.kind === "percent" ? toMinor(form.maxDiscount) : null,
      min_subtotal_minor: toMinor(form.minSubtotal),
      usage_limit: toInt(form.usageLimit),
      per_customer_limit: toInt(form.perCustomerLimit),
      starts_at: form.startsAt || null,
      ends_at: form.endsAt || null,
      product_ids: form.productIds,
      category_ids: form.categoryIds,
      first_purchase_only: form.firstPurchaseOnly,
      is_active: form.isActive,
      customer_id: coupon?.customer_id ?? null,
    });

  return (
    <form
      className="ma-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!disabled) submit();
      }}
    >
      <div className="ma-form-grid ma-form-grid--2">
        <Field
          id="coupon-code"
          label={t("الكود", "Code")}
          hint={locked ? t("لا يمكن تغييره بعد الاستخدام.", "Locked after first use.") : t("ما يكتبه العميل عند الدفع، مثل SUMMER25.", "What the customer types at checkout, e.g. SUMMER25.")}
          dir="ltr"
          required
          disabled={locked}
          value={form.code}
          onChange={(v) => set("code")(v.toUpperCase().replace(/\s+/g, ""))}
        />
        <Field id="coupon-name" label={t("الاسم الداخلي", "Internal name")} value={form.name} onChange={set("name")} />
        <Field
          id="coupon-kind"
          label={t("نوع الخصم", "Discount type")}
          options={[
            ["percent", t("نسبة مئوية", "Percentage")],
            ["fixed", t("مبلغ ثابت (USD)", "Fixed amount (USD)")],
          ]}
          disabled={locked}
          value={form.kind}
          onChange={(v) => set("kind")(v as FormState["kind"])}
        />
        <Field
          id="coupon-value"
          type="number"
          label={form.kind === "percent" ? t("النسبة (%)", "Percent (%)") : t("المبلغ (USD)", "Amount (USD)")}
          min={0}
          max={form.kind === "percent" ? 100 : undefined}
          step="0.01"
          dir="ltr"
          required
          disabled={locked}
          value={form.value}
          onChange={set("value")}
        />
        {form.kind === "percent" ? (
          <Field id="coupon-max" type="number" label={t("أقصى خصم (USD)", "Max discount (USD)")} hint={t("اختياري.", "Optional.")} min={0} step="0.01" dir="ltr" value={form.maxDiscount} onChange={set("maxDiscount")} />
        ) : (
          <span aria-hidden="true" />
        )}
        <Field id="coupon-min" type="number" label={t("أدنى قيمة للطلب (USD)", "Minimum order (USD)")} hint={t("مثال: 300 لطلبات فوق 300$.", "e.g. 300 for orders over $300.")} min={0} step="0.01" dir="ltr" value={form.minSubtotal} onChange={set("minSubtotal")} />
        <Field id="coupon-usage" type="number" label={t("حد الاستخدام الكلي", "Total uses")} hint={t("فارغ = بلا حد.", "Empty = unlimited.")} min={1} dir="ltr" value={form.usageLimit} onChange={set("usageLimit")} />
        <Field id="coupon-per-customer" type="number" label={t("لكل عميل", "Uses per customer")} hint={t("فارغ = بلا حد.", "Empty = unlimited.")} min={1} dir="ltr" value={form.perCustomerLimit} onChange={set("perCustomerLimit")} />
        <Field id="coupon-start" type="date" label={t("يبدأ", "Starts")} value={form.startsAt} max={form.endsAt || undefined} onChange={set("startsAt")} />
        <Field id="coupon-end" type="date" label={t("ينتهي", "Ends")} value={form.endsAt} min={form.startsAt || undefined} onChange={set("endsAt")} />
      </div>

      <div className="ma-field">
        <span className="ma-label">{t("يسري على", "Applies to")}</span>
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          <MultiSelect label={t("كل المنتجات", "All products")} options={productOptions} selected={form.productIds} onChange={set("productIds")} searchPlaceholder={t("ابحث عن منتج…", "Search products…")} />
          <MultiSelect label={t("كل الفئات", "All categories")} options={categoryOptions} selected={form.categoryIds} onChange={set("categoryIds")} searchPlaceholder={t("ابحث عن فئة…", "Search categories…")} />
        </div>
        <span className="ma-help">
          {t("بدون اختيار يسري الكوبون على الطلب كله.", "With nothing selected the coupon applies to the whole order.")}
        </span>
      </div>

      <Check id="coupon-first" label={t("أول عملية شراء فقط", "First purchase only")} hint={t("للعملاء الذين لم يدفعوا من قبل", "customers with no paid order yet")} checked={form.firstPurchaseOnly} onChange={set("firstPurchaseOnly")} />
      <Check id="coupon-active" label={t("مفعّل", "Active")} checked={form.isActive} onChange={set("isActive")} />
      <Field id="coupon-description" type="textarea" rows={3} label={t("ملاحظات", "Notes")} value={form.description} onChange={set("description")} />

      <ErrorAlert error={error} title={t("تعذّر حفظ الكوبون", "Couldn't save the coupon")} />
      <FormActions>
        <Button type="submit" kind="primary" icon="check" label={pending ? t("جارٍ الحفظ…", "Saving…") : submitLabel} disabled={disabled} />
        <Button kind="ghost" label={t("إلغاء", "Cancel")} href={cancelHref} />
      </FormActions>
    </form>
  );
}
