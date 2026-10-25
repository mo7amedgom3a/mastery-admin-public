import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createSubscriptionFeature,
  subscriptionKeys,
  subscriptionQueries,
  updateSubscriptionFeature,
  type SubscriptionFeature,
  type SubscriptionFeatureBody,
} from "@/lib/api";
import { useT } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { Badge, Button, Card, ErrorAlert, Field, PageHead } from "@/components/ui/kit";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/modal";
import { PageState } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { ToggleField } from "@/features/learning/product-form";

import { FeatureIcon } from "../components/feature-icon";
import { FEATURE_ICONS } from "../feature-icons";

const EMPTY: SubscriptionFeatureBody = {
  feature_key: "",
  icon: "sparkles",
  title_ar: "",
  title_en: "",
  description_ar: "",
  description_en: "",
  sort_order: 0,
  is_active: true,
};

function FeatureEditor({
  feature,
  open,
  onClose,
}: {
  feature: SubscriptionFeature | null;
  open: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SubscriptionFeatureBody>(feature ? { ...feature } : EMPTY);
  const set = <K extends keyof SubscriptionFeatureBody>(key: K) => (value: SubscriptionFeatureBody[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, sort_order: Number(form.sort_order) || 0 };
      return feature ? updateSubscriptionFeature(feature.feature_id, body) : createSubscriptionFeature(body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
      toast.success(t("تم حفظ الميزة", "Feature saved"));
      onClose();
    },
  });
  const invalid = !/^[a-z][a-z0-9_]{1,79}$/.test(form.feature_key) || !form.title_ar.trim() || !form.title_en.trim();

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      size="lg"
      title={feature ? t("تعديل ميزة", "Edit feature") : t("ميزة جديدة", "New feature")}
      description={t(
        "تظهر الميزات على بطاقات الباقات وفي جدول المقارنة على صفحة الاشتراكات.",
        "Features show on plan cards and in the comparison table on the subscriptions page.",
      )}
      footer={
        <>
          <Button kind="primary" label={save.isPending ? t("جارٍ الحفظ…", "Saving…") : t("حفظ", "Save")}
            disabled={invalid || save.isPending} onClick={() => save.mutate()} />
          <Button kind="ghost" label={t("إلغاء", "Cancel")} onClick={onClose} />
        </>
      }
    >
      <div className="ma-form">
        <div className="ma-cols ma-cols--2">
          <Field id="f-key" label={t("المفتاح", "Key")} value={form.feature_key} onChange={set("feature_key")} dir="ltr" required
            hint={t("حروف لاتينية صغيرة وشرطة سفلية، مثل ai_planner", "lowercase snake_case, e.g. ai_planner")} />
          <Field id="f-order" type="number" label={t("الترتيب", "Order")} value={form.sort_order ?? 0} onChange={(v) => set("sort_order")(Number(v))} />
          <Field id="f-title-ar" label={t("الاسم (عربي)", "Title (Arabic)")} value={form.title_ar} onChange={set("title_ar")} dir="rtl" required />
          <Field id="f-title-en" label={t("الاسم (إنجليزي)", "Title (English)")} value={form.title_en} onChange={set("title_en")} dir="ltr" required />
          <Field id="f-desc-ar" type="textarea" rows={3} label={t("الوصف (عربي)", "Description (Arabic)")} value={form.description_ar ?? ""} onChange={set("description_ar")} dir="rtl" />
          <Field id="f-desc-en" type="textarea" rows={3} label={t("الوصف (إنجليزي)", "Description (English)")} value={form.description_en ?? ""} onChange={set("description_en")} dir="ltr" />
        </div>
        <div className="ma-field">
          <span className="ma-label">{t("الأيقونة", "Icon")}</span>
          <div className="ma-iconpick" role="radiogroup" aria-label={t("الأيقونة", "Icon")}>
            {Object.keys(FEATURE_ICONS).map((name) => (
              <button key={name} type="button" role="radio" aria-checked={form.icon === name} title={name}
                className="ma-iconpick__item" onClick={() => set("icon")(name)}>
                <FeatureIcon name={name} size={20} />
              </button>
            ))}
          </div>
        </div>
        <ToggleField id="f-active" label={t("فعّالة", "Active")} checked={Boolean(form.is_active)} onChange={set("is_active")}
          hint={t("الميزات المعطّلة تختفي من الموقع", "inactive features are hidden on the site")} />
        <ErrorAlert error={save.error} title={t("تعذّر حفظ الميزة", "Couldn't save the feature")} />
      </div>
    </Modal>
  );
}

