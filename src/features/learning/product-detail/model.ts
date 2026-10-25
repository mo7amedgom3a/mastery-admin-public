import type { CurriculumUnit, ProductView } from "@/lib/api";

export interface FlatLesson {
  id: number;
  unitId: number;
  unitName: string;
  name: string;
  duration: number; // in seconds
  isFree: boolean;
  link: string | null;
  fileId: number | null;
  assetUrl: string | null;
  order: number;
}

export function dur(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const x = s % 60;
  return `${m}:${String(x).padStart(2, "0")}`;
}

export function longDur(sec: number, isAr: boolean = true): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (isAr) {
    return (h ? `${h} س ` : "") + `${m} د`;
  }
  return (h ? `${h}h ` : "") + `${m}m`;
}

export function cleanHtmlText(raw: string | null | undefined): string {
  if (!raw) return "";
  try {
    const doc = new DOMParser().parseFromString(raw, "text/html");
    return doc.body.textContent?.trim() || "";
  } catch {
    return raw.replace(/<[^>]*>/g, "").trim();
  }
}

export function flattenLessons(units: CurriculumUnit[]): FlatLesson[] {
  const out: FlatLesson[] = [];
  for (const u of units) {
    for (const l of u.lessons) {
      out.push({
        id: l.id,
        unitId: u.id,
        unitName: u.name,
        name: l.name,
        duration: Math.round(Number(l.duration || 0)),
        isFree: Boolean(l.is_free),
        link: l.link ?? null,
        fileId: l.file_id ?? null,
        assetUrl: l.asset_url ?? null,
        order: l.order ?? 0,
      });
    }
  }
  return out;
}

export interface QualityIssue {
  severity: "warn" | "bad";
  icon: string;
  title: string;
  subtitle?: string;
  lessonId?: number;
}

export function detectQualityIssues(
  product: ProductView,
  units: CurriculumUnit[],
  allLessons: FlatLesson[],
  t: (ar: string, en: string) => string
): QualityIssue[] {
  const issues: QualityIssue[] = [];

  // Check price = 0 but paid orders > 0
  const paidOrders = product.product.paid_orders || 0;
  const price = product.product.price ?? 0;
  if (price === 0 && paidOrders > 0) {
    issues.push({
      severity: "bad",
      icon: "tag",
      title: t("السعر $0.00 رغم وجود طلبات مدفوعة", "Price is $0.00 despite paid orders"),
      subtitle: t(`تم تسجيل ${paidOrders} طلبات`, `${paidOrders} paid orders recorded`),
    });
  }

  // Check short description
  const b2c = product.b2c;
  if (!b2c?.short_description) {
    issues.push({
      severity: "warn",
      icon: "info",
      title: t("الوصف المختصر فارغ", "Short description is empty"),
      subtitle: t("أضف وصفاً تسويقياً موجزاً للدورة", "Add a concise marketing summary"),
    });
  }

  // Check lesson duplicates and test titles
  const seenTitles = new Map<string, FlatLesson[]>();
  for (const l of allLessons) {
    const key = `${l.name.trim().toLowerCase()}__${l.duration}`;
    const list = seenTitles.get(key) || [];
    list.push(l);
    seenTitles.set(key, list);
  }

  for (const list of seenTitles.values()) {
    if (list.length > 1) {
      for (const l of list.slice(1)) {
        issues.push({
          severity: "warn",
          icon: "layers",
          title: t("درس مكرر في المنهج", "Duplicate lesson"),
          subtitle: l.name,
          lessonId: l.id,
        });
      }
    }
  }

  for (const l of allLessons) {
    // English words with 5+ letters mixed with Arabic, or obvious test patterns
    if (/\b[a-z]{5,}\b/i.test(l.name) && /[\u0600-\u06FF]/.test(l.name)) {
      issues.push({
        severity: "warn",
        icon: "alert",
        title: t("عنوان يبدو تجريبياً", "Title looks like test text"),
        subtitle: l.name,
        lessonId: l.id,
      });
    }
  }

  return issues;
}

export interface CompletenessItem {
  label: string;
  complete: boolean;
  actionTab?: string;
}

export function computeCompleteness(
  product: ProductView,
  units: CurriculumUnit[],
  instructorsCount: number,
  t: (ar: string, en: string) => string
): { items: CompletenessItem[]; pct: number } {
  const p = product.product;
  const b2c = product.b2c;
  const legacy = product.legacy;
  const hasDesc = Boolean(cleanHtmlText(b2c?.short_description || legacy?.description));
  const hasCover = Boolean(p.image || p.square_image);
  const hasInstructors = instructorsCount > 0 || Boolean(p.instructor);
  const allLessons = flattenLessons(units);
  const hasCurriculum = allLessons.length > 0;
  const hasPrice = (p.price != null && p.price > 0) || (b2c?.prices && b2c.prices.length > 0);
  const hasShortDesc = Boolean(b2c?.short_description);
  const hasAccess = Boolean(b2c?.access_duration_days);

  const items: CompletenessItem[] = [
    { label: t("وصف الدورة", "Description"), complete: hasDesc, actionTab: "resources" },
    { label: t("صورة الغلاف", "Cover image"), complete: hasCover, actionTab: "resources" },
    { label: t("مدرب واحد على الأقل", "At least one instructor"), complete: hasInstructors, actionTab: "instructors" },
    { label: t("منهج بدروس", "Curriculum with lessons"), complete: hasCurriculum, actionTab: "content" },
    { label: t("سعر محدد", "Price set"), complete: Boolean(hasPrice), actionTab: "overview" },
    { label: t("وصف مختصر", "Short description"), complete: hasShortDesc, actionTab: "overview" },
    { label: t("مدة الوصول", "Access duration"), complete: hasAccess, actionTab: "overview" },
  ];

  const done = items.filter((i) => i.complete).length;
  const pct = Math.round((done / items.length) * 100);

  return { items, pct };
}
