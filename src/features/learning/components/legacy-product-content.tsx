import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  productQueries,
  type CatalogKind,
  type CompletionRule,
  type LegacyPriceRow,
  type PackageCourse,
  type ProductCertificate,
  type ProductLearners,
  type ProductRating,
} from "@/lib/api";
import { formatAmount, formatDateTime, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { initialsOf } from "@/lib/status";
import { orderHref, productHref } from "@/lib/refs";
import { AppLink } from "@/components/ui/app-link";
import { Avatar, Badge, Card, Dl, Empty, ErrorAlert, Loading } from "@/components/ui/kit";
import { DataTable, type Column } from "@/components/ui/data-table";
import { RichHtml } from "@/components/ui/rich-html";
import { SourceBadge } from "@/components/ui/source-badge";
import { CurriculumTab } from "@/features/learning/curriculum";

type TabId = "curriculum" | "units" | "prices" | "instructors" | "certificates" | "rules" | "ratings" | "learners" | "summary" | "courses";


/**
 * The content the legacy platform still owns for a product (curriculum, price rows, instructors,
 * certificates, completion rules, ratings, learners; package summary and courses). Served by
 * `/admin/catalog/products/{ref}/*`, which accepts the B2C ref of a migrated product too.
 */
export function LegacyProductContent({ productRef, kind }: { productRef: string; kind: CatalogKind }) {
  const t = useT();
  const tabs: [TabId, string, string][] = [
    ["curriculum", "الوصف والمنهج", "Curriculum"],
    ...(kind === "course" ? ([["units", "محتوى الدورة (الدروس)", "Units & Lessons"]] as [TabId, string, string][]) : []),
    ["prices", "صفوف الأسعار", "Price rows"],
    ...(kind === "course" ? ([["instructors", "المدربون", "Instructors"]] as [TabId, string, string][]) : []),
    ["certificates", "الشهادات", "Certificates"],
    ["rules", "شروط الإكمال", "Completion"],
    ...(kind === "course" ? ([["ratings", "التقييمات", "Ratings"]] as [TabId, string, string][]) : []),
    ["learners", "المتعلمون", "Learners"],
    ...(kind === "package"
      ? ([["summary", "ملخّص الباقة", "Summary"], ["courses", "دورات الباقة", "Courses"]] as [TabId, string, string][])
      : []),
  ];
  const [tab, setTab] = useState<TabId>(kind === "course" ? "units" : "curriculum");
  return (
    <>
      <div className="ma-pagetabs" role="tablist" aria-label={t("محتوى النظام القديم", "Legacy content")}>
        {tabs.map(([id, ar, en]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
            {t(ar, en)}
          </button>
        ))}
      </div>
      {tab === "curriculum" ? <Curriculum productRef={productRef} /> : null}
      {tab === "units" ? <CurriculumTab productRef={productRef} /> : null}
      {tab === "prices" ? <Prices productRef={productRef} /> : null}
      {tab === "instructors" ? <Instructors productRef={productRef} /> : null}
      {tab === "certificates" ? <Certificates productRef={productRef} /> : null}
      {tab === "rules" ? <Rules productRef={productRef} /> : null}
      {tab === "ratings" ? <Ratings productRef={productRef} /> : null}
      {tab === "learners" ? <Learners productRef={productRef} /> : null}
      {tab === "summary" ? <Summary productRef={productRef} /> : null}
      {tab === "courses" ? <Courses productRef={productRef} /> : null}
    </>
  );
}

function State({ loading, error, children }: { loading: boolean; error: unknown; children: React.ReactNode }) {
  if (loading) return <Loading />;
  if (error) return <ErrorAlert error={error} />;
  return <>{children}</>;
}

function Curriculum({ productRef }: { productRef: string }) {
  const t = useT();
  const query = useQuery(productQueries.curriculum(productRef));
  const sections = (query.data ?? []).filter((row) => row.title || row.body);
  return (
    <State loading={query.isLoading} error={query.error}>
      {sections.length ? (
        <Card title={t("الوصف", "Description")} className="ma-section-gap">
          <div className="ma-stack">
            {sections.map((row) => (
              <section key={row.legacy_section_id}>
                {row.title ? <h3 className="ma-subhead">{row.title}</h3> : null}
                <RichHtml html={row.body ?? null} />
              </section>
            ))}
          </div>
        </Card>
      ) : (
        <Empty text={t("لا وصف.", "No description.")} />
      )}
    </State>
  );
}

function Prices({ productRef }: { productRef: string }) {
  const t = useT();
  const query = useQuery(productQueries.prices(productRef));
  const columns: Column<LegacyPriceRow>[] = [
    { key: "label", header: t("الاسم", "Label"), cell: (row) => row.label ?? "—" },
    { key: "amount", header: t("السعر", "Amount"), align: "end", cell: (row) => <span className="ma-num">{formatNumber(row.amount)}</span> },
    { key: "main", header: t("رئيسي", "Main"), cell: (row) => (row.is_main ? t("نعم", "yes") : "—") },
    { key: "active", header: t("نشط", "Active"), cell: (row) => (row.active ? t("نعم", "yes") : t("لا", "no")) },
    { key: "from", header: t("من", "From"), cell: (row) => formatDateTime(row.starts_at) },
    { key: "to", header: t("إلى", "To"), cell: (row) => formatDateTime(row.ends_at) },
  ];
  return (
    <State loading={query.isLoading} error={query.error}>
      <Card title={t("صفوف الأسعار", "Price rows")} className="ma-section-gap">
        <DataTable rows={query.data ?? []} columns={columns} empty={t("لا أسعار.", "No prices.")} />
      </Card>
    </State>
  );
}

function Instructors({ productRef }: { productRef: string }) {
  const t = useT();
  const query = useQuery(productQueries.instructors(productRef));
  const instructors = query.data ?? [];
  return (
    <State loading={query.isLoading} error={query.error}>
      {instructors.length ? (
        <div className="ma-kpis ma-section-gap">
          {instructors.map((instructor) => (
            <AppLink
              key={instructor.legacy_trainer_id}
              className="ma-link ma-link--plain ma-trainer-card"
              to={`/learning/instructors/${instructor.legacy_trainer_id}`}
            >
              <Avatar initials={initialsOf(instructor.name ?? "")} src={instructor.avatar} color="var(--sky)" alt={instructor.name ?? ""} lg />
              <span className="ma-cell-main">{instructor.name ?? `#${instructor.legacy_trainer_id}`}</span>
              <span className="ma-cell-sub">{instructor.specialization ?? t("عرض الملف", "View profile")}</span>
            </AppLink>
          ))}
        </div>
      ) : (
        <Empty icon="user" text={t("لا مدربين.", "No instructors.")} />
      )}
    </State>
  );
}

function Certificates({ productRef }: { productRef: string }) {
  const t = useT();
  const query = useQuery(productQueries.certificates(productRef));
  const columns: Column<ProductCertificate>[] = [
    { key: "name", header: t("الشهادة", "Certificate"), cell: (row) => row.name ?? `#${row.legacy_certificate_id ?? "—"}` },
    { key: "id", header: t("المعرّف", "ID"), cell: (row) => <span className="ma-num">{row.legacy_certificate_id ?? "—"}</span> },
  ];
  return (
    <State loading={query.isLoading} error={query.error}>
      <Card title={t("الشهادات", "Certificates")} className="ma-section-gap">
        <DataTable rows={query.data ?? []} columns={columns} empty={t("لا شهادات.", "No certificates.")} />
      </Card>
    </State>
  );
}

function Rules({ productRef }: { productRef: string }) {
  const t = useT();
  const query = useQuery(productQueries.rules(productRef));
  const show = (value: unknown) => (value == null || value === "" ? "—" : String(value));
  const columns: Column<CompletionRule>[] = [
    { key: "relation", header: t("العلاقة", "Relation"), cell: (row) => show(row.relation) },
    { key: "condition", header: t("الشرط", "Condition"), cell: (row) => show(row.condition) },
    { key: "fraction", header: t("النسبة", "Fraction"), cell: (row) => show(row.fraction) },
    { key: "minutes", header: t("الدقائق", "Minutes"), cell: (row) => show(row.minutes) },
    {
      key: "course",
      header: t("الدورة", "Course"),
      cell: (row) => (row.course_ref ? <AppLink className="ma-link" to={productHref(row.course_ref)}>{row.course_ref}</AppLink> : "—"),
    },
  ];
  return (
    <State loading={query.isLoading} error={query.error}>
      <Card title={t("شروط الإكمال", "Completion rules")} className="ma-section-gap">
        <DataTable rows={query.data ?? []} columns={columns} empty={t("لا شروط.", "No rules.")} />
      </Card>
    </State>
  );
}

function Ratings({ productRef }: { productRef: string }) {
  const t = useT();
  const query = useQuery(productQueries.ratings(productRef));
  const columns: Column<ProductRating>[] = [
    { key: "rating", header: t("التقييم", "Rating"), cell: (row) => <span className="ma-num">{row.rating ?? "—"}</span> },
    { key: "review", header: t("المراجعة", "Review"), cell: (row) => row.review || "—" },
    { key: "user", header: t("المستخدم", "User"), cell: (row) => (row.legacy_user_id != null ? `#${row.legacy_user_id}` : "—") },
    { key: "date", header: t("التاريخ", "Date"), cell: (row) => formatDateTime(row.created_at) },
  ];
  return (
    <State loading={query.isLoading} error={query.error}>
      <Card title={t("التقييمات", "Ratings")} className="ma-section-gap">
        <DataTable rows={query.data?.items ?? []} columns={columns} empty={t("لا تقييمات.", "No ratings.")} />
      </Card>
    </State>
  );
}

function Learners({ productRef }: { productRef: string }) {
  const t = useT();
  const query = useQuery(productQueries.learners(productRef));
  const data: ProductLearners | undefined = query.data;
  const columns: Column<NonNullable<ProductLearners["learners"]>[number]>[] = [
    { key: "email", header: t("البريد", "Email"), cell: (row) => row.email ?? "—" },
    {
      key: "paid",
      header: t("المدفوع", "Paid"),
      align: "end",
      cell: (row) => (row.is_free ? <Badge def={{ label: { ar: "مجاني", en: "Free" } }} /> : <span className="ma-num">{row.paid != null && data ? formatAmount(row.paid, data.currency) : "—"}</span>),
    },
    { key: "coupon", header: t("الكوبون", "Coupon"), cell: (row) => row.coupon ?? "—" },
    { key: "date", header: t("التاريخ", "Date"), cell: (row) => formatDateTime(row.purchased_at) },
    {
      key: "order",
      header: t("الطلب", "Order"),
      cell: (row) => <AppLink className="ma-link" to={orderHref(row.order_ref)}>{row.order_ref}</AppLink>,
    },
  ];
  return (
    <State loading={query.isLoading} error={query.error}>
      {data ? (
        <>
          <Card title={t("ملخّص", "Summary")}>
            <Dl
              rows={[
                [t("طلبات مدفوعة", "Paid orders"), <span key="o" className="ma-num">{formatNumber(data.orders)}</span>],
                [t("الإيراد", "Revenue"), <span key="r" className="ma-num">{formatAmount(data.revenue, data.currency)}</span>],
              ]}
            />
          </Card>
          <Card title={t("المتعلمون", "Learners")} className="ma-section-gap">
            <DataTable rows={data.learners ?? []} columns={columns} empty={t("لا متعلمين.", "No learners.")} />
          </Card>
        </>
      ) : null}
    </State>
  );
}

function Summary({ productRef }: { productRef: string }) {
  const t = useT();
  const query = useQuery(productQueries.summary(productRef));
  const data = query.data;
  return (
    <State loading={query.isLoading} error={query.error}>
      {data ? (
        <Card title={t("ملخّص الباقة", "Package summary")} className="ma-section-gap">
          <Dl
            rows={[
              [t("الدورات", "Courses"), formatNumber(data.courses)],
              [t("صفوف الأسعار", "Price rows"), formatNumber(data.prices)],
              [t("الشروط", "Rules"), formatNumber(data.rules)],
              [t("الشهادات", "Certificates"), formatNumber(data.certificates)],
              [t("السعر الحالي", "Current price"), data.current_price != null ? formatAmount(data.current_price, data.currency) : "—"],
              [t("السعر الأصلي", "Original price"), data.original_price != null ? formatAmount(data.original_price, data.currency) : "—"],
              [t("طلبات مدفوعة", "Paid orders"), formatNumber(data.orders)],
              [t("الإيراد", "Revenue"), formatAmount(data.revenue, data.currency)],
            ]}
          />
        </Card>
      ) : null}
    </State>
  );
}

function Courses({ productRef }: { productRef: string }) {
  const t = useT();
  const query = useQuery(productQueries.courses(productRef));
  const columns: Column<PackageCourse>[] = [
    {
      key: "title",
      header: t("الدورة", "Course"),
      cell: (row) => (
        <AppLink className="ma-link" to={productHref(row.product_id ? `b2c:${row.product_id}` : row.course_ref)}>
          {row.title ?? row.course_ref}
        </AppLink>
      ),
    },
    { key: "required", header: t("إلزامية", "Required"), cell: (row) => (row.required ? t("نعم", "yes") : t("لا", "no")) },
    { key: "source", header: t("المصدر", "Source"), cell: (row) => <SourceBadge source={row.product_id ? "b2c" : "legacy"} /> },
  ];
  return (
    <State loading={query.isLoading} error={query.error}>
      <Card title={t("دورات الباقة", "Package courses")} className="ma-section-gap">
        <DataTable rows={query.data ?? []} columns={columns} empty={t("لا دورات.", "No courses.")} />
      </Card>
    </State>
  );
}
