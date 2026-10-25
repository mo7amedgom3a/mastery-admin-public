import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { setSubscriptionPlanFeatures, subscriptionKeys, subscriptionQueries, type SubscriptionPlan } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { toast } from "@/components/ui/toast";
import { Button, Card, Empty, ErrorAlert, FormActions, IconButton, Loading } from "@/components/ui/kit";
import { ToggleField } from "@/features/learning/product-form";

import { FeatureIcon } from "./feature-icon";
import { HelpLabel } from "./help-label";
import { usePlanPreviewPatch } from "./plan-preview-draft";

type Row = { feature_id: string; value_ar: string; value_en: string; is_highlighted: boolean };

/**
 * Which catalog features this plan offers, with an optional per-plan value
 * ("2 جلسات شهريًا") and a highlight flag (shown on the plan card; all features
 * appear on the plan page and in the comparison table).
 */
export function PlanFeaturesTab({ plan }: { plan: SubscriptionPlan }) {
  const t = useT();
  const queryClient = useQueryClient();
  const writable = can("subscriptionsWrite.write");
  const catalog = useQuery(subscriptionQueries.features());
  const [rows, setRows] = useState<Row[]>(() =>
    (plan.plan_features ?? []).map((f) => ({
      feature_id: f.feature_id,
      value_ar: f.value_ar ?? "",
      value_en: f.value_en ?? "",
      is_highlighted: Boolean(f.is_highlighted),
    })),
  );
  const byId = new Map((catalog.data ?? []).map((f) => [f.feature_id, f]));
  const included = new Set(rows.map((r) => r.feature_id));

  const toggle = (featureId: string) =>
    setRows((prev) =>
      included.has(featureId)
        ? prev.filter((r) => r.feature_id !== featureId)
        : [...prev, { feature_id: featureId, value_ar: "", value_en: "", is_highlighted: false }],
    );
  const update = (featureId: string, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.feature_id === featureId ? { ...r, ...patch } : r)));
  const move = (index: number, delta: -1 | 1) =>
    setRows((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const save = useMutation({
    mutationFn: () =>
      setSubscriptionPlanFeatures(plan.plan_id, {
        features: rows.map((r) => ({
          feature_id: r.feature_id,
          value_ar: r.value_ar.trim() || null,
          value_en: r.value_en.trim() || null,
          is_highlighted: r.is_highlighted,
        })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
      toast.success(t("تم حفظ مزايا الباقة", "Plan features saved"));
    },
  });

  usePlanPreviewPatch({
    features: rows.flatMap((r) => {
      const feature = byId.get(r.feature_id);
      return feature
        ? [{
            feature_id: r.feature_id,
            key: feature.feature_key,
            icon: feature.icon ?? null,
            title: feature.title_ar,
            description: feature.description_ar ?? null,
            value: r.value_ar.trim() || null,
            highlighted: r.is_highlighted,
          }]
        : [];
    }),
  });

  if (catalog.isLoading) return <Loading />;
  const available = (catalog.data ?? []).filter((f) => f.is_active && !included.has(f.feature_id));

  return (
    <div className="ma-cols ma-cols--main-side">
      <Card title={<HelpLabel text={t(`مزايا الباقة (${rows.length})`, `Plan features (${rows.length})`)} help="features" />}>
        {rows.length === 0 ? <Empty text={t("لم تُضف مزايا بعد.", "No features added yet.")} /> : null}
        <ol className="ma-orderlist">
          {rows.map((row, index) => {
            const feature = byId.get(row.feature_id);
            return (
              <li key={row.feature_id} className="ma-orderlist__row" style={{ flexWrap: "wrap", alignItems: "flex-start" }}>
                <span className="ma-featureicon"><FeatureIcon name={feature?.icon} /></span>
                <div className="ma-orderlist__main" style={{ flex: "1 1 220px", gap: "var(--space-2)" }}>
                  <span className="ma-cell-main">{feature ? t(feature.title_ar, feature.title_en) : row.feature_id}</span>
                  <div className="ma-cols ma-cols--2" style={{ gap: "var(--space-2)" }}>
                    <input className="ma-input" dir="rtl" value={row.value_ar} disabled={!writable} maxLength={160}
                      placeholder={t("قيمة اختيارية (عربي) مثل: جلستان شهريًا", "Optional value (Arabic)")}
                      aria-label={t("القيمة بالعربية", "Arabic value")}
                      onChange={(e) => update(row.feature_id, { value_ar: e.target.value })} />
                    <input className="ma-input" dir="ltr" value={row.value_en} disabled={!writable} maxLength={160}
                      placeholder={t("قيمة اختيارية (إنجليزي)", "Optional value, e.g. 2 sessions / month")}
                      aria-label={t("القيمة بالإنجليزية", "English value")}
                      onChange={(e) => update(row.feature_id, { value_en: e.target.value })} />
                  </div>
                  <ToggleField id={`hl-${row.feature_id}`} label={t("إبرازها على البطاقة", "Highlight on the card")}
                    checked={row.is_highlighted} onChange={(checked) => writable && update(row.feature_id, { is_highlighted: checked })} />
                </div>
                {writable ? (
                  <>
                    <IconButton icon="chevron" label={t("لأعلى", "Move up")} onClick={() => move(index, -1)} style={{ transform: "rotate(180deg)" }} />
                    <IconButton icon="chevron" label={t("لأسفل", "Move down")} onClick={() => move(index, 1)} />
                    <IconButton icon="trash" label={t("إزالة", "Remove")} onClick={() => toggle(row.feature_id)} />
                  </>
                ) : null}
              </li>
            );
          })}
        </ol>
        <ErrorAlert error={save.error} title={t("تعذّر الحفظ", "Couldn't save")} />
        {writable ? (
          <FormActions>
            <Button kind="primary" disabled={save.isPending} label={save.isPending ? t("جارٍ الحفظ…", "Saving…") : t("حفظ المزايا", "Save features")}
              onClick={() => save.mutate()} />
          </FormActions>
        ) : null}
      </Card>
      {writable ? (
        <Card title={t("إضافة من القائمة", "Add from the catalog")} actions={<Button sm kind="ghost" label={t("إدارة القائمة", "Manage catalog")} href="/subscriptions/features" />}>
          {available.length === 0 ? <Empty text={t("كل المزايا مضافة.", "Every feature is added.")} /> : null}
          <ul className="ma-orderlist">
            {available.map((f) => (
              <li key={f.feature_id} className="ma-orderlist__row">
                <span className="ma-featureicon"><FeatureIcon name={f.icon} /></span>
                <span className="ma-orderlist__main">
                  <span className="ma-cell-main">{t(f.title_ar, f.title_en)}</span>
                  <span className="ma-cell-sub">{t(f.description_ar ?? "", f.description_en ?? "")}</span>
                </span>
                <Button sm kind="soft" icon="plus" label={t("إضافة", "Add")} onClick={() => toggle(f.feature_id)} />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
