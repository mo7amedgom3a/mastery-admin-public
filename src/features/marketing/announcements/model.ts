import type { BadgeDef } from "@/components/ui/kit";
import type {
  AnnouncementBarAdmin,
  AnnouncementItemAdmin,
  AnnouncementItemInput,
  AnnouncementStyle,
  Coupon,
} from "@/lib/api";

type Bi = { ar: string; en: string };

// ---------------------------------------------------------------- vocabularies

export const BAR_STATUS: Record<AnnouncementBarAdmin["status"], BadgeDef> = {
  active: { label: { ar: "منشور", en: "Live" }, tone: "success" },
  paused: { label: { ar: "موقوف", en: "Paused" }, tone: "warning" },
  draft: { label: { ar: "مسودة", en: "Draft" }, tone: "info" },
  archived: { label: { ar: "مؤرشف", en: "Archived" }, tone: "neutral" },
};

export const PLACEMENTS: { value: string; label: Bi }[] = [
  { value: "all", label: { ar: "كل الصفحات", en: "Every page" } },
  { value: "home", label: { ar: "الرئيسية", en: "Home" } },
  { value: "courses", label: { ar: "صفحات الدورات", en: "Course pages" } },
  { value: "diplomas", label: { ar: "صفحات الدبلومات", en: "Diploma pages" } },
  { value: "packages", label: { ar: "الباقات", en: "Packages" } },
  { value: "bundles", label: { ar: "الحزم", en: "Bundles" } },
  { value: "subscriptions", label: { ar: "الاشتراكات", en: "Subscriptions" } },
  { value: "search", label: { ar: "البحث والتصفح", en: "Search & browse" } },
  { value: "cart", label: { ar: "السلة", en: "Cart" } },
];

export const AUDIENCES: [AnnouncementBarAdmin["audience"], Bi][] = [
  ["all", { ar: "الجميع", en: "Everyone" }],
  ["guest", { ar: "الزوار غير المسجلين", en: "Guests only" }],
  ["signed_in", { ar: "المسجلون فقط", en: "Signed-in only" }],
];

export const LAYOUTS: [AnnouncementBarAdmin["layout"], Bi, Bi][] = [
  ["rotate", { ar: "شرائح متبدلة", en: "Rotating slides" }, { ar: "عنصر واحد في كل مرة مع أسهم تنقل.", en: "One item at a time with arrows." }],
  ["marquee", { ar: "شريط متحرك", en: "Scrolling marquee" }, { ar: "العناصر تتحرك باستمرار عبر الشريط.", en: "Items scroll continuously." }],
  ["inline", { ar: "متجاورة", en: "Side by side" }, { ar: "كل العناصر معاً على الشاشات الكبيرة، وشرائح على الجوال.", en: "All items in a row on desktop, slides on mobile." }],
];

export const ITEM_KINDS: [AnnouncementItemAdmin["kind"], Bi, string][] = [
  ["discount", { ar: "خصم / كوبون", en: "Discount / coupon" }, "percent"],
  ["unlimited_access", { ar: "وصول غير محدود", en: "Unlimited access" }, "infinity"],
  ["free_course", { ar: "دورة مجانية", en: "Free course" }, "gift"],
  ["new_course", { ar: "إطلاق جديد", en: "New launch" }, "sparkles"],
  ["event", { ar: "فعالية / موعد", en: "Event / date" }, "calendar"],
  ["info", { ar: "إعلان عام", en: "General notice" }, "megaphone"],
];

export const ACTIONS: [AnnouncementItemAdmin["action_type"], Bi, Bi][] = [
  ["none", { ar: "بدون زر", en: "No button" }, { ar: "نص فقط.", en: "Text only." }],
  ["copy_coupon", { ar: "نسخ الكوبون", en: "Copy coupon" }, { ar: "يُنسخ الكود ويُحفظ ليُطبَّق تلقائياً عند الدفع.", en: "Copies the code and keeps it for checkout." }],
  ["apply_coupon_go", { ar: "تطبيق الكوبون والانتقال", en: "Apply coupon & go" }, { ar: "يُفعَّل الكوبون وينتقل العميل إلى منتج أو اشتراك أو رابط.", en: "Activates the coupon and opens a product, plan or link." }],
  ["product", { ar: "فتح منتج", en: "Open a product" }, { ar: "زر يفتح صفحة دورة أو دبلوم.", en: "Opens a course or diploma page." }],
  ["subscription_plan", { ar: "فتح خطة اشتراك", en: "Open a plan" }, { ar: "زر يفتح صفحة خطة الاشتراك.", en: "Opens a subscription plan page." }],
  ["link", { ar: "رابط", en: "Link" }, { ar: "أي صفحة في الموقع، مثل /subscriptions.", en: "Any site page, e.g. /subscriptions." }],
];

