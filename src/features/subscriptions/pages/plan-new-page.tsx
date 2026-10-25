import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { createSubscriptionPlan } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { toast } from "@/components/ui/toast";
import { Alert, Button, Card, ErrorAlert, Field, FormActions, PageHead } from "@/components/ui/kit";
import {
  isPriceRequiredValid,
  isValidSlug,
  parsePrice,
  PriceField,
  SegmentedChoice,
  SlugField,
  toSlug,
} from "@/features/learning/product-form";

import { HelpLabel } from "../components/help-label";
import { PlanPreviewPanel } from "../components/plan-preview";
import { LOCALES, PLAN_TYPE_SUMMARY, draftPreviewPlan } from "../lib";

type Audience = "individual" | "company";
type PlanType = "standard" | "full_library" | "choose_x";
type Interval = "month" | "year";

/**
 * `POST /admin/subscriptions/plans` — only what defines the plan: who it is for, what it grants, what it costs and
 * its name. Content, card items, features, resources, benefits and the discount are set on the plan's page.
 */
export default function SubscriptionPlanNewPage() {
  const t = useT();
  const navigate = useNavigate();

  const [titleAr, setTitleAr] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [audience, setAudience] = useState<Audience>("individual");
  const [planType, setPlanType] = useState<PlanType>("standard");
  const [interval, setInterval] = useState<Interval>("month");
  const [price, setPrice] = useState("");
  const [allowance, setAllowance] = useState("5");
  const [minSeats, setMinSeats] = useState("5");
  const [maxSeats, setMaxSeats] = useState("49");

  const chooseX = planType === "choose_x";
  // Choose-X plans are annual only (CHX-01).
  const effectiveInterval: Interval = chooseX ? "year" : interval;
  const company = audience === "company";
  const seats = company ? Math.max(1, Number(maxSeats) || 1) : 1;
  const fewestSeats = company ? Math.max(1, Number(minSeats) || 1) : 1;

  const setTitleEnSafe = (value: string) => {
    setTitleEn(value);
    if (!slugEdited) setSlug(toSlug(value));
  };

  const create = useMutation({
    mutationFn: () =>
      createSubscriptionPlan({
        slug: slug.trim(),
        audience_type: audience,
        plan_type: planType,
        billing_interval: effectiveInterval,
        price: String(parsePrice(price) ?? 0),
        currency_code: "USD",
        status: "draft",
        selection_allowance: chooseX ? Number(allowance) : null,
        max_replacements_per_period: null,
        max_seats: seats,
        min_seats: fewestSeats,
        is_featured: false,
        translations: [
          { locale_code: LOCALES.ar, title: titleAr.trim() },
          { locale_code: LOCALES.en, title: titleEn.trim() },
        ],
      }),
    onSuccess: (plan) => {
      toast.success(t("تم إنشاء الباقة كمسودة", "Plan created as a draft"));
      navigate(`/subscriptions/plans/${plan.plan_id}?tab=${planType === "standard" ? "resources" : "features"}`);
    },
  });

  const invalid =
    !titleAr.trim() ||
    !titleEn.trim() ||
    !slug.trim() ||
    !isValidSlug(slug) ||
    !isPriceRequiredValid(price) ||
    (parsePrice(price) ?? 0) <= 0 ||
    (chooseX && !(Number(allowance) >= 1)) ||
    (company && fewestSeats > seats);

  const preview = useMemo(
    () =>
      draftPreviewPlan({
        slug,
        title: titleAr.trim(),
        audience,
        planType,
        interval: effectiveInterval,
        price: parsePrice(price) ?? 0,
        allowance: chooseX ? Number(allowance) || null : null,
        maxSeats: seats,
        minSeats: fewestSeats,
      }),
    [slug, titleAr, audience, planType, effectiveInterval, price, chooseX, allowance, seats, fewestSeats],
  );
  const summary = PLAN_TYPE_SUMMARY[planType];

  return (
    <>
      <PageHead
        title={t("باقة اشتراك جديدة", "New subscription plan")}
        sub={t(
          "ابدأ بالأساسيات فقط. تُحفظ الباقة كمسودة، ثم تضيف المزايا والمحتوى والموارد المضمّنة عند الحاجة وتنشرها.",
          "Start with the essentials. The plan is saved as a draft; then add features, content and any Included resources before publishing.",
        )}
        back={{ href: "/subscriptions/plans", label: t("الباقات", "Plans") }}
      />
      <form
        className="ma-cols ma-cols--2"
        style={{ alignItems: "start" }}
        onSubmit={(event) => {
          event.preventDefault();
          if (!invalid) create.mutate();
        }}
      >
        <div className="ma-form">
          <Card title={t("النموذج والتسعير", "Model & pricing")}>
            <div className="ma-form">
              <SegmentedChoice<Audience> label={<HelpLabel text={t("الفئة", "Audience")} help="audience" />} value={audience} onChange={setAudience}
                options={[{ value: "individual", label: t("أفراد", "Individual") }, { value: "company", label: t("شركات (مقاعد)", "Company (seats)") }]} />
              <div className="ma-field">
                <SegmentedChoice<PlanType> label={<HelpLabel text={t("نوع الباقة", "Plan type")} help="planType" />} value={planType} onChange={setPlanType}
                  options={[
                    { value: "standard", label: t("قياسية", "Standard") },
                    { value: "full_library", label: t("المكتبة الكاملة", "Full library") },
                    { value: "choose_x", label: t("اختر عددًا من البرامج", "Choose X programs") },
                  ]} />
                <span className="ma-help">{t(summary.ar, summary.en)}</span>
              </div>
              <SegmentedChoice<Interval> label={<HelpLabel text={t("دورة الفوترة", "Billing interval")} help="interval" />} value={effectiveInterval}
                onChange={(v) => !chooseX && setInterval(v)}
                options={[{ value: "month", label: t("شهري", "Monthly") }, { value: "year", label: t("سنوي", "Yearly") }]} />
              {chooseX ? <Alert kind="info" title={t("باقات «اختر» سنوية فقط.", "Choose-X plans are yearly only.")} /> : null}
              <div className="ma-form-grid">
                <PriceField id="plan-price" value={price} onChange={setPrice} invalid={price !== "" && !isPriceRequiredValid(price)}
                  label={company
                    ? <HelpLabel text={t("السعر لكل موظف (USD)", "Price per employee (USD)")} help="seatPrice" />
                    : <HelpLabel text={t("السعر (USD)", "Price (USD)")} help="price" />} />
                {chooseX ? (
                  <Field id="plan-allowance" type="number" min={1} label={<HelpLabel text={t("عدد البرامج المسموح", "Programs allowed")} help="allowance" />}
                    value={allowance} onChange={setAllowance} required />
                ) : null}
                {company ? (
                  <>
                    <Field id="plan-min-seats" type="number" min={1} label={<HelpLabel text={t("أقل حجم فريق", "Min team size")} help="seats" />}
                      value={minSeats} onChange={setMinSeats} />
                    <Field id="plan-seats" type="number" min={1} label={t("أكبر حجم فريق", "Max team size")}
                      value={maxSeats} onChange={setMaxSeats}
                      hint={fewestSeats > seats ? t("يجب ألا يقل عن أقل حجم.", "Must be at least the min team size.") : undefined} />
                  </>
                ) : null}
              </div>
            </div>
          </Card>

          <Card title={t("الاسم", "Name")}>
            <div className="ma-form">
              <div className="ma-cols ma-cols--2">
                <Field id="plan-title-ar" label={<HelpLabel text={t("الاسم (عربي)", "Title (Arabic)")} help="title" />} required value={titleAr} onChange={setTitleAr} dir="rtl" />
                <Field id="plan-title-en" label={t("الاسم (إنجليزي)", "Title (English)")} required value={titleEn} onChange={setTitleEnSafe} dir="ltr" />
              </div>
              <SlugField id="plan-slug" value={slug} required
                onChange={(value) => { setSlug(value); setSlugEdited(true); }}
                onRegenerate={() => { setSlug(toSlug(titleEn)); setSlugEdited(false); }}
                hint={t("يُولَّد من الاسم الإنجليزي.", "Generated from the English title.")} />
            </div>
          </Card>

          <Alert kind="info" title={t("بعد الحفظ", "After saving")}>
            {planType === "full_library"
              ? t(
                  "لا تحتاج لإضافة موارد: كل الدورات والدبلومات المنشورة تُمنح تلقائيًا. أضف المزايا وعناصر البطاقة والوصف ثم انشر.",
                  "No resources to add: every published course and diploma is granted automatically. Add features, card items and a description, then publish.",
                )
              : planType === "choose_x"
              ? t(
                  "يختار المشترك برامجه من كل الدورات والدبلومات والحزم والباقات المنشورة. يمكنك إضافة موارد مضمّنة للجميع اختياريًا، ثم المزايا والمحتوى، ثم النشر.",
                  "Subscribers pick from every published course, diploma, package and bundle. You may add optional Included resources for everyone, then features and content, then publish.",
                )
              : t(
                  "أضف الموارد التي تمنحها الباقة، ثم المزايا وعناصر البطاقة والوصف، ثم انشر.",
                  "Add the resources the plan grants, then features, card items and a description, then publish.",
                )}
          </Alert>

          <ErrorAlert error={create.error} title={t("تعذّر إنشاء الباقة", "Couldn't create the plan")} />
          <FormActions>
            <Button kind="primary" type="submit" disabled={invalid || create.isPending}
              label={create.isPending ? t("جارٍ الحفظ…", "Saving…") : t("حفظ كمسودة", "Save as draft")} />
            <Button kind="ghost" label={t("إلغاء", "Cancel")} href="/subscriptions/plans" />
          </FormActions>
        </div>

        <div style={{ position: "sticky", insetBlockStart: "var(--space-4)" }}>
          <PlanPreviewPanel plan={preview} />
        </div>
      </form>
    </>
  );
}
