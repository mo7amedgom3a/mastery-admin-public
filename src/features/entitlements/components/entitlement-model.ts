import { useQueryClient } from "@tanstack/react-query";

import { customerAdminKeys, customersKeys, entitlementAdminKeys, type AdminEntitlement } from "@/lib/api";
import { useT } from "@/lib/i18n";

export const DAY_MS = 86_400_000;

export function daysLeft(row: Pick<AdminEntitlement, "status" | "expires_at" | "suspended_remaining_days">): number | null {
  if (row.status === "suspended") return row.suspended_remaining_days ?? null;
  if (!row.expires_at || row.status !== "active") return null;
  return Math.max(0, Math.ceil((new Date(row.expires_at).getTime() - Date.now()) / DAY_MS));
}

export function useSourceLabel() {
  const t = useT();
  return (source: string) => ({ order: t("طلب", "Order"), subscription: t("اشتراك", "Subscription") })[source] ?? source;
}

/** Refreshes every list an entitlement can appear in (customer page, product tab, global list). */
export function useRefreshEntitlements() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: entitlementAdminKeys.all });
    queryClient.invalidateQueries({ queryKey: customerAdminKeys.all });
    queryClient.invalidateQueries({ queryKey: customersKeys.all });
  };
}
