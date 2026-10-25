import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { setSubscriptionPlanDiscount, subscriptionKeys, type SubscriptionPlan } from "@/lib/api";
import { formatAmount } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { toast } from "@/components/ui/toast";
import { Alert, Button, Card, Dl, ErrorAlert, Field, FormActions } from "@/components/ui/kit";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { SegmentedChoice } from "@/features/learning/product-form";

import { PlanCard } from "./plan-card";
import { usePlanPreviewPatch } from "./plan-preview-draft";
import { toNumber } from "../lib";

type DiscountType = "percent" | "fixed";

/** `datetime-local` value ↔ UTC ISO string (the API stores UTC). */
const toLocalInput = (iso: string | null | undefined) => {
  if (!iso) return "";
  const date = new Date(iso.endsWith("Z") || iso.includes("+") ? iso : `${iso}Z`);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const toUtcIso = (local: string) => (local ? new Date(local).toISOString() : null);

/**
 * The plan sale price. While active, customers see the original price struck through and new
 * subscribers are charged the discounted price for as long as they stay subscribed.
 */
export function PlanDiscountTab({ plan }: { plan: SubscriptionPlan }) {
  const t = useT();
  const queryClient = useQueryClient();
  const writable = can("subscriptionsWrite.write");
  const current = plan.discount;
  const [type, setType] = useState<DiscountType>(current?.discount_type ?? "percent");
  const [value, setValue] = useState(current ? String(toNumber(current.value)) : "");
  const [label, setLabel] = useState(current?.label ?? "");
  const [startsAt, setStartsAt] = useState(toLocalInput(current?.starts_at));
  const [endsAt, setEndsAt] = useState(toLocalInput(current?.ends_at));
  const [confirmRemove, setConfirmRemove] = useState(false);

  const price = toNumber(plan.price);
  const amount = Number(value);
  const discounted = type === "percent" ? price * (1 - amount / 100) : price - amount;
  const valueError =
    !(amount > 0)
      ? t("أدخل قيمة أكبر من صفر.", "Enter a value above zero.")
      : type === "percent" && amount >= 100
        ? t("النسبة يجب أن تكون أقل من 100٪.", "Percent must be below 100%.")
        : type === "fixed" && amount >= price
          ? t("يجب أن يكون الخصم أقل من السعر.", "The discount must be lower than the price.")
          : null;
  const windowError = startsAt && endsAt && new Date(endsAt) <= new Date(startsAt) ? t("تاريخ الانتهاء يجب أن يكون بعد البداية.", "End must be after start.") : null;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
  const save = useMutation({
    mutationFn: () =>
      setSubscriptionPlanDiscount(plan.plan_id, {
        discount: { discount_type: type, value: String(amount), label: label.trim() || null, starts_at: toUtcIso(startsAt), ends_at: toUtcIso(endsAt) },
      }),
    onSuccess: () => {
      invalidate();
      toast.success(t("تم حفظ الخصم", "Discount saved"));
    },
  });
  const remove = useMutation({
    mutationFn: () => setSubscriptionPlanDiscount(plan.plan_id, { discount: null }),
    onSuccess: () => {
      setConfirmRemove(false);
      setValue("");
      setLabel("");
      setStartsAt("");
      setEndsAt("");
      invalidate();
      toast.success(t("تمت إزالة الخصم", "Discount removed"));
    },
  });

  const preview: SubscriptionPlan = valueError || windowError
    ? plan
    : {
        ...plan,
        effective_price: String(discounted.toFixed(2)),
        compare_at_price: String(price),
        discount: { discount_type: type, value: String(amount), label: label.trim() || null, starts_at: toUtcIso(startsAt), ends_at: toUtcIso(endsAt), is_active: true },
      };

  usePlanPreviewPatch(
    preview === plan
      ? {}
      : { effective_price: preview.effective_price, compare_at_price: preview.compare_at_price, discount: preview.discount },
  );

  return (
    <div className="ma-cols ma-cols--main-side">
      <Card title={t("خصم الباقة", "Plan discount")}>
        <div className="ma-form">
          {current ? (
            <Alert kind={current.is_active ? "success" : "warning"}
              title={current.is_active ? t("الخصم فعّال الآن", "Discount is live") : t("الخصم مجدول أو منتهٍ", "Discount is scheduled or over")}>
              {t(
                `يدفع المشتركون الجدد ${formatAmount(toNumber(plan.effective_price), plan.currency_code)} بدلًا من ${formatAmount(price, plan.currency_code)}.`,
                `New subscribers pay ${formatAmount(toNumber(plan.effective_price), plan.currency_code)} instead of ${formatAmount(price, plan.currency_code)}.`,
              )}
            </Alert>
          ) : (
            <Alert kind="info" title={t("لا يوجد خصم على هذه الباقة.", "This plan has no discount.")} />
          )}
          <fieldset disabled={!writable} style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: "var(--space-4)" }}>
            <SegmentedChoice<DiscountType> label={t("نوع الخصم", "Discount type")} value={type} onChange={setType}
              options={[{ value: "percent", label: t("نسبة مئوية", "Percent") }, { value: "fixed", label: t(`مبلغ ثابت (${plan.currency_code})`, `Fixed amount (${plan.currency_code})`) }]} />
            <div className="ma-form-grid">
              <Field id="disc-value" type="number" min={0} step="any" dir="ltr" required label={type === "percent" ? t("النسبة ٪", "Percent %") : t("المبلغ", "Amount")}
                value={value} onChange={setValue} hint={value ? valueError ?? undefined : undefined} aria-invalid={Boolean(value && valueError) || undefined} />
              <Field id="disc-label" label={t("اسم العرض (يظهر على البطاقة)", "Offer label (shown on the card)")} value={label} onChange={setLabel} maxLength={80} />
              <Field id="disc-start" type="datetime-local" label={t("يبدأ (اختياري)", "Starts (optional)")} value={startsAt} onChange={setStartsAt} />
              <Field id="disc-end" type="datetime-local" label={t("ينتهي (اختياري)", "Ends (optional)")} value={endsAt} onChange={setEndsAt} hint={windowError ?? undefined} />
            </div>
          </fieldset>
          {!valueError ? (
            <Dl rows={[
              [t("السعر الأساسي", "List price"), formatAmount(price, plan.currency_code)],
              [t("السعر بعد الخصم", "Discounted price"), <strong key="d">{formatAmount(discounted, plan.currency_code)}</strong>],
            ]} />
          ) : null}
          <Alert kind="info" title={t("لا يتغيّر إصدار الباقة", "The plan version doesn't change")}>
            {t(
              "يُطبّق الخصم على المشتركين الجدد ويبقى سعرهم المخفّض طوال اشتراكهم. المشتركون الحاليون لا يتأثرون.",
              "New subscribers get the discount and keep their discounted price for the life of their subscription. Existing subscribers are not affected.",
            )}
          </Alert>
          <ErrorAlert error={save.error ?? remove.error} title={t("تعذّر حفظ الخصم", "Couldn't save the discount")} />
          {writable ? (
            <FormActions>
              <Button kind="primary" disabled={Boolean(valueError || windowError) || save.isPending}
                label={save.isPending ? t("جارٍ الحفظ…", "Saving…") : current ? t("تحديث الخصم", "Update discount") : t("تطبيق الخصم", "Apply discount")}
                onClick={() => save.mutate()} />
              {current ? <Button kind="danger" label={t("إزالة الخصم", "Remove discount")} onClick={() => setConfirmRemove(true)} /> : null}
            </FormActions>
          ) : null}
        </div>
      </Card>
      <Card title={t("معاينة البطاقة", "Card preview")}>
        <PlanCard plan={preview} showStats={false} />
      </Card>
      <ConfirmModal open={confirmRemove} onOpenChange={setConfirmRemove} title={t("إزالة الخصم؟", "Remove the discount?")}
        message={t("يعود السعر للمشتركين الجدد إلى السعر الأساسي فورًا.", "New subscribers pay the list price again right away.")}
        confirmLabel={t("إزالة", "Remove")} loading={remove.isPending} onConfirm={() => remove.mutate()} />
    </div>
  );
}
