import { useMemo, useState } from "react";

import type { BadgeDef } from "@/components/ui/kit";
import type { SubscriptionPlan, SubscriptionPlanPreview } from "@/lib/api";
import type { Lang } from "@/lib/i18n";

/** Shared labels and helpers for the subscriptions screens. */

/** How far a company got: details only, an unfinished checkout, or a paid subscription. */
export const TEAM_LEAD_STATUS: Record<"details" | "checkout_started" | "converted", BadgeDef> = {
  details: { label: { ar: "أدخل البيانات فقط", en: "Details only" }, tone: "neutral" },
  checkout_started: { label: { ar: "بدأ الدفع ولم يكمل", en: "Checkout not completed" }, tone: "warning" },
  converted: { label: { ar: "اشترك", en: "Subscribed" }, tone: "success" },
};

type Label = { ar: string; en: string };

export const PLAN_TYPE_LABELS: Record<string, Label> = {
  standard: { ar: "قياسية", en: "Standard" },
  full_library: { ar: "المكتبة الكاملة", en: "Full library" },
  choose_x: { ar: "اختر عددًا من البرامج", en: "Choose X" },
};
export const AUDIENCE_LABELS: Record<string, Label> = {
  individual: { ar: "أفراد", en: "Individual" },
  company: { ar: "شركات", en: "Company" },
};
export const INTERVAL_LABELS: Record<string, Label> = {
  month: { ar: "شهريًا", en: "Monthly" },
  year: { ar: "سنويًا", en: "Yearly" },
};
export const PER_INTERVAL: Record<string, Label> = {
  month: { ar: "/ شهر", en: "/ month" },
  year: { ar: "/ سنة", en: "/ year" },
};

export const labelOf = (map: Record<string, Label>, key: string | null | undefined): Label =>
  map[key ?? ""] ?? { ar: key ?? "—", en: key ?? "—" };

/** Locale codes the backend stores translations and card items under. */
export const LOCALES = { ar: "ar-EG", en: "en-US" } as const;

/** Locale prefix match ("ar-EG" → "ar"), since older rows may use short codes. */
export const localeKey = (code: string): "ar" | "en" | null => {
  const prefix = code.split("-")[0].toLowerCase();
  return prefix === "ar" || prefix === "en" ? prefix : null;
};

export function translationFor(plan: SubscriptionPlan, lang: "ar" | "en") {
  return (plan.translations ?? []).find((tr) => localeKey(tr.locale_code) === lang);
}

/** Plan title in the UI language, falling back to the other language and then the slug. */
export function planTitle(plan: SubscriptionPlan, lang: Lang): string {
  return translationFor(plan, lang)?.title ?? translationFor(plan, lang === "ar" ? "en" : "ar")?.title ?? plan.title ?? plan.slug;
}

export function cardFeaturesFor(plan: SubscriptionPlan, lang: "ar" | "en"): string[] {
  const entry = Object.entries(plan.card_features_by_locale ?? {}).find(([code]) => localeKey(code) === lang);
  return entry?.[1] ?? [];
}

export const toNumber = (value: string | number | null | undefined): number => Number(value ?? 0) || 0;

const DAY = 86_400_000;
const isoDay = (date: Date) => date.toISOString().slice(0, 10);

/** `[start, end)` window for the stats endpoints, editable as two date inputs (end is inclusive in the UI). */
export function useStatsWindow(days = 30) {
  const [from, setFrom] = useState(() => isoDay(new Date(Date.now() - (days - 1) * DAY)));
  const [to, setTo] = useState(() => isoDay(new Date()));
  const window = useMemo(() => {
    const end = new Date(`${to}T00:00:00Z`);
    return { start: from, end: isoDay(new Date(end.getTime() + DAY)) };
  }, [from, to]);
  return { from, to, setFrom, setTo, window };
}

/** Suggest a slug for a copy of a plan ("pro-monthly" → "pro-monthly-copy"). */
export const copySlug = (slug: string) => `${slug}-copy`;

/** What each plan type grants, in one line (shown under the type picker). */
export const PLAN_TYPE_SUMMARY: Record<string, Label> = {
  standard: {
    ar: "يحصل المشترك على الموارد التي تضيفها «مضمّنة» طوال مدة اشتراكه.",
    en: "Subscribers get the resources you add as “Included” for as long as they stay subscribed.",
  },
  full_library: {
    ar: "يحصل المشترك تلقائيًا على كل الدورات والدبلومات المنشورة، ومنها ما يُنشر لاحقًا.",
    en: "Subscribers automatically get every published course and diploma, including ones published later.",
  },
  choose_x: {
    ar: "يختار المشترك عددًا محددًا من الدورات والدبلومات والحزم والباقات المنشورة، سنويًا فقط.",
    en: "Subscribers pick a set number of published courses, diplomas, packages or bundles. Yearly only.",
  },
};

