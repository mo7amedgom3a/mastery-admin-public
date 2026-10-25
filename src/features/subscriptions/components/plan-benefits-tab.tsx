import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { setSubscriptionPlanBenefits, subscriptionKeys, type SubscriptionPlan } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { toast } from "@/components/ui/toast";
import { Alert, Button, Card, Empty, ErrorAlert, FormActions, IconButton } from "@/components/ui/kit";
import { SelectField } from "@/components/ui/select";
import { AddRowButton } from "@/features/learning/product-form";

import { HelpLabel } from "./help-label";

/**
 * The benefits the platform enforces at booking time (`subscriptions/application/perks.py`): subscribers book
 * that many consultation sessions free each billing period, and get the discount on paid sessions.
 */
const BENEFITS: Record<string, { key: string; ar: string; en: string; input: { ar: string; en: string }; max: number }> = {
  consultation_credit: {
    key: "credits_per_period",
    ar: "جلسات استشارة مجانية",
    en: "Free consultation sessions",
    input: { ar: "عدد الجلسات المجانية لكل فترة فوترة", en: "Free sessions per billing period" },
    max: 100,
  },
  consultation_discount: {
    key: "discount_percent",
    ar: "خصم على الاستشارات",
    en: "Consultation discount",
    input: { ar: "نسبة الخصم على الجلسات المدفوعة ٪", en: "Discount on paid sessions %" },
    max: 99,
  },
};

type Row = { benefit_type: string; value: string };

/** Plan benefits (`PUT /admin/subscriptions/plans/{id}/benefits`): each one a type and its number. */
export function PlanBenefitsTab({ plan }: { plan: SubscriptionPlan }) {
  const t = useT();
  const queryClient = useQueryClient();
  const writable = can("subscriptionsWrite.write");
  const saved = plan.benefits ?? [];
  // Older display-only benefits (community access, …) are not enforced; saving drops them.
  const unsupported = saved.filter((b) => !BENEFITS[b.benefit_type]);
  const [rows, setRows] = useState<Row[]>(() =>
    saved
      .filter((b) => BENEFITS[b.benefit_type])
      .map((b) => ({ benefit_type: b.benefit_type, value: String((b.config ?? {})[BENEFITS[b.benefit_type].key] ?? "") })),
  );
  const update = (index: number, patch: Partial<Row>) => setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const unused = Object.keys(BENEFITS).filter((type) => !rows.some((row) => row.benefit_type === type));

  const invalid = rows.some((row) => {
    const value = Number(row.value);
    return row.value.trim() === "" || !Number.isInteger(value) || value < 1 || value > BENEFITS[row.benefit_type].max;
  });
  const save = useMutation({
    mutationFn: () =>
      setSubscriptionPlanBenefits(plan.plan_id, {
        benefits: rows.map((row) => ({ benefit_type: row.benefit_type, config: { [BENEFITS[row.benefit_type].key]: Number(row.value) } })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
      toast.success(t("تم حفظ الاستحقاقات", "Benefits saved"));
    },
  });

  return (
    <Card
      title={<HelpLabel text={t("استحقاقات الباقة", "Plan benefits")} help="benefits" />}
      actions={writable && unused.length ? (
        <AddRowButton label={t("إضافة استحقاق", "Add benefit")} onClick={() => setRows((prev) => [...prev, { benefit_type: unused[0], value: "" }])} />
      ) : null}
    >
      <div className="ma-form">
        {unsupported.length ? (
          <Alert kind="warning" title={t("استحقاقات غير مدعومة", "Unsupported benefits")}>
            {t(
              `هذه الاستحقاقات لا يطبّقها النظام وستُحذف عند الحفظ: ${unsupported.map((b) => b.benefit_type).join("، ")}`,
              `The platform doesn't apply these, so saving removes them: ${unsupported.map((b) => b.benefit_type).join(", ")}`,
            )}
          </Alert>
        ) : null}
        {rows.length === 0 ? <Empty text={t("لا توجد استحقاقات.", "No benefits.")} /> : null}
        {rows.map((row, index) => {
          const spec = BENEFITS[row.benefit_type];
          const options = Object.entries(BENEFITS)
            .filter(([type]) => type === row.benefit_type || unused.includes(type))
            .map(([type, b]) => ({ value: type, label: t(b.ar, b.en) }));
          return (
            <div key={row.benefit_type} className="ma-orderlist__row" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
              <div className="ma-field" style={{ flex: "1 1 220px" }}>
                <span className="ma-label">{t("النوع", "Type")}</span>
                <SelectField label={t("النوع", "Type")} size="md" value={row.benefit_type} options={options}
                  onChange={(value) => writable && update(index, { benefit_type: value })} />
              </div>
              <div className="ma-field" style={{ flex: "1 1 180px" }}>
                <label className="ma-label" htmlFor={`benefit-num-${index}`}>{t(spec.input.ar, spec.input.en)}</label>
                <input id={`benefit-num-${index}`} className="ma-input" type="number" min={1} max={spec.max} dir="ltr" disabled={!writable}
                  value={row.value} onChange={(event) => update(index, { value: event.target.value })} />
              </div>
              {writable ? <IconButton icon="trash" label={t("حذف", "Remove")} onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))} /> : null}
            </div>
          );
        })}
        <ErrorAlert error={save.error} title={t("تعذّر حفظ الاستحقاقات", "Couldn't save benefits")} />
        {writable ? (
          <FormActions>
            <Button kind="primary" disabled={invalid || save.isPending} label={save.isPending ? t("جارٍ الحفظ…", "Saving…") : t("حفظ الاستحقاقات", "Save benefits")}
              onClick={() => save.mutate()} />
          </FormActions>
        ) : null}
      </div>
    </Card>
  );
}
