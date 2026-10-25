import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  listProducts,
  productKeys,
  productQueries,
  setProductStatus,
  type Product,
  type ProductOrigin,
  type ProductSort,
  type ProductSource,
  type ProductStatus,
} from "@/lib/api";
import { formatAmount, formatDateTime, formatNumber } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n";
import { badgeLabel, dateValue } from "@/lib/export/columns";
import { AppLink } from "@/components/ui/app-link";
import { Avatar, Badge, Button, ErrorAlert, PageHead } from "@/components/ui/kit";
import { type Column } from "@/components/ui/data-table";
import { PagedList, type ListFilter } from "@/components/ui/paged-list";
import { initialsOf, productStatusBadge } from "@/lib/status";
import { CatalogInsightsPanel } from "@/features/learning/components/catalog-insights-panel";
import { productHref } from "@/lib/refs";
import { SourceBadge } from "@/components/ui/source-badge";
import { productTypeLabel } from "@/lib/product-types";

/**
 * One catalog over every product type: B2C products (`b2c.products`, only `published` ones are sold) and the
 * legacy courses/packages no B2C product represents yet (`source` = `legacy`). A `?type=` tab narrows the list
 * (course, diploma, package, bundle, consultation, live_diploma); "all" lists everything.
 */
const ALL_PRODUCT_TYPES = "course,diploma,package,bundle,consultation,live_diploma";

export default function CatalogPage({ defaultType }: { defaultType?: string } = {}) {
  const t = useT();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const type = defaultType ?? searchParams.get("type") ?? "all";

  const selectType = (next: string) => {
    if (next === "all") navigate("/learning/catalog");
    else if (next === "course") navigate("/learning/courses");
    else if (next === "diploma") navigate("/learning/diplomas");
    else if (next === "live_diploma") navigate("/learning/live");
    else if (next === "package") navigate("/learning/bundles");
    else if (next === "bundle") navigate("/learning/packages");
    else {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          params.set("type", next);
          return params;
        },
        { replace: true },
      );
    }
  };

  const facets = useQuery(productQueries.facets()).data;
  const counts = new Map((facets?.product_types ?? []).map((option) => [option.value, option.count]));

  const tabs: { value: string; ar: string; en: string; count?: number }[] = [
    { value: "all", ar: "الكل", en: "All" },
    { value: "course", ...productTypeLabel("course"), count: counts.get("course") },
    { value: "diploma", ...productTypeLabel("diploma"), count: counts.get("diploma") },
    { value: "live_diploma", ...productTypeLabel("live_diploma"), count: counts.get("live_diploma") },
    { value: "package", ...productTypeLabel("package"), count: counts.get("package") },
    { value: "bundle", ...productTypeLabel("bundle"), count: counts.get("bundle") },
  ];

  const pageTitle = (() => {
    switch (type) {
      case "course":
        return t("الدورات", "Courses");
      case "diploma":
        return t("الدبلومات", "Diplomas");
      case "live_diploma":
        return t("الدبلومات المباشرة", "Live diplomas");
      case "package":
        return t("الباقات", "Bundles");
      case "bundle":
        return t("الحزم", "Packages");
      default:
        return t("الكتالوج", "Catalog");
    }
  })();

  const createHref = (() => {
    switch (type) {
      case "package":
        return "/learning/bundles/new";
      case "bundle":
        return "/learning/packages/new";
      case "consultation":
        return "/learning/consultations/new";
      case "live_diploma":
        return "/learning/live-diplomas/new";
      default:
        return "/learning/courses/new";
    }
  })();

  const createLabel = (() => {
    switch (type) {
      case "package":
        return t("إنشاء باقة", "Create bundle");
      case "bundle":
        return t("إنشاء حزمة", "Create package");
      case "consultation":
        return t("إنشاء استشارة", "Create consultation");
      case "live_diploma":
        return t("إنشاء دبلوم مباشر", "Create live diploma");
      case "diploma":
        return t("إنشاء دبلوم", "Create diploma");
      default:
        return t("إنشاء دورة", "Create course");
    }
  })();

  return (
    <>
      <PageHead
        title={pageTitle}
        sub={t("كل منتجات المتجر وحالة نشرها.", "Every storefront product and its publishing state.")}
        actions={<Button kind="primary" icon="plus" label={createLabel} href={createHref} />}
      />

      <nav className="ma-pagetabs" role="tablist" aria-label={t("أنواع المنتجات", "Product types")} style={{ marginBlock: "var(--space-3)" }}>
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={type === tab.value}
            className={`ma-pagetab ${type === tab.value ? "is-active" : ""}`}
            onClick={() => selectType(tab.value)}
          >
            {t(tab.ar, tab.en)}
            {tab.count != null ? <span className="cd-tab__n">{formatNumber(tab.count)}</span> : null}
          </button>
        ))}
      </nav>

      <CatalogList types={type === "all" ? "" : type} />
    </>
  );
}