/** The ⓘ explanations next to plan fields. `body` lines render as a list. */
export const PLAN_FIELD_HELP = {
  audience: {
    title: { ar: "الفئة", en: "Audience" },
    body: [
      { ar: "أفراد: اشتراك لشخص واحد.", en: "Individual: one learner per subscription." },
      { ar: "شركات: يشتري المالك عددًا من المقاعد ويوزّعها على موظفيه؛ كل مقعد يحصل على نفس الوصول.", en: "Company: the owner buys seats and assigns them to employees; every seat gets the same access." },
    ],
  },
  planType: {
    title: { ar: "نوع الباقة", en: "Plan type" },
    body: [
      { ar: "قياسية: الموارد التي تضيفها «مضمّنة» فقط، شهريًا أو سنويًا.", en: "Standard: only the resources you add as “Included”. Monthly or yearly." },
      { ar: "المكتبة الكاملة: كل دورة ودبلوم منشور يُمنح تلقائيًا، ومنها ما يُنشر لاحقًا. لا حاجة لإضافة موارد.", en: "Full library: every published course and diploma is granted automatically, including future ones. No resources to add." },
      { ar: "اختر عددًا: يختار المشترك حتى X برامج من الكتالوج المنشور. يمكنك إضافة موارد مضمّنة اختياريًا. يمكن الاستبدال قبل بدء التعلّم فقط. سنوية فقط.", en: "Choose X: subscribers pick up to X programs from the published catalog. Optional Included resources go to everyone. A pick can be swapped only before learning starts. Yearly only." },
    ],
  },
  interval: {
    title: { ar: "دورة الفوترة", en: "Billing interval" },
    body: [
      { ar: "كل كم يُجدَّد الاشتراك ويُحصَّل السعر. يبقى الوصول ما دام الاشتراك مدفوعًا.", en: "How often the subscription renews and is charged. Access lasts as long as it stays paid." },
      { ar: "تعرض صفحة الأسعار المكافئ الشهري للباقات السنوية.", en: "The pricing page shows the monthly equivalent of yearly plans." },
    ],
  },
  price: {
    title: { ar: "السعر", en: "Price" },
    body: [
      { ar: "ما يدفعه المشترك كل فترة فوترة، بالدولار.", en: "What the subscriber pays each billing period, in US dollars." },
      { ar: "تغيير السعر لاحقًا يطبّق على المشتركين الجدد فقط. للعروض استخدم تبويب الخصم.", en: "Changing it later applies to new subscribers only. Use the Discount tab for offers." },
    ],
  },
  allowance: {
    title: { ar: "عدد البرامج المسموح", en: "Programs allowed" },
    body: [{ ar: "كم برنامجًا يختار المشترك من الكتالوج المنشور في كل سنة اشتراك. لا تحتاج إلى إنشاء قائمة اختيار.", en: "How many programs a subscriber picks from the published catalog per subscription year. No selectable pool is required." }],
  },
  replacements: {
    title: { ar: "حد الاستبدال", en: "Replacement limit" },
    body: [{ ar: "كم مرة يمكن استبدال دورة مختارة (لم يبدأ تعلّمها) في كل فترة. فارغ = بلا حد.", en: "How many times a picked course that hasn't been started can be swapped per period. Empty = no limit." }],
  },
  seats: {
    title: { ar: "حجم الفريق", en: "Team size" },
    body: [
      { ar: "أقل وأكبر عدد موظفين يستطيع العميل شراءه في هذه الباقة، مثل 5 إلى 49.", en: "The smallest and largest team a customer can buy on this plan, e.g. 5 to 49." },
      { ar: "للفرق الأكبر من الحد الأقصى يعرض الموقع «تواصل معنا» بدل السعر.", en: "Larger teams see “Contact us” on the site instead of a price." },
    ],
  },
  seatPrice: {
    title: { ar: "السعر لكل موظف", en: "Price per employee" },
    body: [
      { ar: "يدفع العميل هذا السعر عن كل موظف في كل فترة فوترة، ثم تُضاف ضريبة القيمة المضافة على الإجمالي.", en: "The customer pays this for every employee each billing period; VAT is added on the total." },
      { ar: "مثال: 10$ × 20 موظفًا = 200$ شهريًا + الضريبة.", en: "Example: $10 × 20 employees = $200 a month + VAT." },
    ],
  },
  title: {
    title: { ar: "اسم الباقة", en: "Plan title" },
    body: [{ ar: "يظهر على البطاقة وصفحة الباقة والفاتورة. مطلوب بالعربية والإنجليزية للنشر.", en: "Shown on the card, the plan page and invoices. Required in Arabic and English to publish." }],
  },
  slug: {
    title: { ar: "رابط الباقة", en: "Plan slug" },
    body: [{ ar: "جزء الرابط: /subscriptions/<slug>. يُولَّد من الاسم الإنجليزي.", en: "The URL part: /subscriptions/<slug>. Generated from the English title." }],
  },
  featured: {
    title: { ar: "باقة مميّزة", en: "Featured plan" },
    body: [{ ar: "تُبرز البطاقة بإطار مضيء على صفحة الأسعار.", en: "Highlights the card with a glowing frame on the pricing page." }],
  },
  cardItems: {
    title: { ar: "عناصر البطاقة", en: "Card items" },
    body: [{ ar: "نقاط قصيرة تظهر بعلامة ✓ على بطاقة الباقة. نص تسويقي فقط؛ الوصول الفعلي تحدده الموارد والمزايا.", en: "Short ✓ points on the plan card. Marketing text only; actual access comes from resources and benefits." }],
  },
  accessMode: {
    title: { ar: "طريقة الوصول", en: "Access mode" },
    body: [
      { ar: "مضمّنة: يحصل عليها كل مشترك فور الاشتراك.", en: "Included: every subscriber gets it as soon as they subscribe." },
      { ar: "في باقات «اختر»، يختار المشتركون من الكتالوج المنشور؛ الموارد المضمّنة اختيارية وتُمنح للجميع.", en: "For Choose X, subscribers pick from the published catalog; optional Included resources go to everyone." },
    ],
  },
  features: {
    title: { ar: "المزايا", en: "Features" },
    body: [
      { ar: "تظهر على البطاقة وصفحة الباقة وجدول المقارنة.", en: "Shown on the card, the plan page and the comparison table." },
      { ar: "تظهر هنا المزايا المتاحة فعلًا فقط؛ المزايا غير المنفّذة بعد (مثل المخطط الذكي) معطّلة.", en: "Only features the platform delivers are listed; unimplemented ones (like the AI planner) are disabled." },
    ],
  },
  benefits: {
    title: { ar: "الاستحقاقات", en: "Benefits" },
    body: [
      { ar: "جلسات استشارة مجانية: عدد الجلسات التي يحجزها المشترك مجانًا كل فترة فوترة.", en: "Free consultation sessions: how many sessions a subscriber books free each billing period." },
      { ar: "خصم الاستشارات: نسبة الخصم على الجلسات المدفوعة.", en: "Consultation discount: the percent off paid sessions." },
    ],
  },
} satisfies Record<string, { title: Label; body: Label[] }>;

