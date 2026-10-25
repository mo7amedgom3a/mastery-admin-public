import { useMemo } from "react";
import { consultantsKeys, listConsultants, type Consultant } from "@/lib/api";
import { formatAmount, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { initialsOf } from "@/lib/status";
import { AppLink } from "@/components/ui/app-link";
import { Avatar, PageHead } from "@/components/ui/kit";
import { type Column } from "@/components/ui/data-table";
import { PagedList, type ListFilter } from "@/components/ui/paged-list";

/** Consultants (experts) with their number of services, paid orders and revenue (`/admin/consultations/consultants`). */
export default function ConsultantsPage() {
  const t = useT();

  const columns: Column<Consultant>[] = [
    {
      key: "name",
      header: t("المستشار / المدرب", "Consultant / Instructor"),
      exportValue: (row) => [row.name, row.email].filter(Boolean).join(" · "),
      sortable: true,
      sortValue: (row) => row.name ?? "",
      cell: (row) => (
        <AppLink className="ma-cell-flex ma-link ma-link--plain" to={`/learning/consultants/${row.legacy_consultant_id}`}>
          <Avatar
            initials={initialsOf(row.name ?? row.email ?? "")}
            src={row.avatar}
            color="var(--purple)"
            alt={row.name ?? ""}
          />
          <span>
            <span className="ma-cell-main">{row.name || "—"}</span>
            <span className="ma-cell-sub"><bdi>{row.email || "—"}</bdi></span>
          </span>
        </AppLink>
      ),
    },
    {
      key: "services",
      header: t("الخدمات", "Services"),
      exportKind: "number",
      align: "end",
      sortable: true,
      sortValue: (row) => row.services ?? 0,
      cell: (row) => <span className="ma-num">{formatNumber(row.services ?? 0)}</span>,
    },
    {
      key: "orders",
      header: t("الطلبات", "Orders"),
      exportKind: "number",
      align: "end",
      sortable: true,
      sortValue: (row) => row.orders ?? 0,
      cell: (row) => <span className="ma-num">{formatNumber(row.orders ?? 0)}</span>,
    },
    {
      key: "payments",
      header: t("المدفوعات", "Payments"),
      exportKind: "money",
      exportCurrency: (row) => row.currency ?? "SAR",
      exportValue: (row) => row.revenue ?? null,
      align: "end",
      sortable: true,
      sortValue: (row) => row.revenue ?? 0,
      cell: (row) => <span className="ma-num">{row.revenue != null ? formatAmount(row.revenue, row.currency ?? "SAR") : "—"}</span>,
    },
  ];

  const filters: ListFilter[] = useMemo(
    () => [
      {
        key: "activity",
        label: t("النشاط", "Activity"),
        options: [
          { value: "with_services", label: t("لديه خدمات", "With services") },
          { value: "with_orders", label: t("لديه طلبات", "With orders") },
        ],
      },
    ],
    [t],
  );

  return (
    <>
      <PageHead
        title={t("المستشارون", "Consultants")}
        sub={t("المستشارون والمدربون وخدماتهم وطلباتهم من النظام القديم.", "Consultants and instructors with their services and orders.")}
      />
      <PagedList
        queryKeyBase={consultantsKeys.list()}
        fetchPage={({ query, offset, limit, filters: selected }) =>
          listConsultants({ query, limit, offset }).then((res) => {
            if (selected.activity === "with_services") {
              return { ...res, items: res.items.filter((item) => (item.services ?? 0) > 0) };
            }
            if (selected.activity === "with_orders") {
              return { ...res, items: res.items.filter((item) => (item.orders ?? 0) > 0) };
            }
            return res;
          })
        }
        columns={columns}
        filters={filters}
        searchPlaceholder={t("ابحث بالاسم أو البريد…", "Search name or email…")}
        empty={t("لا مستشارين.", "No consultants.")}
        exportConfig={{ filename: "consultants", title: t("المستشارون", "Consultants"), pdf: true, fetchSize: 200 }}
      />
    </>
  );
}
