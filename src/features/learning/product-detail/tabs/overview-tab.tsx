import { useMemo, useState } from "react";
import { AppLink } from "@/components/ui/app-link";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Icon } from "@/components/ui/icon";
import { SelectField } from "@/components/ui/select";
import { formatAmount, formatDateTime, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { productTypeLabel } from "@/lib/product-types";
import { productHref, studioHref } from "@/lib/refs";
import type { CurriculumUnit, PackageCourse, ProductPrice, ProductView, SearchProductDetail } from "@/lib/api";
import { detectQualityIssues, longDur, flattenLessons } from "../model";
import { ProductStatsPanels } from "../components/product-stats-panels";

interface OverviewTabProps {
  productRef: string;
  data: ProductView;
  searchDetail?: SearchProductDetail | null;
  units: CurriculumUnit[];
  packageCourses?: PackageCourse[];
  onGoToContent?: () => void;
  onSelectLesson?: (lessonId: number) => void;
}

export function OverviewTab({
  productRef,
  data,
  searchDetail: _searchDetail,
  units,
  packageCourses,
  onGoToContent,
  onSelectLesson,
}: OverviewTabProps) {
  const t = useT();
  const item = data.product;
  const b2c = data.b2c;
  const isAr = t("ar", "en") === "ar";
  const isPackage = item.product_type === "package";

  const allLessons = useMemo(() => flattenLessons(units), [units]);
  const issues = useMemo(
    () => detectQualityIssues(data, units, allLessons, t),
    [data, units, allLessons, t]
  );

  const courses = useMemo(() => packageCourses ?? [], [packageCourses]);
  const packageDuration = useMemo(
    () => courses.reduce((acc, course) => acc + (course.duration || 0), 0),
    [courses]
  );

  // Maximum section duration for relative percentage bar fills
  const maxUnitDuration = useMemo(() => {
    if (!units.length) return 1;
    const durations = units.map((u) =>
      (u.lessons || []).reduce((acc, l) => acc + (l.duration || 0), 0)
    );
    return Math.max(...durations, 1);
  }, [units]);

  const prices = b2c?.prices || [];
  // The package/course artwork. Legacy packages carry it on the legacy detail; B2C products on the item.
  const artwork = data.legacy?.product.image ?? data.product.image ?? null;

  return (
    <div className="cd-bento">
      {/* Product details */}
      <section className="cd-card cd-s6">
        <div className="cd-card__h">
          <h2>
            <Icon name="info" className="cd-ic--sm" />
            {t("تفاصيل المنتج", "Product details")}
          </h2>
          <AppLink
            className="ma-btn ma-btn--sm ma-btn--soft"
            to={studioHref(productRef)}
          >
            <Icon name="edit" className="cd-ic--sm" />
            <span>{t("تعديل في الاستوديو", "Edit in studio")}</span>
          </AppLink>
        </div>
        <div className="cd-card__b">
          {artwork ? (
            <div className="cd-media" style={{ marginBlockEnd: 16 }}>
              <img className="cd-media__img" src={artwork} alt={item.title ?? ""} />
            </div>
          ) : null}
          <dl className="cd-dl">
            <div>
              <dt>{t("النوع", "Type")}</dt>
              <dd>
                {(() => {
                  const label = productTypeLabel(item.product_type);
                  return t(label.ar, label.en);
                })()}
              </dd>
            </div>
            <div>
              <dt>{t("المُعرّف", "ID")}</dt>
              <dd className="cd-ltr">{item.slug || item.product_id || String(item.legacy_id || "")}</dd>
            </div>
            {isPackage ? (
              <div>
                <dt>{t("عدد الدورات", "Courses")}</dt>
                <dd>
                  <span className="cd-num">{courses.length}</span> {t("دورة", "courses")}
                  {packageDuration > 0 ? ` · ${longDur(packageDuration, isAr)}` : ""}
                </dd>
              </div>
            ) : null}
            {isPackage ? (
              <div>
                <dt>{t("الوصف", "Description")}</dt>
                <dd>
                  {(data.legacy?.description || data.b2c?.short_description) ? (
                    <span className="cd-richtext" style={{ fontSize: 14 }}>
                      {plain(data.legacy?.description || data.b2c?.short_description || "")}
                    </span>
                  ) : (
                    <span className="cd-unset">{t("لا يوجد وصف", "No description")}</span>
                  )}
                </dd>
              </div>
            ) : null}
            <div>
              <dt>{t("المدرّب", "Instructor")}</dt>
              <dd>{item.instructor || "—"}</dd>
            </div>
            <div>
              <dt>{t("السعر", "Price")}</dt>
              <dd>
                {item.price != null && item.price > 0 ? (
                  formatAmount(item.price, item.price_currency ?? "USD")
                ) : (
                  <span className="cd-chip cd-chip--warn cd-chip--plain" style={{ height: 22, fontSize: 12 }}>
                    {t("مجانية", "Free")}
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt>{t("سعر المقارنة", "Compare-at price")}</dt>
              <dd>
                {item.compare_at_price != null ? (
                  formatAmount(item.compare_at_price, item.price_currency ?? "USD")
                ) : (
                  <span className="cd-unset">{t("غير محدد", "Not set")}</span>
                )}
              </dd>
            </div>
            <div>
              <dt>{t("الطلبات المدفوعة", "Paid orders")}</dt>
              <dd>{formatNumber(item.paid_orders || 0)}</dd>
            </div>
            <div>
              <dt>{t("تاريخ الإنشاء", "Created at")}</dt>
              <dd>{item.created_at ? formatDateTime(item.created_at) : "—"}</dd>
            </div>
            <div>
              <dt>{t("آخر تحديث", "Last updated")}</dt>
              <dd>{item.updated_at ? formatDateTime(item.updated_at) : "—"}</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Access and Categories */}
      <section className="cd-card cd-s6">
        <div className="cd-card__h">
          <h2>
            <Icon name="settings" className="cd-ic--sm" />
            {t("الوصول والتصنيفات", "Access & categories")}
          </h2>
        </div>
        <div className="cd-card__b">
          <dl className="cd-dl">
            <div>
              <dt>{t("الوصف القصير", "Short description")}</dt>
              <dd>
                {b2c?.short_description ? (
                  b2c.short_description
                ) : (
                  <>
                    <span className="cd-unset">{t("غير محدد", "Not set")}</span>
                    <AppLink className="cd-link" to={studioHref(productRef)}>
                      {t("إضافة", "Add")}
                    </AppLink>
                  </>
                )}
              </dd>
            </div>
            <div>
              <dt>{t("أيام الوصول المتاحة", "Access days")}</dt>
              <dd>
                {b2c?.access_duration_days ? (
                  `${b2c.access_duration_days} ${t("يوم", "days")}`
                ) : (
                  <span className="cd-unset">{t("غير محدود", "Lifetime / Unlimited")}</span>
                )}
              </dd>
            </div>
            <div>
              <dt>{t("تمديد الوصول", "Access extension")}</dt>
              <dd>
                {b2c?.extension_enabled
                  ? t("متاح للمشتركين", "Enabled")
                  : t("غير مفعّل", "Disabled")}
              </dd>
            </div>
            <div>
              <dt>{t("المجالات والتصنيفات", "Fields & categories")}</dt>
              <dd>
                <ChipRow
                  items={b2c?.categories?.length ? b2c.categories : item.category ? [item.category] : []}
                  empty={t("غير مصنف", "Uncategorized")}
                />
              </dd>
            </div>
            {b2c ? (
              <>
                <div>
                  <dt>{t("المهارات", "Skills")}</dt>
                  <dd>
                    <ChipRow items={(b2c.skills ?? []).map((skill) => skill.name)} empty={t("لا مهارات", "No skills")} />
                  </dd>
                </div>
                <div>
                  <dt>{t("الوسوم", "Tags")}</dt>
                  <dd>
                    <ChipRow items={b2c.admin_tags ?? []} empty={t("لا وسوم", "No tags")} />
                  </dd>
                </div>
              </>
            ) : null}
          </dl>
        </div>
      </section>

      {/* Behaviour, orders, sales and transaction charts */}
      <div className="cd-s12" style={{ gridColumn: "1 / -1" }}>
        <ProductStatsPanels productRef={productRef} />
      </div>

      {/* Timeline */}
      <section className="cd-card cd-s5">
        <div className="cd-card__h">
          <h2>
            <Icon name="clock" className="cd-ic--sm" />
            {t("الجدول الزمني", "Timeline")}
          </h2>
        </div>
        <div className="cd-card__b">
          <ul className="cd-tl">
            <li>
              <span className="cd-tl__dot" style={{ "--c": "var(--sky)" } as React.CSSProperties} />
              <div>
                {t("تم إنشاء المنتج", "Product created")}
                <small>{item.updated_at ? formatDateTime(item.updated_at) : "—"}</small>
              </div>
            </li>
            <li>
              <span className="cd-tl__dot" style={{ "--c": "var(--yellow)" } as React.CSSProperties} />
              <div>
                {t("آخر تحديث لبيانات المنتج", "Last content update")}
                <small>{item.updated_at ? formatDateTime(item.updated_at) : "—"}</small>
              </div>
            </li>
            <li>
              <span
                className="cd-tl__dot"
                style={{
                  "--c": item.status === "published" ? "var(--green)" : "var(--pink)",
                } as React.CSSProperties}
              />
              <div>
                {item.status === "published"
                  ? t("منشور في الكتالوج العام", "Published in catalog")
                  : t("مسودة داخلية", "Saved as draft")}
                <small>B2C</small>
              </div>
            </li>
          </ul>
        </div>
      </section>

      {/* Curriculum summary bars */}
      <section className="cd-card cd-s7">
        <div className="cd-card__h">
          <h2>
            <Icon name="layers" className="cd-ic--sm" />
            {t("ملخص المنهج الدراسي", "Curriculum summary")}
          </h2>
          {onGoToContent && (
            <button
              type="button"
              className="cd-link"
              onClick={onGoToContent}
            >
              {t("عرض المحتوى الكامل", "View all content")}
            </button>
          )}
        </div>
        <div className="cd-card__b">
          {isPackage ? (
            courses.length ? (
              <div className="cd-bars">
                {courses.map((course) => {
                  const dur = course.duration || 0;
                  const pct = Math.round((dur / Math.max(packageDuration, 1)) * 100);
                  return (
                    <div key={course.product_id ?? course.course_ref} className="cd-bar">
                      <span className="cd-bar__t">
                        <AppLink className="cd-link" to={productHref(course.course_ref)}>
                          {course.title ?? course.course_ref}
                        </AppLink>
                      </span>
                      <span className="cd-bar__track">
                        <span className="cd-bar__fill" style={{ width: `${pct}%` }} />
                      </span>
                      <span className="cd-bar__v">
                        {dur > 0 ? longDur(dur, isAr) : "—"}
                        {course.required ? "" : ` · ${t("اختيارية", "optional")}`}
                      </span>
                    </div>
                  );
                })}
                <div className="cd-muted" style={{ marginBlockStart: 10, fontSize: 13 }}>
                  {t("إجمالي المدة", "Total duration")}: <b className="cd-num">{longDur(packageDuration, isAr)}</b>
                </div>
              </div>
            ) : (
              <div className="cd-empty">
                <Icon name="layers" />
                <strong>{t("لا دورات في الحزمة بعد", "No courses in this package yet")}</strong>
                <span>{t("أضف دورات من تبويب الحزمة.", "Add courses from the Package tab.")}</span>
              </div>
            )
          ) : !units.length ? (
            <div className="cd-empty">
              <Icon name="layers" />
              <strong>{t("لا توجد وحدات أو دروس بعد", "No sections or lessons yet")}</strong>
              <span>{t("أضف وحدات ودروس عبر تبويب المحتوى أو الاستوديو", "Add sections and lessons via Content tab or Studio")}</span>
            </div>
          ) : (
            <div className="cd-bars">
              {units.map((unit) => {
                const uDur = (unit.lessons || []).reduce(
                  (sum, l) => sum + (l.duration || 0),
                  0
                );
                const pct = Math.round((uDur / maxUnitDuration) * 100);
                return (
                  <div key={unit.id} className="cd-bar">
                    <span className="cd-bar__t">{unit.name}</span>
                    <span className="cd-bar__track">
                      <span className="cd-bar__fill" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="cd-bar__v">
                      {unit.lessons?.length || 0} {t("دروس", "lessons")} · {longDur(uDur, isAr)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Quality review */}
      <section className="cd-card cd-s5">
        <div className="cd-card__h">
          <h2>
            <Icon name="alert" className="cd-ic--sm" />
            {t("فحص الجودة", "Quality review")}
          </h2>
          <span
            className={`cd-chip cd-num ${
              issues.length ? "cd-chip--warn" : "cd-chip--ok"
            } cd-chip--plain`}
          >
            {issues.length}
          </span>
        </div>
        <div className="cd-card__b">
          {issues.length === 0 ? (
            <div className="cd-issue cd-issue--ok">
              <span className="cd-issue__ic">
                <Icon name="check" className="cd-ic--sm" />
              </span>
              <div className="cd-issue__t">
                {t("جميع المعايير ممتازة! لا توجد ملاحظات.", "All good! No quality issues detected.")}
              </div>
            </div>
          ) : (
            issues.slice(0, 5).map((iss, idx) => (
              <div
                key={idx}
                className={`cd-issue ${iss.severity === "bad" ? "cd-issue--bad" : ""}`}
              >
                <span className="cd-issue__ic">
                  <Icon name={iss.icon} className="cd-ic--sm" />
                </span>
                <div className="cd-issue__t">
                  {iss.title}
                  {iss.subtitle && <small>{iss.subtitle}</small>}
                </div>
                {iss.lessonId ? (
                  <button
                    type="button"
                    className="ma-btn ma-btn--sm ma-btn--soft"
                    onClick={() => {
                      if (onSelectLesson) onSelectLesson(iss.lessonId!);
                      if (onGoToContent) onGoToContent();
                    }}
                  >
                    {t("مراجعة", "Review")}
                  </button>
                ) : (
                  <AppLink
                    className="ma-btn ma-btn--sm ma-btn--soft"
                    to={studioHref(productRef)}
                  >
                    {t("مراجعة", "Review")}
                  </AppLink>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      {/* Prices */}
      <section className="cd-card cd-s7">
        <div className="cd-card__h">
          <h2>
            <Icon name="tag" className="cd-ic--sm" />
            {t("الأسعار", "Prices")}
          </h2>
        </div>
        <div className="cd-card__b">
          <PricesList prices={prices} />
        </div>
      </section>
    </div>
  );
}

/** Legacy descriptions are HTML; show a readable single line. */
function plain(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function PricesList({ prices }: { prices: ProductPrice[] }) {
  const t = useT();
  const [currencyFilter, setCurrencyFilter] = useState("all");

  const currencies = useMemo(
    () => Array.from(new Set(prices.map((p) => p.currency))).filter(Boolean),
    [prices]
  );

  const filtered = useMemo(() => {
    if (currencyFilter === "all") return prices;
    return prices.filter((p) => p.currency === currencyFilter);
  }, [prices, currencyFilter]);

  const columns: Column<ProductPrice>[] = [
    { key: "currency", header: t("العملة", "Currency"), cell: (r) => r.currency },
    { key: "country", header: t("الدولة", "Country"), cell: (r) => r.country_code || "—" },
    {
      key: "amount",
      header: t("السعر", "Amount"),
      align: "end",
      cell: (r) => <span className="cd-num">{formatAmount(r.amount, r.currency)}</span>,
    },
    {
      key: "compare",
      header: t("سعر المقارنة", "Compare at"),
      align: "end",
      cell: (r) =>
        r.compare_at_amount != null ? (
          <span className="cd-num">{formatAmount(r.compare_at_amount, r.currency)}</span>
        ) : (
          "—"
        ),
    },
    { key: "from", header: t("صالح من", "Valid from"), cell: (r) => formatDateTime(r.valid_from) },
  ];

  if (!prices.length) {
    return (
      <div className="cd-empty">
        <Icon name="tag" />
        <strong>{t("لا توجد خطط أسعار إضافية", "No additional price plans")}</strong>
        <span>{t("تعتمد الدورة على السعر الأساسي المعين أعلاه.", "Course relies on base price specified above.")}</span>
      </div>
    );
  }

  return (
    <div>
      {currencies.length > 1 && (
        <div style={{ marginBlockEnd: 12 }}>
          <SelectField
            label={t("العملة", "Currency")}
            value={currencyFilter}
            onChange={setCurrencyFilter}
            options={[
              { value: "all", label: t("كل العملات", "All currencies") },
              ...currencies.map((c) => ({ value: c, label: c })),
            ]}
          />
        </div>
      )}
      <DataTable rows={filtered} columns={columns} empty={t("لا أسعار مطابقة.", "No matching prices.")} />
    </div>
  );
}

function ChipRow({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <span className="cd-unset">{empty}</span>;
  return (
    <span className="ma-chips">
      {items.map((label) => (
        <span key={label} className="ma-tag ma-tag--soft">
          {label}
        </span>
      ))}
    </span>
  );
}
