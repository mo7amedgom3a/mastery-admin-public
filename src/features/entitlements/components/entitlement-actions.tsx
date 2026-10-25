import { useMemo, useState } from "react";

import { type AdminEntitlement, type EntitlementStatusAction } from "@/lib/api";
import { formatDate, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { customerHref, orderHref, productHref } from "@/lib/refs";
import { entitlementStatusBadge } from "@/lib/status";
import { AppLink } from "@/components/ui/app-link";
import { type Column } from "@/components/ui/data-table";
import { Badge, Button } from "@/components/ui/kit";
import { EntitlementDetailModal, ExtendModal, StatusModal } from "@/features/entitlements/components/entitlement-dialogs";
import { daysLeft, useSourceLabel } from "@/features/entitlements/components/entitlement-model";

/*
 * Admin actions on one customer's access to one product. Extend adds days (or makes the access lifetime),
 * suspend pauses it and freezes the days left, reinstate gives those days back, revoke ends it for good.
 * Each needs a reason and is audited; the LMS follows through the sync sweep.
 */

type Open = { row: AdminEntitlement; kind: "extend" | "detail" | EntitlementStatusAction } | null;

/**
 * Columns plus the dialogs they open. `show` picks the identity columns: the customer page hides the customer,
 * the product tab hides the product.
 */
export function useEntitlementColumns(show: { customer?: boolean; product?: boolean } = { customer: true, product: true }) {
  const t = useT();
  const sourceLabel = useSourceLabel();
  const [open, setOpen] = useState<Open>(null);
  const manage = can("subscribersManage.manage");

  const columns = useMemo<Column<AdminEntitlement>[]>(() => {
    const list: Column<AdminEntitlement>[] = [];
    if (show.customer) {
      list.push({
        key: "customer",
        header: t("العميل", "Customer"),
        cell: (row) => (
          <AppLink to={customerHref(`b2c:${row.customer_id}`)} className="ma-link ma-link--plain">
            <span className="ma-cell-main">{row.customer_name || "—"}</span>
            <span className="ma-cell-sub"><bdi>{row.customer_email ?? "—"}</bdi></span>
          </AppLink>
        ),
      });
    }
    if (show.product) {
      list.push({
        key: "product",
        header: t("المنتج", "Product"),
        cell: (row) => (
          <AppLink to={productHref(`b2c:${row.product_id}`)} className="ma-link ma-link--plain">
            <span className="ma-cell-main">{row.product_title || row.product_slug || <bdi>{row.product_id.slice(0, 8)}</bdi>}</span>
            <span className="ma-cell-sub">{row.product_type ?? ""}</span>
          </AppLink>
        ),
      });
    }
    list.push(
      {
        key: "source",
        header: t("المصدر", "Source"),
        cell: (row) =>
          row.source_type === "order" ? (
            <AppLink to={orderHref(`b2c:${row.source_id}`)} className="ma-link">{sourceLabel(row.source_type)}</AppLink>
          ) : (
            sourceLabel(row.source_type)
          ),
      },
      { key: "status", header: t("الحالة", "Status"), cell: (row) => <Badge def={entitlementStatusBadge(row.status)} /> },
      { key: "starts", header: t("البداية", "Starts"), cell: (row) => formatDate(row.starts_at) },
      {
        key: "expires",
        header: t("الانتهاء", "Expires"),
        cell: (row) => (row.expires_at ? formatDate(row.expires_at) : t("مدى الحياة", "Lifetime")),
      },
      {
        key: "left",
        header: t("المتبقي", "Days left"),
        align: "end",
        cell: (row) => {
          const days = daysLeft(row);
          if (days === null) return row.status === "suspended" ? t("مدى الحياة", "Lifetime") : "—";
          return <span className="ma-num">{formatNumber(days)}{row.status === "suspended" ? t(" (مجمّد)", " (frozen)") : ""}</span>;
        },
      },
      {
        key: "actions",
        header: "",
        align: "end",
        cell: (row) => (
          <span className="ma-cell-flex" style={{ gap: "4px", justifyContent: "flex-end" }}>
            <Button sm kind="ghost" icon="eye" label={t("التفاصيل", "Details")} onClick={() => setOpen({ row, kind: "detail" })} />
            {manage && (row.status === "active" || row.status === "expired") && row.expires_at ? (
              <Button sm kind="ghost" icon="plus" label={t("تمديد", "Extend")} onClick={() => setOpen({ row, kind: "extend" })} />
            ) : null}
            {manage && row.status === "active" ? (
              <Button sm kind="ghost" icon="pause" label={t("إيقاف", "Suspend")} onClick={() => setOpen({ row, kind: "suspend" })} />
            ) : null}
            {manage && row.status === "suspended" ? (
              <Button sm kind="ghost" icon="play" label={t("استئناف", "Reinstate")} onClick={() => setOpen({ row, kind: "reinstate" })} />
            ) : null}
            {manage && row.status !== "revoked" ? (
              <Button sm kind="ghost" icon="trash" label={t("سحب", "Revoke")} onClick={() => setOpen({ row, kind: "revoke" })} />
            ) : null}
          </span>
        ),
      },
    );
    return list;
  }, [manage, show.customer, show.product, sourceLabel, t]);

  const close = () => setOpen(null);
  const dialogs = open ? (
    open.kind === "extend" ? (
      <ExtendModal row={open.row} onClose={close} />
    ) : open.kind === "detail" ? (
      <EntitlementDetailModal row={open.row} onClose={close} />
    ) : (
      <StatusModal row={open.row} action={open.kind} onClose={close} />
    )
  ) : null;

  return { columns, dialogs };
}
