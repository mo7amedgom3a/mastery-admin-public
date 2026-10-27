import { useMemo } from "react";
import { AppLink } from "@/components/ui/app-link";
import { Icon } from "@/components/ui/icon";
import { formatAmount, formatDateTime, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { studioHref } from "@/lib/refs";
import { productTypeLabel } from "@/lib/product-types";
import type { CurriculumUnit, PackageCourse, ProductSalesSeries, ProductView } from "@/lib/api";
import { longDur, flattenLessons } from "../model";

export interface DetailHeaderProps {
  productRef: string;
  data: ProductView;
  units: CurriculumUnit[];
  packageCourses?: PackageCourse[];
  sales?: ProductSalesSeries;
  onTogglePublish: () => void;
  isPublishing?: boolean;
  /** Soft delete (B2C products only); omitted when the product can't be deleted. */
  onDelete?: () => void;
  onRestore?: () => void;
  isRestoring?: boolean;
}

export function DetailHeader({
  productRef,
  data,
  units,
  packageCourses,
  sales,
  onTogglePublish,
  isPublishing,
  onDelete,
  onRestore,
  isRestoring,
}: DetailHeaderProps) {
  const t = useT();
  const item = data.product;
  const published = item.status === "published";
  const deleted = item.status === "deleted";
  const b2c = data.b2c;
  const isPackage = item.product_type === "package";

  const allLessons = useMemo(() => flattenLessons(units), [units]);
  const totalSec = useMemo(
    () => allLessons.reduce((acc, l) => acc + (l.duration || 0), 0),
    [allLessons]
  );
  const courses = useMemo(() => packageCourses ?? [], [packageCourses]);
  // A package has no units/lessons of its own; its curriculum is the courses it bundles, and its
  // duration is the sum of theirs.
  const packageDuration = useMemo(
    () => courses.reduce((acc, course) => acc + (course.duration || 0), 0),
    [courses]
  );

  const priceValue = item.price ?? 0;
  const currency = item.price_currency ?? "USD";
  const audience = "B2C";
  const category = item.category || t("غير مصنف", "Uncategorized");
  const kindLabel = (() => {
    const label = productTypeLabel(item.product_type);
    return t(label.ar, label.en);
  })();

  // Determine external catalog URL if available
  const catalogHref = b2c ? `/learning/catalog` : undefined;

  return (
    <section className="cd-head">
      <AppLink className="cd-crumb" to="/learning/catalog">
        <span>{t("الكتالوج", "Catalog")}</span>
        <span className="cd-flip">
          <Icon name="arrowBack" className="cd-ic--sm" />
        </span>
      </AppLink>

      <div className="cd-head__row">
        <div className="cd-title">
          <div className="cd-title__line">
            <h1>{item.title || item.slug || productRef}</h1>
            <span className={`cd-chip ${deleted ? "cd-chip--danger" : published ? "cd-chip--ok" : "cd-chip--off"}`}>
              {deleted ? t("محذوف", "Deleted") : published ? t("منشور", "Published") : t("مسودة", "Draft")}
            </span>
            <span className="cd-chip cd-chip--b2c">{audience}</span>
          </div>
          <p className="cd-title__sub">
            {category} · {kindLabel}
          </p>
        </div>

        <div className="cd-actions">
          {catalogHref && (
            <AppLink className="ma-btn ma-btn--soft" to={catalogHref}>
              <Icon name="link" className="cd-ic--sm" />
              <span>{t("فتح في الكتالوج", "Open in catalog")}</span>
            </AppLink>
          )}
          <AppLink className="ma-btn ma-btn--secondary" to={studioHref(productRef)}>
            <Icon name="edit" className="cd-ic--sm" />
            <span>{t("فتح الاستوديو", "Open studio")}</span>
          </AppLink>
          {deleted ? (
            onRestore ? (
              <button type="button" className="ma-btn ma-btn--primary" disabled={isRestoring} onClick={onRestore}>
                <Icon name="refresh" className="cd-ic--sm" />
                <span>{isRestoring ? t("جارٍ الاستعادة…", "Restoring…") : t("استعادة", "Restore")}</span>
              </button>
            ) : null
          ) : (
            <>
              <button
                type="button"
                className={`ma-btn ${published ? "ma-btn--danger-soft" : "ma-btn--primary"}`}
                disabled={isPublishing}
                onClick={onTogglePublish}
              >
                <Icon name={published ? "x" : "check"} className="cd-ic--sm" />
                <span>{published ? t("إلغاء النشر", "Unpublish") : t("نشر", "Publish")}</span>
              </button>
              {onDelete ? (
                <button type="button" className="ma-btn ma-btn--danger-soft" onClick={onDelete}>
                  <Icon name="trash" className="cd-ic--sm" />
                  <span>{t("حذف", "Delete")}</span>
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>

      {deleted ? (
        <div className="ma-alert ma-alert--danger" role="status" style={{ marginBlock: "var(--space-3)" }}>
          <strong>{t("هذا المنتج محذوف", "This product is deleted")}</strong>
          <span>
            {" "}
            {t(
              "لا يظهر في المتجر أو البحث، وتبقى الطلبات والوصول والمحتوى محفوظة. يمكنك استعادته في أي وقت.",
              "It is hidden from the store and search; orders, access and content are kept. You can restore it at any time.",
            )}
          </span>
          <span className="ma-help" style={{ display: "block", marginBlockStart: 4 }}>
            {[
              item.deleted_at ? `${t("حُذف في", "Deleted")} ${formatDateTime(item.deleted_at)}` : null,
              data.b2c?.deleted_by ? `${t("بواسطة", "by")} ${data.b2c.deleted_by}` : null,
              item.deleted_reason ? `${t("السبب", "Reason")}: ${item.deleted_reason}` : null,
              data.b2c?.status_before_delete
                ? `${t("يعود إلى", "Restores to")}: ${data.b2c.status_before_delete}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </div>
      ) : null}

      <div className="cd-kpis" role="list">
        {/* KPI 1: Price */}
        <div className="cd-kpi" role="listitem">
          <span className="cd-kpi__l">
            <Icon name="tag" className="cd-ic--sm" />
            {t("السعر", "Price")}
          </span>
          <span className="cd-kpi__v">
            {priceValue > 0 ? formatAmount(priceValue, currency) : "$0.00"}
          </span>
          <span className="cd-kpi__m">
            {priceValue === 0 ? (
              <span className="cd-chip cd-chip--warn cd-chip--plain" style={{ height: 20, fontSize: 11, padding: "0 6px" }}>
                {t("مجانية", "Free")}
              </span>
            ) : item.compare_at_price ? (
              `${t("المقارنة", "Compare")}: ${formatAmount(item.compare_at_price, currency)}`
            ) : (
              "—"
            )}
          </span>
        </div>

        {/* KPI 2: Students & Orders */}
        <div className="cd-kpi" role="listitem">
          <span className="cd-kpi__l">
            <Icon name="users" className="cd-ic--sm" />
            {t("الطلاب والطلبات", "Students & Orders")}
          </span>
          <span className="cd-kpi__v">
            {sales ? formatNumber(sales.total_students) : "—"}
          </span>
          <span className="cd-kpi__m">
            {sales ? (
              <>
                <span className="cd-num">{sales.total_paid_orders}</span> {t("طلبات مدفوعة", "paid orders")}
              </>
            ) : (
              t("طالب مسجل", "enrolled students")
            )}
          </span>
        </div>

        {/* KPI 3: Curriculum counts (a package's curriculum is its courses) */}
        <div className="cd-kpi" role="listitem">
          <span className="cd-kpi__l">
            <Icon name="layers" className="cd-ic--sm" />
            {isPackage ? t("الدورات", "Courses") : t("المنهج", "Curriculum")}
          </span>
          <span className="cd-kpi__v">
            {isPackage ? formatNumber(courses.length) : `${units.length} / ${allLessons.length}`}
          </span>
          <span className="cd-kpi__m">
            {isPackage ? t("دورة داخل الحزمة", "courses in the package") : `${t("أقسام", "sections")} / ${t("دروس", "lessons")}`}
          </span>
        </div>

        {/* KPI 4: Duration */}
        <div className="cd-kpi" role="listitem">
          <span className="cd-kpi__l">
            <Icon name="clock" className="cd-ic--sm" />
            {t("المدة الكلية", "Total duration")}
          </span>
          <span className="cd-kpi__v">{longDur(isPackage ? packageDuration : totalSec, t("ar", "en") === "ar")}</span>
          <span className="cd-kpi__m">
            {isPackage
              ? `${courses.length} ${t("دورة", "courses")}`
              : `${allLessons.length} ${t("درساً", "lessons")}`}
          </span>
        </div>

        {/* KPI 5: Dates */}
        <div className="cd-kpi" role="listitem">
          <span className="cd-kpi__l">
            <Icon name="calendar" className="cd-ic--sm" />
            {t("آخر تحديث", "Last updated")}
          </span>
          <span className="cd-kpi__v" style={{ fontSize: 18 }}>
            {item.updated_at ? formatDateTime(item.updated_at) : "—"}
          </span>
          <span className="cd-kpi__m">
            {item.updated_at ? `${t("محدث", "Updated")} ${formatDateTime(item.updated_at)}` : "—"}
          </span>
        </div>
      </div>
    </section>
  );
}
