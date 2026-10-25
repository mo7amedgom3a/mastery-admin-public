import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { listOrders, type AdminOrder } from "@/lib/api";
import { formatAmount, formatDayMonth, formatNumber } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n";
import { badgeLabel } from "@/lib/export/columns";
import { fetchAllPages } from "@/lib/export/fetch-all";
import { shortRef } from "@/lib/refs";
import { Card, Kpi, PageHead } from "@/components/ui/kit";
import { DataTable, type Column } from "@/components/ui/data-table";
import { orderStatusBadge } from "@/lib/status";
import { Badge } from "@/components/ui/kit";
import { Pagination } from "@/components/ui/primitives";
import { SearchBox } from "@/components/ui/paged-list";
import { SelectField } from "@/components/ui/select";

const PAGE_SIZE = 25;

export default function InvoicesPage() {
  const t = useT();
  const lang = useLang();
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [invoiceFilter, setInvoiceFilter] = useState("all");

  const orders = useQuery({
    queryKey: ["sales", "invoices", { offset }],
    queryFn: () => listOrders({ source: "b2c", limit: PAGE_SIZE, offset }),
  });

  const rawRows = orders.data?.items ?? [];
  const withInvoices = rawRows.filter((row) => row.invoice_count > 0);
  const totalInvoices = rawRows.reduce((sum, row) => sum + row.invoice_count, 0);

  const matches = (row: AdminOrder) => {
      const q = search.toLowerCase();
      const matchSearch =
        !search ||
        row.ref.toLowerCase().includes(q) ||
        (row.customer_email?.toLowerCase().includes(q) ?? false);
      const matchFilter =
        invoiceFilter === "all" ||
        (invoiceFilter === "with_invoice" ? row.invoice_count > 0 : row.invoice_count === 0);
      return matchSearch && matchFilter;
  };
  const filteredRows = rawRows.filter(matches);

  const columns: Column<AdminOrder>[] = [
    { key: "order", header: t("الطلب", "Order"), exportValue: (row) => shortRef(row.ref), cell: (row) => <bdi className="ma-num">{shortRef(row.ref)}</bdi> },
    { key: "when", header: t("التاريخ", "Date"), exportKind: "datetime", exportValue: (row) => (row.created_at ? new Date(row.created_at) : null), cell: (row) => formatDayMonth(row.created_at ?? undefined) },
    { key: "customer", header: t("العميل", "Customer"), exportValue: (row) => row.customer_email ?? "", cell: (row) => <bdi className="ma-cell-sub">{row.customer_email ?? "—"}</bdi> },
    { key: "amount", header: t("المبلغ", "Amount"), align: "end", exportKind: "money", exportValue: (row) => row.amount_minor / 100, exportCurrency: (row) => row.currency_code, cell: (row) => formatAmount(row.amount_minor / 100, row.currency_code) },
    { key: "invoices", header: t("الفواتير", "Invoices"), align: "end", exportKind: "number", exportValue: (row) => row.invoice_count, cell: (row) => <span className="ma-num">{formatNumber(row.invoice_count)}</span> },
    { key: "status", header: t("الحالة", "Status"), exportValue: (row) => badgeLabel(orderStatusBadge(row.status), lang), cell: (row) => <Badge def={orderStatusBadge(row.status)} /> },
  ];

  const toolbar = (
    <>
      <SearchBox placeholder={t("ابحث برقم الطلب أو البريد…", "Search order id or email…")} value={search} onChange={setSearch} />
      <SelectField
        label={t("حالة الفاتورة", "Invoice filter")}
        value={invoiceFilter}
        onChange={setInvoiceFilter}
        options={[
          { value: "all", label: t("الكل", "All orders") },
          { value: "with_invoice", label: t("تم إصدار فاتورة", "With invoice") },
          { value: "no_invoice", label: t("بدون فاتورة", "Without invoice") },
        ]}
      />
    </>
  );

  return (
    <>
      <PageHead
        title={t("الفواتير", "Invoices")}
        sub={t("الفواتير الصادرة المرتبطة بالطلبات والعملاء.", "Issued invoices attached to customer orders.")}
      />

      <div className="ma-cols ma-cols--3">
        <Kpi label={t("فواتير هذه الصفحة", "Invoices on this page")} value={formatNumber(totalInvoices)} icon="receipt" field="var(--sky)" />
        <Kpi label={t("طلبات بفواتير", "Orders with invoices")} value={formatNumber(withInvoices.length)} icon="file" field="var(--teal)" />
        <Kpi label={t("إجمالي الطلبات", "Orders total")} value={formatNumber(orders.data?.total ?? 0)} icon="cart" field="var(--purple)" />
      </div>

      <Card flush className="ma-section-gap">
        <DataTable
          columns={columns}
          rows={filteredRows}
          toolbar={toolbar}
          loading={orders.isLoading}
          error={orders.error}
          empty={t("لا طلبات مطابقة.", "No matching orders.")}
          exportConfig={{
            filename: "invoices",
            title: t("الفواتير", "Invoices"),
            pdf: true,
            meta: {
              filters: [
                search ? `${t("بحث", "Search")}: ${search}` : "",
                invoiceFilter !== "all" ? (invoiceFilter === "with_invoice" ? t("تم إصدار فاتورة", "With invoice") : t("بدون فاتورة", "Without invoice")) : "",
              ].filter(Boolean),
            },
            // The whole b2c order list (not just this page), narrowed by the on-screen search and invoice filter.
            fetchAll: async (max, onProgress) => {
              const all = await fetchAllPages((from, limit) => listOrders({ source: "b2c", limit, offset: from }), { pageSize: 200, max, onProgress });
              return { items: all.items.filter(matches), truncated: all.truncated };
            },
          }}
          footer={orders.data ? <Pagination total={orders.data.total} limit={orders.data.limit} offset={orders.data.offset} onPage={setOffset} /> : null}
        />
      </Card>
    </>
  );
}
