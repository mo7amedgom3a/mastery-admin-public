import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  SUBSCRIPTION_RESOURCE_TYPES,
  setSubscriptionPlanProducts,
  subscriptionKeys,
  type SubscriptionPlan,
} from "@/lib/api";
import { useT } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { productTypeLabel } from "@/lib/product-types";
import { productStatusBadge } from "@/lib/status";
import { toast } from "@/components/ui/toast";
import { Alert, Badge, Button, Card, Empty, ErrorAlert, FormActions, IconButton, Loading } from "@/components/ui/kit";
import { SelectField } from "@/components/ui/select";
import { CheckPicker, useProductCards } from "@/features/learning/product-form";

import { HelpLabel } from "./help-label";
import { usePlanPreviewPatch } from "./plan-preview-draft";

type Mode = "included" | "selectable";
type Item = { product_id: string; access_mode: Mode; title: string; product_type: string | null; slug: string | null; status: string | null };

/**
 * The catalog resources a plan grants: `included` (every subscriber gets them). Choose-X
 * subscribers choose separately from the live published catalog. Only types subscription fulfilment delivers
 * are offered: courses, diplomas, packages and bundles. A full-library plan needs none: it grants
 * every published course and diploma.
 */
export function PlanResourcesTab({ plan, libraryCount }: { plan: SubscriptionPlan; libraryCount: number | null }) {
  const t = useT();
  const queryClient = useQueryClient();
  const writable = can("subscriptionsWrite.write");
  const chooseX = plan.plan_type === "choose_x";
  // One type at a time: the cards endpoint caps a page at 200, which a mixed list would hit.
  const [typeFilter, setTypeFilter] = useState<string>("course");
  const addMode: Mode = "included";
  const { cards, isLoading } = useProductCards([typeFilter]);

  const [items, setItems] = useState<Item[]>(() =>
    [...(plan.products ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((p) => ({
        product_id: p.product_id,
        access_mode: p.access_mode,
        title: p.title ?? p.slug ?? p.product_id,
        product_type: p.product_type ?? null,
        slug: p.slug ?? null,
        status: p.status ?? null,
      })),
  );
  const selectedIds = useMemo(() => new Set(items.filter((i) => i.access_mode === "included").map((i) => i.product_id)), [items]);

  const typeLabel = (type: string | null) => t(productTypeLabel(type).ar, productTypeLabel(type).en);
  const options = cards.map((card) => ({ value: card.product_id, label: card.title ?? card.slug, hint: typeLabel(card.product_type) }));
  const pickedInMode = items.filter((i) => i.access_mode === addMode).map((i) => i.product_id);

  const toggle = (value: string | number) => {
    const id = String(value);
    setItems((prev) => {
      const existing = prev.find((i) => i.product_id === id);
      if (existing) {
        // Clicking an item listed under the other mode moves it to the current one.
        return existing.access_mode === addMode
          ? prev.filter((i) => i.product_id !== id)
          : prev.map((i) => (i.product_id === id ? { ...i, access_mode: addMode } : i));
      }
      const card = cards.find((c) => c.product_id === id);
      return [...prev, { product_id: id, access_mode: addMode, title: card?.title ?? card?.slug ?? id, product_type: card?.product_type ?? null, slug: card?.slug ?? null, status: "published" }];
    });
  };
  const move = (id: string, delta: -1 | 1) =>
    setItems((prev) => {
      const index = prev.findIndex((i) => i.product_id === id);
      const mode = prev[index]?.access_mode;
      let target = index + delta;
      while (target >= 0 && target < prev.length && prev[target].access_mode !== mode) target += delta;
      if (index < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const save = useMutation({
    mutationFn: () =>
      setSubscriptionPlanProducts(plan.plan_id, {
        products: items.map((i, index) => ({ product_id: i.product_id, access_mode: i.access_mode, sort_order: index })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
      toast.success(t("تم حفظ موارد الباقة", "Plan resources saved"));
    },
  });

  const asPreview = (mode: Mode) =>
    items
      .filter((i) => i.access_mode === mode)
      .map((i, index) => ({ product_id: i.product_id, access_mode: i.access_mode, sort_order: index, slug: i.slug, product_type: i.product_type, title: i.title, status: i.status }));
  usePlanPreviewPatch({ included_products: asPreview("included"), selectable_products: chooseX ? [] : asPreview("selectable") });

  const dirty =
    JSON.stringify(items.map((i) => [i.product_id, i.access_mode])) !==
    JSON.stringify([...(plan.products ?? [])].sort((a, b) => a.sort_order - b.sort_order).map((p) => [p.product_id, p.access_mode]));

  const list = (mode: Mode) => {
    const rows = items.filter((i) => i.access_mode === mode);
    if (rows.length === 0) return <Empty text={t("لا توجد موارد بعد.", "No resources yet.")} />;
    return (
      <ol className="ma-orderlist">
        {rows.map((item) => (
          <li className="ma-orderlist__row" key={item.product_id}>
            <span className="ma-orderlist__main">
              <span className="ma-cell-main">{item.title}</span>
              <span className="ma-cell-sub">{typeLabel(item.product_type)}{item.slug ? <> · <bdi>{item.slug}</bdi></> : null}</span>
            </span>
            {item.status && item.status !== "published" ? <Badge def={productStatusBadge(item.status)} /> : null}
            {writable ? (
              <>
                <IconButton icon="chevron" label={t("لأعلى", "Move up")} onClick={() => move(item.product_id, -1)} style={{ transform: "rotate(180deg)" }} />
                <IconButton icon="chevron" label={t("لأسفل", "Move down")} onClick={() => move(item.product_id, 1)} />
                <IconButton icon="trash" label={t("إزالة", "Remove")} onClick={() => setItems((prev) => prev.filter((i) => i.product_id !== item.product_id))} />
              </>
            ) : null}
          </li>
        ))}
      </ol>
    );
  };

  const fullLibrary = plan.plan_type === "full_library";
  if (fullLibrary && items.length === 0) {
    return (
      <Alert kind="info" title={t("هذه الباقة تمنح المكتبة الكاملة تلقائيًا", "This plan grants the whole library automatically")}>
        {t(
          `كل دورة ودبلوم منشور يُمنح للمشترك فور اشتراكه${libraryCount != null ? ` (${libraryCount} الآن)` : ""}، وكل ما يُنشر لاحقًا يُضاف لاشتراكه تلقائيًا. لا حاجة لإضافة موارد.`,
          `Every published course and diploma is granted when someone subscribes${libraryCount != null ? ` (${libraryCount} today)` : ""}, and anything published later is added to their subscription automatically. There are no resources to add.`,
        )}
      </Alert>
    );
  }

  return (
    <div className="ma-cols ma-cols--main-side">
      <div style={{ display: "grid", gap: "var(--space-4)" }}>
        {fullLibrary ? (
          <Alert kind="info" title={t("المكتبة الكاملة تُمنح تلقائيًا", "The whole library is granted automatically")}>
            {t(
              "الموارد أدناه تُمنح إضافةً للمكتبة (مثل الحزم والباقات المخصصة).",
              "The resources below are granted on top of the library (packages and bundles, for example).",
            )}
          </Alert>
        ) : null}
        {chooseX ? (
          <Alert kind="info" title={t("المشتركون يختارون من الكتالوج المنشور", "Subscribers choose from the published catalog")}>
            {t("يمكنهم اختيار الدورات والدبلومات والحزم والباقات المنشورة. الموارد أدناه اختيارية وتُمنح للجميع دون استخدام أحد اختياراتهم.", "They can pick published courses, diplomas, packages and bundles. The optional resources below go to everyone without using a pick.")}
          </Alert>
        ) : null}
        <Card title={t(`مضمّنة لكل المشتركين (${selectedIds.size})`, `Included for every subscriber (${selectedIds.size})`)}>
          {list("included")}
        </Card>
        <ErrorAlert error={save.error} title={t("تعذّر حفظ الموارد", "Couldn't save resources")} />
        {writable ? (
          <FormActions>
            <Button kind="primary" disabled={!dirty || save.isPending} label={save.isPending ? t("جارٍ الحفظ…", "Saving…") : t("حفظ الموارد", "Save resources")} onClick={() => save.mutate()} />
          </FormActions>
        ) : null}
      </div>

      {writable ? (
        <Card title={<HelpLabel text={t("إضافة موارد", "Add resources")} help="accessMode" />}>
          <div className="ma-form">
            <SelectField label={t("النوع", "Type")} value={typeFilter} onChange={setTypeFilter} size="md"
              options={SUBSCRIPTION_RESOURCE_TYPES.map((type) => ({ value: type, label: typeLabel(type) }))} />
            {isLoading ? <Loading /> : (
              <CheckPicker id="plan-resources" label={t("الموارد المنشورة", "Published resources")} options={options}
                selected={pickedInMode} onToggle={toggle}
                hint={t(`المحدّد في كل الباقة: ${selectedIds.size}`, `Selected across the plan: ${selectedIds.size}`)}
                searchPlaceholder={t("ابحث عن دورة أو دبلوم أو حزمة…", "Search courses, diplomas, packages…")} />
            )}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
