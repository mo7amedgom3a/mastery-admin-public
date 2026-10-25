import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { setSubscriptionPlanCardFeatures, subscriptionKeys, type SubscriptionPlan } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { toast } from "@/components/ui/toast";
import { Button, Card, ErrorAlert, FormActions, IconButton } from "@/components/ui/kit";

import { LOCALES, cardFeaturesFor } from "../lib";
import { HelpLabel } from "./help-label";
import { PlanCard } from "./plan-card";
import { usePlanPreviewPatch } from "./plan-preview-draft";

const MAX_ITEMS = 20;

/** Ordered single-line editor with move up/down, for the plan card bullets of one language. */
function OrderedItems({
  label,
  items,
  onChange,
  dir,
  placeholder,
  disabled,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  dir: "rtl" | "ltr";
  placeholder: string;
  disabled: boolean;
}) {
  const t = useT();
  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  return (
    <div className="ma-field">
      <span className="ma-label">{label}</span>
      <ol className="ma-orderlist">
        {items.map((item, index) => (
          <li className="ma-orderlist__row" key={index}>
            <span className="ma-num ma-muted">{index + 1}</span>
            <input className="ma-input" dir={dir} value={item} placeholder={placeholder} maxLength={200} disabled={disabled}
              onChange={(event) => onChange(items.map((v, i) => (i === index ? event.target.value : v)))} />
            {disabled ? null : (
              <>
                <IconButton icon="chevron" label={t("لأعلى", "Move up")} onClick={() => move(index, -1)} style={{ transform: "rotate(180deg)" }} />
                <IconButton icon="chevron" label={t("لأسفل", "Move down")} onClick={() => move(index, 1)} />
                <IconButton icon="trash" label={t("حذف", "Remove")} onClick={() => onChange(items.filter((_, i) => i !== index))} />
              </>
            )}
          </li>
        ))}
      </ol>
      {disabled ? null : (
        <div>
          <Button kind="soft" sm icon="plus" label={t("إضافة عنصر", "Add item")} disabled={items.length >= MAX_ITEMS}
            onClick={() => onChange([...items, ""])} />
        </div>
      )}
      <span className="ma-help">{t(`حتى ${MAX_ITEMS} عنصرًا، 200 حرف لكل عنصر.`, `Up to ${MAX_ITEMS} items, 200 characters each.`)}</span>
    </div>
  );
}

/** The bullet list shown on the plan card, per language, with a live card preview. */
export function PlanCardItemsTab({ plan }: { plan: SubscriptionPlan }) {
  const t = useT();
  const queryClient = useQueryClient();
  const writable = can("subscriptionsWrite.write");
  const [ar, setAr] = useState<string[]>(cardFeaturesFor(plan, "ar"));
  const [en, setEn] = useState<string[]>(cardFeaturesFor(plan, "en"));

  const clean = (items: string[]) => items.map((i) => i.trim()).filter(Boolean);
  const save = useMutation({
    mutationFn: () => setSubscriptionPlanCardFeatures(plan.plan_id, { [LOCALES.ar]: clean(ar), [LOCALES.en]: clean(en) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
      toast.success(t("تم حفظ عناصر البطاقة", "Card items saved"));
    },
  });

  usePlanPreviewPatch({ card_features: clean(ar) });

  const preview: SubscriptionPlan = { ...plan, card_features_by_locale: { [LOCALES.ar]: clean(ar), [LOCALES.en]: clean(en) } };

  return (
    <div className="ma-cols ma-cols--main-side">
      <Card title={<HelpLabel text={t("عناصر البطاقة", "Card items")} help="cardItems" />}>
        <div className="ma-form">
          <OrderedItems label={t("بالعربية", "Arabic")} items={ar} onChange={setAr} dir="rtl" placeholder="وصول غير محدود لكل الدورات" disabled={!writable} />
          <OrderedItems label={t("بالإنجليزية", "English")} items={en} onChange={setEn} dir="ltr" placeholder="Unlimited access to every course" disabled={!writable} />
          <ErrorAlert error={save.error} title={t("تعذّر الحفظ", "Couldn't save")} />
          {writable ? (
            <FormActions>
              <Button kind="primary" label={save.isPending ? t("جارٍ الحفظ…", "Saving…") : t("حفظ العناصر", "Save items")} disabled={save.isPending} onClick={() => save.mutate()} />
            </FormActions>
          ) : null}
        </div>
      </Card>
      <Card title={t("معاينة البطاقة", "Card preview")}>
        <PlanCard plan={preview} showStats={false} />
      </Card>
    </div>
  );
}