const STATUSES: { value: ProductStatus; ar: string; en: string }[] = [
  { value: "published", ar: "منشور", en: "Published" },
  { value: "unpublished", ar: "غير منشور", en: "Unpublished" },
  { value: "draft", ar: "مسودة", en: "Draft" },
  { value: "archived", ar: "مؤرشف", en: "Archived" },
];

function CatalogList({ types }: { types: string }) {
  const t = useT();
  const lang = useLang();
  const queryClient = useQueryClient();

  const toggle = useMutation({
    mutationFn: (product: Product) =>
      setProductStatus(
        product.ref ?? `b2c:${product.product_id}`,
        product.status === "published" ? (product.source === "legacy" ? "draft" : "unpublished") : "published",
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productKeys.all }),
  });

  const columns: Column<Product>[] = [
    {
      key: "title",
      header: t("العنوان", "Title"),
      exportValue: (row) => row.title ?? row.slug,
      width: "16rem",
      sortKey: "title",
      cell: (row) => (
        <AppLink to={productHref(row.ref ?? `b2c:${row.product_id}`)} className="ma-cell-flex ma-link ma-link--plain">
          <Avatar
            initials={initialsOf(row.title ?? row.slug)}
            src={row.image ?? row.square_image ?? (row as unknown as { squareImage?: string | null }).squareImage}
            color="var(--teal)"
            alt={row.title ?? row.slug}
            square
          />
          <span>
            <span className="ma-cell-main">{row.title ?? row.slug}</span>
            <span className="ma-cell-sub">
              {[
                (() => {
                  const label = productTypeLabel(row.product_type);
                  return t(label.ar, label.en);
                })(),
                row.category,
                row.origin === "migrated" ? t("منقول من المنصة القديمة", "Migrated") : null,
              ]
                .filter(Boolean)
                .join(" · ") || "—"}
            </span>
          </span>
        </AppLink>
      ),
    },
    {
      key: "instructor",
      header: t("المدرب", "Instructor"),
      exportValue: (row) => row.instructor ?? "",
      cell: (row) =>
        row.instructor ? (
          <span className="ma-cell-flex">
            <Avatar
              initials={initialsOf(row.instructor)}
              src={row.instructor_avatar}
              color="var(--sky)"
              alt={row.instructor}
            />
            <span className="ma-cell-main">{row.instructor}</span>
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "price",
      header: t("السعر", "Price"),
      exportKind: "money",
      exportCurrency: (row) => row.price_currency ?? "USD",
      exportValue: (row) => row.price ?? null,
      align: "end",
      sortKey: "price",
      cell: (row) => (row.price != null ? formatAmount(row.price, row.price_currency ?? "USD") : "—"),
    },
    {
      key: "orders",
      header: t("طلبات مدفوعة", "Paid orders"),
      exportKind: "number",
      exportValue: (row) => row.paid_orders,
      align: "end",
      sortKey: "paid_orders",
      cell: (row) => <span className="ma-num">{formatNumber(row.paid_orders)}</span>,
    },
    {
      key: "rating",
      header: t("التقييم", "Rating"),
      exportKind: "number",
      exportValue: (row) => row.rating ?? null,
      align: "end",
      sortKey: "rating",
      cell: (row) =>
        row.rating != null ? (
          <span className="ma-num" title={t(`${row.review_count} تقييم`, `${row.review_count} reviews`)}>
            ★ {row.rating.toFixed(1)} <span className="ma-cell-sub">({formatNumber(row.review_count ?? 0)})</span>
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "tags",
      header: t("الوسوم", "Tags"),
      exportValue: (row) => (row.tags ?? []).join(", "),
      cell: (row) => {
        const tags = row.tags ?? [];
        if (!tags.length) return "—";
        return (
          <span className="ma-cell-tags" title={tags.join(", ")}>
            {tags.slice(0, 1).map((tag) => (
              <span key={tag} className="ma-tag">
                {tag}
              </span>
            ))}
            {tags.length > 1 ? <bdi className="ma-cell-sub">+{tags.length - 1}</bdi> : null}
          </span>
        );
      },
    },
    {
      key: "status",
      header: t("الحالة", "Status"),
      exportValue: (row) => [badgeLabel(productStatusBadge(row.status), lang), row.source].filter(Boolean).join(" · "),
      cell: (row) => (
        <span className="ma-cell-flex">
          <Badge def={productStatusBadge(row.status)} />
          <SourceBadge source={row.source} />
        </span>
      ),
    },
    {
      key: "updated",
      header: t("آخر تحديث", "Updated"),
      exportKind: "datetime",
      exportValue: (row) => dateValue(row.updated_at),
      sortKey: "updated",
      cell: (row) => formatDateTime(row.updated_at),
    },
    {
      key: "actions",
      header: "",
      align: "end",
      cell: (row) => (
        <Button
          sm
          disabled={toggle.isPending}
          label={row.status === "published" ? t("إلغاء النشر", "Unpublish") : t("نشر", "Publish")}
          onClick={() => toggle.mutate(row)}
        />
      ),
    },
  ];

  const facets = useQuery(productQueries.facets(types || undefined)).data;

  /** Single-choice filters. */
  const filters: ListFilter[] = [
    {
      key: "status",
      label: t("كل الحالات", "All states"),
      options: STATUSES.map((item) => ({ value: item.value, label: t(item.ar, item.en) })),
    },
    {
      key: "source",
      label: t("كل الأنظمة", "All systems"),
      options: [
        { value: "b2c", label: t("المتجر (B2C)", "B2C products") },
        { value: "legacy", label: t("النظام القديم (غير منقول)", "Legacy (not migrated)") },
      ],
    },
    {
      key: "origin",
      label: t("كل المصادر", "All origins"),
      options: [
        { value: "migrated", label: t("منقول من المنصة القديمة", "Migrated from legacy") },
        { value: "native", label: t("المتجر الجديد", "Native") },
      ],
    },
    {
      key: "purchased",
      label: t("المبيعات: الكل", "Sales: all"),
      options: [
        { value: "true", label: t("بيع مرة على الأقل", "Purchased") },
        { value: "false", label: t("لم يُشترَ", "Never purchased") },
      ],
    },
  ];

  /**
   * Multi-select facet filters, the way the storefront search page holds its facets: the current
   * product types / categories / tags with counts, several selectable at once. The type facet only
   * shows on the "All" tab — a type tab already fixes the type.
   */
  const multiFilters: ListFilter[] = [
    ...(types
      ? []
      : [
          {
            key: "product_type",
            label: t("كل الأنواع", "All types"),
            options: (facets?.product_types ?? []).map((item) => {
              const label = productTypeLabel(item.value);
              return { value: item.value, label: `${t(label.ar, label.en)} (${item.count})` };
            }),
          },
        ]),
    {
      key: "category",
      label: t("كل التصنيفات", "All categories"),
      options: (facets?.categories ?? []).map((item) => ({ value: item.value, label: `${item.label} (${item.count})` })),
    },
    {
      key: "tag",
      label: t("كل الوسوم", "All tags"),
      options: (facets?.tags ?? []).map((item) => ({ value: item.value, label: `${item.label} (${item.count})` })),
    },
  ];

  const sortOptions: { value: ProductSort; label: string }[] = [
    { value: "updated", label: t("آخر تحديث", "Last updated") },
    { value: "created", label: t("تاريخ الإنشاء", "Created") },
    { value: "price", label: t("السعر", "Price") },
    { value: "title", label: t("العنوان", "Title") },
    { value: "paid_orders", label: t("الطلبات المدفوعة", "Paid orders") },
    { value: "rating", label: t("التقييم", "Rating") },
  ];

  return (
    <>
      <CatalogInsightsPanel productType={types || ALL_PRODUCT_TYPES} />
      <ErrorAlert error={toggle.error} title={t("تعذّر تغيير حالة النشر", "Couldn't change the publishing state")} />
      <PagedList
        key={types || "all"}
        queryKeyBase={productKeys.list({ product_type: types })}
        fetchPage={({ query, offset, limit, filters: selected, multi, sort }) =>
          listProducts({
            product_type: multi?.product_type?.length ? multi.product_type.join(",") : types || undefined,
            status: (selected.status || undefined) as ProductStatus | undefined,
            category: multi?.category?.length ? multi.category.join(",") : undefined,
            tag: multi?.tag?.length ? multi.tag.join(",") : undefined,
            source: (selected.source || undefined) as ProductSource | undefined,
            origin: (selected.origin || undefined) as ProductOrigin | undefined,
            purchased: selected.purchased ? selected.purchased === "true" : undefined,
            sort: sort?.key as ProductSort | undefined,
            order: sort?.dir,
            query,
            limit,
            offset,
          })
        }
        sort={{ options: sortOptions, initial: { key: "updated", dir: "desc" } }}
        columns={columns}
        searchPlaceholder={t("ابحث بالعنوان أو الرابط…", "Search title or slug…")}
        filters={filters}
        multiFilters={multiFilters}
        empty={t("لا عناصر.", "No items.")}
        exportConfig={{
          filename: "catalog",
          title: t("الكتالوج", "Catalog"),
          pdf: true,
          fetchSize: 200,
          extraColumns: [
            { key: "type", header: t("النوع", "Type"), value: (row) => { const label = productTypeLabel(row.product_type); return t(label.ar, label.en); } },
            { key: "category", header: t("التصنيف", "Category"), value: (row) => row.category ?? "" },
          ],
        }}
      />
    </>
  );
}