/** The catalog of plan features (expert consultations, full library, …); unimplemented ones stay inactive. */
export default function SubscriptionFeaturesPage() {
  const t = useT();
  const features = useQuery(subscriptionQueries.features());
  const [editing, setEditing] = useState<SubscriptionFeature | "new" | null>(null);
  const writable = can("subscriptionsWrite.write");

  const columns: Column<SubscriptionFeature>[] = [
    {
      key: "feature", header: t("الميزة", "Feature"), exportValue: (f) => f.title_en,
      cell: (f) => (
        <span className="ma-cell-flex">
          <span className="ma-featureicon"><FeatureIcon name={f.icon} /></span>
          <span>
            <span className="ma-cell-main">{t(f.title_ar, f.title_en)}</span>
            <span className="ma-cell-sub"><bdi>{f.feature_key}</bdi></span>
          </span>
        </span>
      ),
    },
    { key: "desc", header: t("الوصف", "Description"), exportValue: (f) => f.description_en ?? "", cell: (f) => <span className="ma-cell-sub">{t(f.description_ar ?? "—", f.description_en ?? "—")}</span> },
    { key: "order", header: t("الترتيب", "Order"), align: "end", exportKind: "number", sortValue: (f) => f.sort_order ?? 0, exportValue: (f) => f.sort_order ?? 0, cell: (f) => <span className="ma-num">{f.sort_order}</span> },
    {
      key: "active", header: t("الحالة", "Status"), exportValue: (f) => (f.is_active ? "active" : "inactive"),
      cell: (f) => <Badge def={f.is_active ? { label: { ar: "فعّالة", en: "Active" }, tone: "success" } : { label: { ar: "غير متاحة بعد", en: "Not available yet" }, tone: "neutral" }} />,
    },
    ...(writable
      ? [{ key: "edit", header: "", exportable: false, cell: (f: SubscriptionFeature) => <Button sm kind="soft" icon="edit" label={t("تعديل", "Edit")} onClick={() => setEditing(f)} /> }]
      : []),
  ];

  return (
    <>
      <PageHead
        title={t("مزايا الاشتراكات", "Subscription features")}
        sub={t(
          "قائمة المزايا التي تختار منها كل باقة. فعّل الميزة فقط عندما تكون متاحة فعلًا للمشتركين؛ المعطّلة لا تظهر على الموقع ولا يمكن إضافتها لباقة.",
          "The features each plan picks from. Activate a feature only once subscribers can actually use it; inactive ones are hidden on the site and can't be added to a plan.",
        )}
        actions={writable ? <Button kind="primary" icon="plus" label={t("ميزة جديدة", "New feature")} onClick={() => setEditing("new")} /> : null}
      />
      <PageState error={features.error}>
        <Card flush>
          <DataTable columns={columns} rows={features.data ?? []} loading={features.isLoading}
            empty={t("لا توجد مزايا بعد.", "No features yet.")}
            exportConfig={{ filename: "subscription-features", title: t("مزايا الاشتراكات", "Subscription features") }} />
        </Card>
      </PageState>
      {editing ? (
        <FeatureEditor key={editing === "new" ? "new" : editing.feature_id} feature={editing === "new" ? null : editing} open onClose={() => setEditing(null)} />
      ) : null}
    </>
  );
}
