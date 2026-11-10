import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bell, BookOpen, Calendar, Clock, Crown, Flame, Gift, GraduationCap, Infinity as InfinityIcon,
  Megaphone, Percent, Rocket, Sparkles, Star, Tag, Ticket, Zap, type LucideIcon,
} from "lucide-react";

import { listCoupons, listProducts, subscriptionQueries, type Coupon } from "@/lib/api";
import { useLang, useT } from "@/lib/i18n";
import { AppLink } from "@/components/ui/app-link";
import { Alert, Button, ErrorAlert, Field } from "@/components/ui/kit";
import { Modal } from "@/components/ui/modal";
import { SearchSelect } from "@/components/ui/search-select";

import { couponValueLabel } from "../../lib/coupons";
import {
  ACTIONS,
  couponHighlightAr,
  fromLocalInput,
  ICONS,
  ITEM_KINDS,
  toLocalInput,
  type ItemDraft,
  type PreviewRefs,
} from "../model";

const ICON_COMPONENTS: Record<(typeof ICONS)[number], LucideIcon> = {
  sparkles: Sparkles, percent: Percent, tag: Tag, ticket: Ticket, gift: Gift, infinity: InfinityIcon,
  crown: Crown, rocket: Rocket, flame: Flame, zap: Zap, calendar: Calendar, clock: Clock,
  "graduation-cap": GraduationCap, "book-open": BookOpen, megaphone: Megaphone, star: Star, bell: Bell,
};

type ItemModalProps = {
  open: boolean;
  initial: ItemDraft;
  initialRefs: PreviewRefs;
  pending: boolean;
  error: unknown;
  onClose: () => void;
  /** Every edit, so the live preview shows the item before it is saved. */
  onDraft: (draft: ItemDraft, refs: PreviewRefs) => void;
  onSave: (draft: ItemDraft) => void;
};

const COUPON_ACTIONS = new Set(["copy_coupon", "apply_coupon_go"]);