export const ICONS = [
  "sparkles", "percent", "tag", "ticket", "gift", "infinity", "crown", "rocket", "flame",
  "zap", "calendar", "clock", "graduation-cap", "book-open", "megaphone", "star", "bell",
] as const;

export const HIDDEN_REASON: Record<string, Bi> = {
  inactive: { ar: "العنصر موقوف", en: "Item turned off" },
  coupon_missing: { ar: "الكوبون محذوف أو مؤرشف", en: "Coupon archived or missing" },
  coupon_inactive: { ar: "الكوبون موقوف", en: "Coupon inactive" },
  coupon_used_up: { ar: "انتهت استخدامات الكوبون", en: "Coupon used up" },
  coupon_not_started: { ar: "الكوبون لم يبدأ بعد", en: "Coupon not started" },
  coupon_expired: { ar: "انتهت صلاحية الكوبون", en: "Coupon expired" },
  coupon_personal: { ar: "كوبون شخصي", en: "Personal coupon" },
  countdown_ended: { ar: "انتهى العد التنازلي", en: "Countdown ended" },
  product_missing: { ar: "المنتج غير موجود", en: "Product missing" },
  plan_missing: { ar: "الخطة غير موجودة", en: "Plan missing" },
};

// ---------------------------------------------------------------- style presets

export type StylePreset = { key: string; label: Bi; style: AnnouncementStyle };

const preset = (
  key: string,
  label: Bi,
  colors: string[],
  text: string,
  accent: string,
  badge: string,
  type: "solid" | "gradient" = "gradient",
): StylePreset => ({
  key,
  label,
  style: { preset: key, bg: { type, colors, angle: 100, animated: false }, text_color: text, accent_color: accent, badge_bg: badge, height: "regular" },
});

export const PRESETS: StylePreset[] = [
  preset("coral", { ar: "مرجاني", en: "Coral" }, ["#ff6555", "#c2366f"], "#ffffff", "#ffe14d", "#1a1033"),
  preset("sunset", { ar: "غروب", en: "Sunset" }, ["#ff6555", "#c2366f", "#7b2ff7"], "#ffffff", "#ffe14d", "#1a1033"),
  preset("ink", { ar: "حبري", en: "Ink" }, ["#17161b"], "#ffffff", "#ff6555", "#ff6555", "solid"),
  preset("sale", { ar: "تخفيضات", en: "Sale" }, ["#ffe14d", "#ffb020"], "#17161b", "#c2002f", "#17161b"),
  preset("premium", { ar: "مميز", en: "Premium" }, ["#1a1033", "#4b1f8f"], "#ffffff", "#ffd36b", "#ff6555"),
  preset("fresh", { ar: "منعش", en: "Fresh" }, ["#0f766e", "#14b8a6"], "#ffffff", "#fef08a", "#042f2e"),
];

export function cssBackground(style: Pick<AnnouncementStyle, "bg">, override?: string[] | null): string {
  const colors = override?.length ? override : style.bg.colors;
  if (style.bg.type === "solid" || colors.length < 2) return colors[0] ?? "#ff6555";
  return `linear-gradient(${style.bg.angle ?? 90}deg, ${colors.join(", ")})`;
}

