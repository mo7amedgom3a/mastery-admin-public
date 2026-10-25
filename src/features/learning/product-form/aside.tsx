import { type ReactNode } from "react";

import { Button, Card, Dl, ErrorAlert, FormActions } from "@/components/ui/kit";
import { useT } from "@/lib/i18n";

import { ToggleField } from "./fields";
import { isPriceValid, PRICE_CURRENCY } from "./model";

/**
 * Sticky aside of a create-product page: a live summary of what will be saved, the publish toggle
 * and the single primary CTA (submitted through the surrounding `<form>`).
 */
export function ProductFormAside({
  typeLabel,
  price,
  priceLabel,
  counts,
  published,
  onPublishedChange,
  publishedHint,
  submitLabel,
  pending,
  disabled,
  cancelHref,
  error,
  errorTitle,
}: {
  typeLabel: ReactNode;
  price: string;
  priceLabel?: ReactNode;
  counts: { label: ReactNode; value: number }[];
  published: boolean;
  onPublishedChange: (checked: boolean) => void;
  publishedHint?: ReactNode;
  submitLabel: ReactNode;
  pending: boolean;
  disabled: boolean;
  cancelHref: string;
  error?: unknown;
  errorTitle?: ReactNode;
}) {
  const t = useT();
  const priceValid = isPriceValid(price);

  return (
    <aside className="ma-form-aside">
      <Card title={t("ملخص المنتج", "Product summary")}>
        <Dl
          rows={[
            [t("النوع", "Type"), typeLabel],
            [
              priceLabel ?? t("السعر (USD)", "Price (USD)"),
              price.trim() === ""
                ? t("— بدون سعر", "— no price")
                : priceValid
                  ? `${price} ${PRICE_CURRENCY}`
                  : t("قيمة غير صحيحة", "Invalid value"),
            ],
            ...counts.map((count) => [count.label, String(count.value)] as [ReactNode, ReactNode]),
            [t("الحالة", "Status"), published ? t("منشور", "Published") : t("مسودة", "Draft")],
          ]}
        />
      </Card>

      <Card title={t("النشر", "Publishing")}>
        <div className="ma-form">
          <ToggleField
            id="product-published"
            label={t("نشر الآن", "Publish now")}
            checked={published}
            onChange={onPublishedChange}
            hint={publishedHint ?? t("يظهر في المتجر مباشرة.", "Appears in the storefront right away.")}
          />
        </div>
      </Card>

      <ErrorAlert error={error} title={errorTitle ?? t("تعذّر حفظ المنتج", "Couldn't save the product")} />

      <FormActions>
        <Button
          type="submit"
          kind="primary"
          icon="check"
          label={pending ? t("جارٍ الحفظ…", "Saving…") : submitLabel}
          disabled={pending || disabled}
        />
        <Button kind="ghost" label={t("إلغاء", "Cancel")} href={cancelHref} />
      </FormActions>
    </aside>
  );
}
