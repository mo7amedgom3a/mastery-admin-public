import { listCustomers, type AdminCustomer } from "@/lib/api";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n";
import { badgeLabel } from "@/lib/export/columns";
import { customerHref } from "@/lib/refs";
import { customerStatusBadge, initialsOf } from "@/lib/status";
import { AppLink } from "@/components/ui/app-link";
import { type Column } from "@/components/ui/data-table";
import { Avatar, Badge, PageHead } from "@/components/ui/kit";
import { PagedList, type ListFilter } from "@/components/ui/paged-list";
import { SourceBadge } from "@/components/ui/source-badge";

/**
 * One customer directory: B2C customers and the legacy accounts not imported yet (`source` = `legacy`).
 * Imported legacy accounts are listed once, as their B2C customer.
 */
export default function CustomersPage() {
  const t = useT();
  return (
    <>
      <PageHead
        title={t("العملاء", "Customers")}
        sub={t(
          "عملاء B2C والحسابات القديمة التي لم تُنقل بعد، في قائمة واحدة.",
          "B2C customers and the legacy accounts not imported yet, in one list.",
        )}
      />
      <CustomerDirectory />
    </>
  );
}

export function CustomerDirectory({ initialSource }: { initialSource?: "b2c" | "legacy" }) {
  const t = useT();
  const lang = useLang();
  const columns: Column<AdminCustomer>[] = [
    {
      key: "customer",
      header: t("العميل", "Customer"),
      sortable: true,
      sortValue: (row) => row.full_name || row.email || "",
      exportValue: (row) => row.full_name || "",
      cell: (row) => (
        <AppLink to={customerHref(row.ref)} className="ma-cell-flex ma-link ma-link--plain">
          <Avatar initials={initialsOf(row.full_name || row.email || "")} color={row.source === "legacy" ? "var(--purple)" : "var(--teal)"} />
          <span>
            <span className="ma-cell-main">{row.full_name || "—"}</span>
            <span className="ma-cell-sub"><bdi>{row.email ?? "—"}</bdi></span>
          </span>
        </AppLink>
      ),
    },
    { key: "source", header: t("النظام", "System"), exportValue: (row) => row.source, cell: (row) => <SourceBadge source={row.source} /> },
    { key: "status", header: t("الحالة", "Status"), sortable: true, exportValue: (row) => badgeLabel(customerStatusBadge(row.status), lang), cell: (row) => <Badge def={customerStatusBadge(row.status)} /> },
    {
      key: "orders",
      header: t("الطلبات", "Orders"),
      align: "end",
      sortable: true,
      sortValue: (row) => row.orders_count ?? 0,
      exportKind: "number",
      cell: (row) => <span className="ma-num">{row.orders_count != null ? formatNumber(row.orders_count) : "—"}</span>,
    },
    {
      key: "legacy",
      header: t("رقم قديم", "Legacy id"),
      align: "end",
      exportValue: (row) => row.legacy_user_id ?? "",
      cell: (row) => <span className="ma-num">{row.legacy_user_id ?? "—"}</span>,
    },
    { key: "created", header: t("التسجيل", "Created"), sortable: true, sortValue: (row) => row.created_at ?? "", exportKind: "datetime", exportValue: (row) => (row.created_at ? new Date(row.created_at) : null), cell: (row) => formatDateTime(row.created_at) },
  ];

  const filters: ListFilter[] = [
    {
      key: "source",
      label: t("كل الأنظمة", "All systems"),
      options: [
        { value: "b2c", label: t("عملاء B2C", "B2C customers") },
        { value: "legacy", label: t("حسابات قديمة غير منقولة", "Legacy (not imported)") },
      ],
    },
    {
      key: "status",
      label: t("كل الحالات (B2C)", "All states (B2C)"),
      options: [
        { value: "active", label: t("نشط", "Active") },
        { value: "suspended", label: t("موقوف", "Suspended") },
        { value: "blocked", label: t("محظور", "Blocked") },
      ],
    },
  ];

  return (
    <PagedList
      queryKeyBase={["customers", "list", initialSource ?? "all"]}
      fetchPage={({ query, offset, limit, filters: selected }) =>
        listCustomers({
          source: (selected.source || initialSource || "all") as "all" | "b2c" | "legacy",
          query,
          status: selected.status || undefined,
          limit,
          offset,
        })
      }
      columns={columns}
      searchPlaceholder={t("ابحث بالبريد أو الاسم أو الهاتف أو الرقم القديم…", "Search email, name, phone or legacy id…")}
      filters={initialSource ? filters.filter((filter) => filter.key !== "source") : filters}
      empty={t("لا عملاء.", "No customers.")}
      exportConfig={{
        filename: "customers",
        title: t("العملاء", "Customers"),
        pdf: true,
        fetchSize: 200,
        extraColumns: [{ key: "email", header: t("البريد", "Email"), value: (row) => row.email ?? "" }],
      }}
    />
  );
}
