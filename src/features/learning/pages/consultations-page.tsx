import { useMemo } from "react";

import { listProducts, productKeys, type Product, type ProductSort, type ProductsParams } from "@/lib/api";
import { formatAmount, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { productHref } from "@/lib/refs";
import { initialsOf, productStatusBadge } from "@/lib/status";
import { AppLink } from "@/components/ui/app-link";
import { Avatar, Badge, PageHead } from "@/components/ui/kit";
import type { Column } from "@/components/ui/data-table";
import { PagedList, type ListFilter } from "@/components/ui/paged-list";
import { CatalogInsightsPanel } from "@/features/learning/components/catalog-insights-panel";

export default function ConsultationsPage() {
  const t = useT();
  const columns: Column<Product>[] = [
    {
      key: "title",
      header: t("الخدمة", "Service"),
      exportValue: (row) => row.title ?? row.slug,
      sortKey: "title",
      width: "18rem",
      cell: (row) => (
        <AppLink className="ma-cell-flex ma-link ma-link--plain" to={productHref(row.ref ?? `b2c:${row.product_id}`)}>
          <Avatar initials={initialsOf(row.title ?? row.slug)} src={row.square_image ?? row.image}
            color="var(--coral)" alt={row.title ?? row.slug} square />
          <span className="ma-cell-main">{row.title ?? row.slug}</span>
        </AppLink>
      ),
    },
    {
      key: "consultant",
      header: t("الخبير", "Expert"),
      exportValue: (row) => row.instructor ?? "",
      cell: (row) => {
        if (!row.instructor) return "—";
        const body = (
          <>
            <Avatar initials={initialsOf(row.instructor)} src={row.instructor_avatar}
              color="var(--purple)" alt={row.instructor} />
            <span className="ma-cell-main">{row.instructor}</span>
          </>
        );
        return row.consultant_id ? (
          <AppLink className="ma-cell-flex ma-link ma-link--plain" to={`/consultations/experts/${row.consultant_id}`}>
            {body}
          </AppLink>
        ) : (
          <span className="ma-cell-flex">{body}</span>
        );
      },
    },
    {
      key: "price",
      header: t("السعر", "Price"),
      exportKind: "money",
      exportCurrency: (row) => row.price_currency ?? "USD",
      exportValue: (row) => row.price ?? null,
      align: "end",
      sortKey: "price",
      cell: (row) => row.price != null ? formatAmount(row.price, row.price_currency ?? "USD") : "—",
    },
    {
      key: "paid_orders",
      header: t("طلبات مدفوعة", "Paid orders"),
      exportKind: "number",
      exportValue: (row) => row.paid_orders,
      align: "end",
      cell: (row) => <span className="ma-num">{formatNumber(row.paid_orders)}</span>,
    },
    {
      key: "status",
      header: t("الحالة", "Status"),
      exportValue: (row) => row.status,
      cell: (row) => <Badge def={productStatusBadge(row.status)} />,
    },
  ];
  const filters: ListFilter[] = useMemo(() => [{
    key: "status",
    label: t("كل الحالات", "All statuses"),
    options: [
      { value: "published", label: t("منشورة", "Published") },
      { value: "draft", label: t("مسودة", "Draft") },
      { value: "archived", label: t("مؤرشفة", "Archived") },
    ],
  }], [t]);

  return (
    <>
      <PageHead title={t("الاستشارات", "Consultations")}
        sub={t("خدمات الاستشارة المحفوظة في كتالوج B2C.", "Consultation services in the B2C catalog.")} />
      <CatalogInsightsPanel productType="consultation" />
      <PagedList
        queryKeyBase={productKeys.list({ product_type: "consultation", source: "b2c" })}
        fetchPage={({ query, offset, limit, filters: selected, sort }) =>
          listProducts({ product_type: "consultation", source: "b2c", query, offset, limit,
            status: selected.status as ProductsParams["status"],
            sort: sort?.key as ProductSort | undefined, order: sort?.dir })}
        columns={columns}
        filters={filters}
        sort={{ options: [
          { value: "title", label: t("الاسم", "Name") },
          { value: "price", label: t("السعر", "Price") },
          { value: "updated", label: t("آخر تعديل", "Last updated") },
        ], initial: { key: "updated", dir: "desc" } }}
        searchPlaceholder={t("ابحث بعنوان الخدمة أو الخبير…", "Search service title or expert…")}
        empty={t("لا خدمات استشارية.", "No consultation services.")}
        exportConfig={{ filename: "consultations", title: t("الخدمات الاستشارية", "Consultation services"), pdf: true, fetchSize: 200 }}
      />
    </>
  );
}
