import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  entitlementAdminKeys,
  listAdminEntitlements,
  listCustomerEntitlements,
  type AdminEntitlement,
  type EntitlementStatus,
} from "@/lib/api";
import { useT } from "@/lib/i18n";
import { DataTable } from "@/components/ui/data-table";
import { Card, ErrorAlert } from "@/components/ui/kit";
import { PagedList, type ListFilter } from "@/components/ui/paged-list";
import { SelectField } from "@/components/ui/select";
import { useEntitlementColumns } from "@/features/entitlements/components/entitlement-actions";

function useStatusOptions() {
  const t = useT();
  return [
    { value: "active", label: t("فعّال", "Active") },
    { value: "expired", label: t("منتهٍ", "Expired") },
    { value: "suspended", label: t("موقوف مؤقتاً", "Suspended") },
    { value: "revoked", label: t("مسحوب", "Revoked") },
  ];
}

/** A B2C customer's access to every product, with extend / suspend / reinstate / revoke. */
export function CustomerEntitlementsCard({ customerRef }: { customerRef: string }) {
  const t = useT();
  const statusOptions = useStatusOptions();
  const [status, setStatus] = useState("");
  const params = { status: (status || undefined) as EntitlementStatus | undefined, limit: 100 };
  const list = useQuery({
    queryKey: entitlementAdminKeys.customer(customerRef, params),
    queryFn: () => listCustomerEntitlements(customerRef, params),
  });
  const { columns, dialogs } = useEntitlementColumns({ product: true });

  return (
    <Card title={t("الوصول إلى المنتجات", "Product access")} className="ma-section-gap">
      <ErrorAlert error={list.error} />
      <DataTable<AdminEntitlement>
        rows={list.data?.items ?? []}
        loading={list.isLoading}
        columns={columns}
        toolbar={
          <SelectField label={t("الحالة", "Status")} value={status || "all"} onChange={(next) => setStatus(next === "all" ? "" : next)}
            options={[{ value: "all", label: t("كل الحالات", "All statuses") }, ...statusOptions]} />
        }
        empty={t("لا وصول مطابق.", "No matching access.")}
      />
      {dialogs}
    </Card>
  );
}

/** Every customer's access, optionally for one product (the product's Access tab). */
export function EntitlementDirectory({ productId }: { productId?: string }) {
  const t = useT();
  const statusOptions = useStatusOptions();
  const { columns, dialogs } = useEntitlementColumns({ customer: true, product: !productId });
  const filters: ListFilter[] = [
    { key: "status", label: t("كل الحالات", "All statuses"), options: statusOptions },
    {
      key: "source_type",
      label: t("كل المصادر", "All sources"),
      options: [
        { value: "order", label: t("طلب", "Order") },
        { value: "subscription", label: t("اشتراك", "Subscription") },
      ],
    },
    {
      key: "expiring_within_days",
      label: t("أي تاريخ انتهاء", "Any expiry"),
      options: [
        { value: "7", label: t("ينتهي خلال 7 أيام", "Ends within 7 days") },
        { value: "30", label: t("ينتهي خلال 30 يوماً", "Ends within 30 days") },
      ],
    },
  ];

  return (
    <>
      <PagedList<AdminEntitlement>
        queryKeyBase={[...entitlementAdminKeys.all, "directory", productId ?? "all"]}
        fetchPage={({ query, offset, limit, filters: values }) =>
          listAdminEntitlements({
            query,
            offset,
            limit,
            product_id: productId,
            status: (values.status || undefined) as EntitlementStatus | undefined,
            source_type: (values.source_type || undefined) as "order" | "subscription" | undefined,
            expiring_within_days: values.expiring_within_days ? Number(values.expiring_within_days) : undefined,
          })
        }
        columns={columns}
        filters={filters}
        searchPlaceholder={t("ابحث بالعميل أو المنتج…", "Search customer or product…")}
        empty={t("لا وصول مطابق.", "No matching access.")}
      />
      {dialogs}
    </>
  );
}
