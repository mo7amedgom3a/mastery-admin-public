import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getProductPriceHistory,
  pricingKeys,
  productKeys,
  setProductPrice,
  updateProduct,
  type ProductView,
} from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { toast } from "@/components/ui/toast";
import { DataTable } from "@/components/ui/data-table";
import { Badge, Button, Card, ErrorAlert, Field, FormActions } from "@/components/ui/kit";
import {
  generalInfoPayload,
  GeneralInfoCard,
  isGeneralInfoValid,
  isPriceRequiredValid,
  isPriceValid,
  optional,
  parsePrice,
  PRICE_CURRENCY,
  PriceField,
  ToggleField,
  type GeneralInfo,
} from "@/features/learning/product-form";

/**
 * Edit the details a product is created without: short description, general info (hours, level,
 * language, access, CPD), the access-extension offer and its USD price (with the compare-at "was" price).
 * Details go through `PATCH /admin/catalog/products/{ref}`, the price through `PUT /admin/pricing/products/{id}`
 * (the old price is kept as history, listed under the form).
 */
export function ProductDetailsEditor({ productRef, data }: { productRef: string; data: ProductView }) {
  const t = useT();
  const queryClient = useQueryClient();
  const b2c = data.b2c;
  const productId = data.links.b2c_product_id;

  const activePrice = b2c?.prices.find((price) => !price.valid_to && !price.country_code);
  const [shortDescription, setShortDescription] = useState(b2c?.short_description ?? "");
  const [price, setPrice] = useState(activePrice ? String(activePrice.amount) : "");
  const [compareAt, setCompareAt] = useState(activePrice?.compare_at_amount != null ? String(activePrice.compare_at_amount) : "");
  const [general, setGeneral] = useState<GeneralInfo>({
    durationHours: b2c?.duration_hours != null ? String(b2c.duration_hours) : "",
    level: (b2c?.level as GeneralInfo["level"] | null | undefined) ?? "",
    language: b2c?.language ?? "ar",
    lifetimeAccess: b2c?.access_duration_days == null,
    accessDurationDays: String(b2c?.access_duration_days ?? 365),
    cpdEligible: Boolean(b2c?.cpd_eligible),
  });
  const [extensionEnabled, setExtensionEnabled] = useState(Boolean(b2c?.extension_enabled));
  const [extensionDays, setExtensionDays] = useState(String(b2c?.extension_duration_days ?? 90));
  const [extensionPrice, setExtensionPrice] = useState(b2c?.extension_price != null ? String(b2c.extension_price) : "");

  const amount = parsePrice(price);
  const compareAmount = parsePrice(compareAt);
  const priceChanged =
    activePrice == null || amount !== activePrice.amount || compareAmount !== (activePrice.compare_at_amount ?? null);
  const extensionDaysValue = Number.parseInt(extensionDays, 10);
  const extensionValid =
    !extensionEnabled || (extensionDaysValue >= 1 && extensionDaysValue <= 3650 && isPriceRequiredValid(extensionPrice, 0.01));
  const compareValid = isPriceValid(compareAt) && (compareAmount === null || amount === null || compareAmount > amount);

  const save = useMutation({
    mutationFn: async () => {
      await updateProduct(productRef, {
        short_description: optional(shortDescription),
        ...generalInfoPayload(general),
        extension_enabled: extensionEnabled,
        ...(extensionEnabled ? { extension_duration_days: extensionDaysValue, extension_price: parsePrice(extensionPrice) } : {}),
      });
      if (productId && amount !== null && priceChanged) {
        await setProductPrice(productId, { amount, currency_code: PRICE_CURRENCY, compare_at_amount: compareAmount });
      }
    },
    onSuccess: () => {
      toast.success(t("تم حفظ التفاصيل", "Details saved"));
      queryClient.invalidateQueries({ queryKey: productKeys.detail(productRef) });
      queryClient.invalidateQueries({ queryKey: productKeys.all });
      if (productId) queryClient.invalidateQueries({ queryKey: pricingKeys.history(productId) });
    },
  });

  if (!b2c || !productId) return null;
  const invalid = !isGeneralInfoValid(general) || !isPriceRequiredValid(price) || !compareValid || !extensionValid;

  return (
    <form
      className="ma-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!invalid) save.mutate();
      }}
    >
      <Card title={t("الوصف والسعر", "Summary & price")}>
        <div className="ma-form">
          <Field
            id="details-short"
            label={t("وصف مختصر", "Short description")}
            value={shortDescription}
            onChange={setShortDescription}
          />
          <PriceField
            id="details-price"
            value={price}
            onChange={setPrice}
            invalid={price.trim() !== "" && !isPriceRequiredValid(price)}
          />
          <PriceField
            id="details-compare-at"
            label={t("السعر قبل الخصم (اختياري)", "Compare-at price (optional)")}
            value={compareAt}
            onChange={setCompareAt}
            invalid={!compareValid}
          />
        </div>
      </Card>
      <GeneralInfoCard
        idPrefix="details"
        info={general}
        onChange={(patch) => setGeneral((prev) => ({ ...prev, ...patch }))}
      />
      <Card title={t("تمديد الوصول", "Access extension")}>
        <div className="ma-form">
          <ToggleField
            id="details-extension"
            label={t("يمكن للمشترك شراء مدة وصول إضافية", "Customers can buy more access time")}
            checked={extensionEnabled}
            onChange={setExtensionEnabled}
          />
          {extensionEnabled ? (
            <>
              <Field
                id="details-extension-days"
                type="number"
                min={1}
                step={1}
                dir="ltr"
                required
                label={t("مدة التمديد (أيام)", "Extension length (days)")}
                value={extensionDays}
                onChange={setExtensionDays}
              />
              <PriceField
                id="details-extension-price"
                label={t("سعر التمديد", "Extension price")}
                value={extensionPrice}
                onChange={setExtensionPrice}
                invalid={extensionPrice.trim() !== "" && !isPriceRequiredValid(extensionPrice, 0.01)}
              />
            </>
          ) : null}
        </div>
      </Card>
      <ErrorAlert error={save.error} title={t("تعذّر حفظ التفاصيل", "Couldn't save the details")} />
      <FormActions>
        <Button
          type="submit"
          kind="primary"
          icon="check"
          label={save.isPending ? t("جارٍ الحفظ…", "Saving…") : t("حفظ التفاصيل", "Save details")}
          disabled={save.isPending || invalid}
        />
      </FormActions>
      <PriceHistoryCard productId={productId} />
    </form>
  );
}