export function ItemModal({ open, initial, initialRefs, pending, error, onClose, onDraft, onSave }: ItemModalProps) {
  const t = useT();
  const lang = useLang();
  const [draft, setDraft] = useState<ItemDraft>(initial);
  const [ownColors, setOwnColors] = useState(Boolean(initial.style_override?.bg_colors?.length));
  const set = <K extends keyof ItemDraft>(key: K, value: ItemDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const coupons = useQuery({
    queryKey: ["marketing", "announcements", "coupon-options"],
    queryFn: () => listCoupons({ limit: 200 }),
    enabled: open,
  });
  const products = useQuery({
    queryKey: ["marketing", "announcements", "product-options"],
    queryFn: () => listProducts({ source: "b2c", limit: 200 }),
    enabled: open,
  });
  const plans = useQuery({ ...subscriptionQueries.plans({ lang }), enabled: open });

  const couponList = useMemo(
    () => (coupons.data?.items ?? []).filter((c) => c.status !== "archived" && !c.customer_id),
    [coupons.data],
  );
  const coupon = couponList.find((c) => c.promotion_id === draft.coupon_id) ?? null;
  const product = (products.data?.items ?? []).find((p) => String(p.product_id) === draft.product_id) ?? null;
  const plan = (plans.data ?? []).find((p) => p.plan_id === draft.plan_id) ?? null;

  const refs: PreviewRefs = useMemo(
    () => ({
      coupon: coupon ?? (draft.coupon_id === initial.coupon_id ? initialRefs.coupon : null),
      product: product
        ? { product_id: String(product.product_id), product_type: product.product_type, slug: product.slug, title: product.title }
        : draft.product_id === initial.product_id ? initialRefs.product : null,
      plan: plan
        ? { plan_id: plan.plan_id, product_id: plan.product_id, slug: plan.slug, title: plan.title }
        : draft.plan_id === initial.plan_id ? initialRefs.plan : null,
    }),
    [coupon, product, plan, draft.coupon_id, draft.product_id, draft.plan_id, initial, initialRefs],
  );

  useEffect(() => {
    onDraft(draft, refs);
  }, [draft, refs, onDraft]);

  const pickCoupon = (id: string) => {
    const picked = couponList.find((c) => c.promotion_id === id) as Coupon | undefined;
    setDraft((d) => ({
      ...d,
      coupon_id: id || null,
      // Offer "خصم 30%" as the highlight unless the marketer already wrote one.
      highlight_ar: d.highlight_ar || (picked ? couponHighlightAr(picked) : d.highlight_ar),
      highlight_en: d.highlight_en || (picked ? (picked.kind === "percent" ? `${Number(picked.value)}% off` : `$${Number(picked.value)} off`) : d.highlight_en),
    }));
  };

  const action = draft.action_type ?? "none";
  const needsCoupon = COUPON_ACTIONS.has(action);
  const goKind = action === "apply_coupon_go" ? (draft.plan_id ? "plan" : draft.product_id ? "product" : draft.target_url != null ? "url" : "product") : null;
  const missing =
    !draft.text_ar?.trim() ||
    (needsCoupon && !draft.coupon_id) ||
    (action === "product" && !draft.product_id) ||
    (action === "subscription_plan" && !draft.plan_id) ||
    (action === "link" && !draft.target_url?.trim());

  const save = () => {
    const out: ItemDraft = { ...draft };
    out.style_override = ownColors && draft.style_override?.bg_colors?.length ? draft.style_override : draft.style_override?.accent_color ? { accent_color: draft.style_override.accent_color } : null;
    delete out.item_id;
    onSave(out);
  };

  const couponOptions = couponList.map((c) => ({
    value: c.promotion_id,
    label: `${c.code} · ${couponValueLabel(c)}${c.status !== "active" ? ` · ${c.status}` : ""}`,
  }));
  const productOptions = (products.data?.items ?? [])
    .filter((p) => p.product_id && p.product_type !== "subscription")
    .map((p) => ({ value: String(p.product_id), label: `${p.title ?? p.slug} · ${p.product_type}` }));
  const planOptions = (plans.data ?? []).map((p) => ({ value: p.plan_id, label: `${p.title ?? p.slug} · ${p.billing_interval}` }));

  return (
    <Modal
      open={open}
      onOpenChange={(next) => (!next ? onClose() : undefined)}
      size="lg"
      title={initial.item_id ? t("تعديل عنصر", "Edit item") : t("عنصر جديد", "New item")}
      footer={
        <>
          <Button kind="primary" icon="check" disabled={pending || missing} label={pending ? t("جارٍ الحفظ…", "Saving…") : t("حفظ العنصر", "Save item")} onClick={save} />
          <Button kind="ghost" label={t("إلغاء", "Cancel")} onClick={onClose} />
        </>
      }
    >
      <div className="ma-form">
        <div className="ma-form-grid ma-form-grid--2">
          <Field
            id="item-kind"
            label={t("نوع العنصر", "Item type")}
            options={ITEM_KINDS.map(([value, label]) => [value, t(label.ar, label.en)])}
            value={draft.kind ?? "info"}
            onChange={(v) => {
              const icon = ITEM_KINDS.find(([value]) => value === v)?.[2];
              setDraft((d) => ({ ...d, kind: v as ItemDraft["kind"], icon: icon ?? d.icon }));
            }}
          />
          <label className="ma-check" htmlFor="item-active" style={{ alignSelf: "end" }}>
            <input id="item-active" type="checkbox" checked={draft.is_active !== false} onChange={(e) => set("is_active", e.target.checked)} />
            <span>{t("ظاهر في الشريط", "Shown in the bar")}</span>
          </label>
        </div>

        <div className="ma-field">
          <span className="ma-label">{t("الأيقونة", "Icon")}</span>
          <div className="ma-ann-icons" role="group" aria-label={t("الأيقونة", "Icon")}>
            {ICONS.map((name) => {
              const Icon = ICON_COMPONENTS[name];
              return (
                <button key={name} type="button" title={name} aria-label={name} aria-pressed={draft.icon === name} onClick={() => set("icon", name)}>
                  <Icon size={16} aria-hidden />
                </button>
              );
            })}
          </div>
        </div>

        <div className="ma-form-grid ma-form-grid--2">
          <Field id="item-text-ar" label={t("النص (عربي)", "Text (Arabic)")} required dir="rtl" maxLength={300} value={draft.text_ar ?? ""} onChange={(v) => set("text_ar", v)} hint={t("جملة قصيرة، مثل: على كل الدورات حتى الأحد.", "Keep it short, e.g. on every course until Sunday.")} />
          <Field id="item-text-en" label={t("النص (إنجليزي)", "Text (English)")} dir="ltr" maxLength={300} value={draft.text_en ?? ""} onChange={(v) => set("text_en", v || null)} />
          <Field id="item-highlight-ar" label={t("الإبراز (عربي)", "Highlight (Arabic)")} dir="rtl" maxLength={80} value={draft.highlight_ar ?? ""} onChange={(v) => set("highlight_ar", v || null)} hint={t("يظهر بلون الإبراز، مثل: خصم 30%.", "Shown in the highlight colour, e.g. 30% off.")} />
          <Field id="item-highlight-en" label={t("الإبراز (إنجليزي)", "Highlight (English)")} dir="ltr" maxLength={80} value={draft.highlight_en ?? ""} onChange={(v) => set("highlight_en", v || null)} />
          <Field id="item-badge-ar" label={t("الشارة (عربي)", "Badge (Arabic)")} dir="rtl" maxLength={60} value={draft.badge_ar ?? ""} onChange={(v) => set("badge_ar", v || null)} hint={t("اختياري، مثل: الجمعة البيضاء.", "Optional, e.g. Black Friday.")} />
          <Field id="item-badge-en" label={t("الشارة (إنجليزي)", "Badge (English)")} dir="ltr" maxLength={60} value={draft.badge_en ?? ""} onChange={(v) => set("badge_en", v || null)} />
          <Field
            id="item-countdown"
            type="datetime-local"
            label={t("عدّ تنازلي حتى", "Countdown to")}
            hint={t("اختياري. يختفي العنصر تلقائياً عند الوصول للصفر.", "Optional. The item hides itself at zero.")}
            value={toLocalInput(draft.countdown_to)}
            onChange={(v) => set("countdown_to", fromLocalInput(v))}
          />
        </div>

        <Field
          id="item-action"
          label={t("زر الإجراء", "Action")}
          options={ACTIONS.map(([value, label]) => [value, t(label.ar, label.en)])}
          value={action}
          onChange={(v) => set("action_type", v as ItemDraft["action_type"])}
          hint={(() => {
            const help = ACTIONS.find(([value]) => value === action)?.[2];
            return help ? t(help.ar, help.en) : undefined;
          })()}
        />

        <div className="ma-field">
          <span className="ma-label">
            {t("الكوبون", "Coupon")}
            {needsCoupon ? <span aria-hidden="true" className="ma-req"> *</span> : null}
          </span>
          <SearchSelect
            label={t("اختر كوبوناً", "Pick a coupon")}
            fullWidth
            size="md"
            value={draft.coupon_id ?? ""}
            onChange={pickCoupon}
            options={[{ value: "", label: t("بدون كوبون", "No coupon") }, ...couponOptions]}
            searchPlaceholder={t("ابحث بالكود…", "Search code…")}
          />
          <span className="ma-help">
            {t("يختفي العنصر تلقائياً عندما ينتهي الكوبون أو تنفد استخداماته.", "The item hides itself when the coupon expires or is used up.")}{" "}
            <AppLink className="ma-link" to="/sales/coupons/new" target="_blank">
              {t("إنشاء كوبون جديد", "Create a coupon")}
            </AppLink>
          </span>
          {coupon && coupon.status !== "active" ? (
            <Alert kind="warning" title={t("الكوبون غير مفعّل الآن", "This coupon isn't live")}>
              {t("لن يظهر العنصر حتى يصبح الكوبون مفعّلاً وضمن فترته.", "The item stays hidden until the coupon is active and within its dates.")}
            </Alert>
          ) : null}
        </div>

        {action === "apply_coupon_go" ? (
          <Field
            id="item-go-kind"
            label={t("الوجهة بعد تطبيق الكوبون", "Destination after applying")}
            options={[
              ["product", t("منتج (دورة، دبلوم…)", "Product (course, diploma…)")],
              ["plan", t("خطة اشتراك", "Subscription plan")],
              ["url", t("رابط في الموقع", "Site link")],
            ]}
            value={goKind ?? "product"}
            onChange={(v) =>
              setDraft((d) => ({
                ...d,
                product_id: v === "product" ? d.product_id ?? null : null,
                plan_id: v === "plan" ? d.plan_id ?? planOptions[0]?.value ?? null : null,
                target_url: v === "url" ? d.target_url ?? "/" : null,
              }))
            }
          />
        ) : null}

        {action === "product" || (action === "apply_coupon_go" && goKind === "product") ? (
          <div className="ma-field">
            <span className="ma-label">{t("المنتج", "Product")} <span aria-hidden="true" className="ma-req">*</span></span>
            <SearchSelect label={t("اختر منتجاً", "Pick a product")} fullWidth size="md" value={draft.product_id ?? ""} onChange={(v) => set("product_id", v || null)} options={productOptions} searchPlaceholder={t("ابحث عن منتج…", "Search products…")} />
            {coupon && (coupon.product_ids?.length ?? 0) > 0 && draft.product_id && !coupon.product_ids?.includes(draft.product_id) ? (
              <span className="ma-help" style={{ color: "var(--danger, #c2002f)" }}>
                {t("هذا الكوبون لا يشمل المنتج المختار.", "This coupon doesn't cover the selected product.")}
              </span>
            ) : null}
          </div>
        ) : null}

        {action === "subscription_plan" || (action === "apply_coupon_go" && goKind === "plan") ? (
          <div className="ma-field">
            <span className="ma-label">{t("خطة الاشتراك", "Subscription plan")} <span aria-hidden="true" className="ma-req">*</span></span>
            <SearchSelect label={t("اختر خطة", "Pick a plan")} fullWidth size="md" value={draft.plan_id ?? ""} onChange={(v) => set("plan_id", v || null)} options={planOptions} />
            {action === "apply_coupon_go" ? (
              <span className="ma-help">{t("يجب أن يشمل الكوبون الاشتراكات (اختر منتج الخطة أو نوع «اشتراك» في الكوبون).", "The coupon must cover subscriptions (the plan's product, or the subscription type).")}</span>
            ) : null}
          </div>
        ) : null}

        {action === "link" || (action === "apply_coupon_go" && goKind === "url") ? (
          <Field id="item-url" label={t("الرابط", "Link")} required dir="ltr" value={draft.target_url ?? ""} onChange={(v) => set("target_url", v || null)} hint={t("مسار داخل الموقع يبدأ بـ /، مثل /subscriptions.", "A site path starting with /, e.g. /subscriptions.")} />
        ) : null}

        {action !== "none" ? (
          <div className="ma-form-grid ma-form-grid--2">
            <Field id="item-label-ar" label={t("نص الزر (عربي)", "Button (Arabic)")} dir="rtl" maxLength={60} value={draft.action_label_ar ?? ""} onChange={(v) => set("action_label_ar", v || null)} hint={t("فارغ = نص افتراضي مناسب.", "Empty = a sensible default.")} />
            <Field id="item-label-en" label={t("نص الزر (إنجليزي)", "Button (English)")} dir="ltr" maxLength={60} value={draft.action_label_en ?? ""} onChange={(v) => set("action_label_en", v || null)} />
          </div>
        ) : null}

        <label className="ma-check" htmlFor="item-own-colors">
          <input
            id="item-own-colors"
            type="checkbox"
            checked={ownColors}
            onChange={(e) => {
              setOwnColors(e.target.checked);
              set("style_override", e.target.checked ? { ...(draft.style_override ?? {}), bg_colors: draft.style_override?.bg_colors ?? ["#1a1033", "#3b1f6b"] } : { ...(draft.style_override ?? {}), bg_colors: null });
            }}
          />
          <span>
            {t("خلفية خاصة لهذا العنصر", "Own background for this item")}
            <span className="ma-member__meta"> · {t("في وضع الشرائح يتغير لون الشريط مع العنصر", "in slides mode the bar changes colour with the item")}</span>
          </span>
        </label>
        {ownColors ? (
          <div className="ma-ann-colors">
            {(draft.style_override?.bg_colors ?? []).map((color, index) => (
              <div key={index} className="ma-ann-color">
                <span className="ma-label">{t(`اللون ${index + 1}`, `Colour ${index + 1}`)}</span>
                <div className="ma-ann-color__row">
                  <input
                    type="color"
                    aria-label={t(`اللون ${index + 1}`, `Colour ${index + 1}`)}
                    value={color}
                    onChange={(e) => set("style_override", { ...draft.style_override, bg_colors: (draft.style_override?.bg_colors ?? []).map((c, i) => (i === index ? e.target.value : c)) })}
                  />
                  <span className="ma-num">{color}</span>
                </div>
              </div>
            ))}
            <div className="ma-ann-color">
              <span className="ma-label">{t("لون الإبراز", "Highlight")}</span>
              <div className="ma-ann-color__row">
                <input type="color" aria-label={t("لون الإبراز", "Highlight")} value={draft.style_override?.accent_color ?? "#ffe14d"} onChange={(e) => set("style_override", { ...draft.style_override, accent_color: e.target.value })} />
                <span className="ma-num">{draft.style_override?.accent_color ?? "—"}</span>
              </div>
            </div>
          </div>
        ) : null}

        <ErrorAlert error={error} title={t("تعذّر حفظ العنصر", "Couldn't save the item")} />
      </div>
    </Modal>
  );
}