function luminance(hex: string): number {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
  const channel = (i: number) => {
    const s = Number.parseInt(full.slice(i, i + 2), 16) / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

/** WCAG contrast ratio; the admin warns below 4.5 (the API returns the same warning). */
export function contrast(a: string, b: string): number {
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(a) || !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(b)) return 21;
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return Math.round(((l1 + 0.05) / (l2 + 0.05)) * 100) / 100;
}

// ---------------------------------------------------------------- dates

/** API naive-UTC ISO → `datetime-local` value in the admin's timezone. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

/** `datetime-local` value → ISO UTC (or null when empty). */
export function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

// ---------------------------------------------------------------- preview payload

type PublicCoupon = {
  code: string;
  kind: string;
  value: number;
  currency_code: string;
  max_discount_minor: null;
  ends_at: string | null;
  product_ids: string[];
  product_types: string[];
  category_scoped: boolean;
};

export type CouponLike = { code: string; kind: string; value: number | string; currency_code: string; ends_at?: string | null };

function publicCoupon(coupon: CouponLike | null | undefined): PublicCoupon | null {
  if (!coupon) return null;
  return {
    code: coupon.code,
    kind: coupon.kind,
    value: Number(coupon.value),
    currency_code: coupon.currency_code,
    max_discount_minor: null,
    ends_at: coupon.ends_at ?? null,
    product_ids: [],
    product_types: [],
    category_scoped: false,
  };
}

export type ItemDraft = AnnouncementItemInput & { item_id?: string };

export type PreviewRefs = {
  coupon?: CouponLike | null;
  product?: { product_id: string; product_type?: string | null; slug?: string | null; title?: string | null } | null;
  plan?: { plan_id: string; product_id?: string | null; slug?: string | null; title?: string | null } | null;
};

/** One item in the storefront's public shape (Arabic copy, which is what the storefront shows). */
export function previewItem(item: ItemDraft, refs: PreviewRefs, id: string) {
  const action = item.action_type ?? "none";
  let target: Record<string, unknown> | null = null;
  if (refs.product && (action === "product" || action === "apply_coupon_go")) {
    target = { kind: "product", product_id: refs.product.product_id, product_type: refs.product.product_type, slug: refs.product.slug, title: refs.product.title };
  } else if (refs.plan && (action === "subscription_plan" || action === "apply_coupon_go")) {
    target = { kind: "plan", slug: refs.plan.slug, title: refs.plan.title };
  } else if (item.target_url && (action === "link" || action === "apply_coupon_go")) {
    target = { kind: "url", href: item.target_url };
  }
  return {
    id,
    kind: item.kind ?? "info",
    icon: item.icon ?? null,
    badge: item.badge_ar || null,
    text: item.text_ar || "…",
    highlight: item.highlight_ar || null,
    countdown_to: item.countdown_to ?? null,
    action,
    action_label: item.action_label_ar || null,
    coupon: publicCoupon(refs.coupon),
    target,
    style_override: item.style_override ?? null,
  };
}

export function refsOf(item: AnnouncementItemAdmin): PreviewRefs {
  return {
    coupon: item.coupon ?? null,
    product: item.product ?? null,
    plan: item.plan ?? null,
  };
}

export function itemDraft(item?: AnnouncementItemAdmin | null): ItemDraft {
  if (!item) {
    return { kind: "discount", icon: "percent", text_ar: "", action_type: "copy_coupon", is_active: true };
  }
  return {
    item_id: item.item_id,
    kind: item.kind,
    icon: item.icon,
    is_active: item.is_active,
    badge_ar: item.badge_ar,
    badge_en: item.badge_en,
    text_ar: item.text_ar,
    text_en: item.text_en,
    highlight_ar: item.highlight_ar,
    highlight_en: item.highlight_en,
    countdown_to: item.countdown_to,
    coupon_id: item.coupon_id,
    action_type: item.action_type,
    action_label_ar: item.action_label_ar,
    action_label_en: item.action_label_en,
    target_url: item.target_url,
    product_id: item.product_id,
    plan_id: item.plan_id,
    style_override: item.style_override,
  };
}

/** "خصم 30%" from a coupon, offered as the item's highlight when a coupon is picked. */
export function couponHighlightAr(coupon: Pick<Coupon, "kind" | "value" | "currency_code">): string {
  return coupon.kind === "percent" ? `خصم ${Number(coupon.value)}%` : `خصم ${Number(coupon.value)} ${coupon.currency_code === "USD" ? "$" : coupon.currency_code}`;
}