/** Every price the product has had (single edits and bulk batches), newest first. */
function PriceHistoryCard({ productId }: { productId: string }) {
  const t = useT();
  const history = useQuery({ queryKey: pricingKeys.history(productId), queryFn: () => getProductPriceHistory(productId) });
  return (
    <Card title={t("سجل الأسعار", "Price history")} className="ma-section-gap">
      <ErrorAlert error={history.error} />
      <DataTable
        rows={history.data ?? []}
        loading={history.isLoading}
        empty={t("لا أسعار بعد.", "No prices yet.")}
        columns={[
          { key: "amount", header: t("السعر", "Price"), cell: (row) => <bdi className="ma-num">{row.amount} {row.currency_code}</bdi> },
          { key: "compare", header: t("قبل الخصم", "Compare-at"), cell: (row) => (row.compare_at_amount != null ? <bdi className="ma-num">{row.compare_at_amount}</bdi> : "—") },
          { key: "from", header: t("من", "From"), cell: (row) => formatDateTime(row.valid_from) },
          {
            key: "to",
            header: t("إلى", "To"),
            cell: (row) => (row.valid_to ? formatDateTime(row.valid_to) : <Badge def={{ label: { ar: "الحالي", en: "Current" }, tone: "success" }} />),
          },
          { key: "batch", header: t("المصدر", "Source"), cell: (row) => (row.batch_id ? t("تعديل جماعي", "Bulk change") : t("تعديل فردي", "Single edit")) },
        ]}
      />
    </Card>
  );
}