export type PlanHelpKey = keyof typeof PLAN_FIELD_HELP;

/** The price after the plan's live discount (mirrors the API's `effective_price`). */
export function discountedPrice(price: number, discount: SubscriptionPlanPreview["discount"]): number {
  if (!discount?.is_active) return price;
  const value = toNumber(discount.value);
  const next = discount.discount_type === "percent" ? price * (1 - value / 100) : price - value;
  return Math.max(0, Math.round(next * 100) / 100);
}

/**
 * The saved plan in the storefront's shape, from the admin response (a superset of it), in Arabic like the site.
 * Used until — or instead of, on an older API — `GET /admin/subscriptions/plans/{id}/preview`.
 */
export function adminPlanToPreview(plan: SubscriptionPlan): SubscriptionPlanPreview {
  const ar = translationFor(plan, "ar");
  return {
    ...plan,
    selectable_products: plan.plan_type === "choose_x" ? [] : plan.selectable_products,
    title: ar?.title ?? plan.title,
    subtitle: ar?.subtitle ?? plan.subtitle,
    short_description: ar?.short_description ?? plan.short_description,
    description: ar?.description ?? plan.description,
    card_features: cardFeaturesFor(plan, "ar"),
  };
}

/** A plan that is not saved yet, in the storefront's shape, so the create form can preview it. */
export function draftPreviewPlan(draft: {
  slug: string;
  title: string;
  audience: "individual" | "company";
  planType: "standard" | "full_library" | "choose_x";
  interval: "month" | "year";
  price: number;
  allowance: number | null;
  maxSeats: number;
  minSeats?: number;
}): SubscriptionPlanPreview {
  const price = String(draft.price);
  return {
    plan_id: "00000000-0000-0000-0000-000000000000",
    product_id: "00000000-0000-0000-0000-000000000000",
    slug: draft.slug || "new-plan",
    audience_type: draft.audience,
    plan_type: draft.planType,
    billing_interval: draft.interval,
    price,
    effective_price: price,
    currency_code: "USD",
    status: "draft",
    version: 1,
    title: draft.title || null,
    selection_allowance: draft.allowance,
    max_seats: draft.maxSeats,
    min_seats: draft.minSeats ?? 1,
    per_seat: draft.audience === "company",
    // The VAT rate is a server setting; the saved plan's preview shows it.
    tax_percent: "0",
    tax_label: "VAT",
    is_featured: false,
    features: [],
    card_features: [],
    included_products: [],
    selectable_products: [],
  };
}
