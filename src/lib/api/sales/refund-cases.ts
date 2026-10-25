import { queryOptions } from "@tanstack/react-query";

import { apiGet, apiPost } from "@/lib/api/client";

// The refund-case endpoints return untyped JSON in the OpenAPI schema, so the shapes are declared here.

export type RefundCase = {
  case_id: string;
  order_id: string;
  order_item_id: string;
  customer_id: string;
  customer_email: string;
  product_id: string;
  product_type: string;
  slug: string;
  provider: string;
  currency_code: string;
  requested_minor: number;
  approved_minor: number | null;
  status: string;
  customer_reason: string;
  decision_reason: string | null;
  eligibility_json: string | null;
  provider_refund_id: string | null;
  provider_error: string | null;
  created_at: string;
  decided_at: string | null;
  completed_at: string | null;
};

export type RefundEligibility = {
  eligible: boolean;
  reasons: string[];
  remaining_minor: number;
  allocated_minor: number;
  resources: { resource_id: string; resource_type: string }[];
  points_impact: { restore_used: number; reverse_earned: number };
};

export type RefundCaseEvent = { event_type: string; actor_id: string | null; detail_json: string; created_at: string };
export type RefundCaseDetail = RefundCase & { current_eligibility: RefundEligibility; events: RefundCaseEvent[] };
export type RefundCasePage = { items: RefundCase[]; total: number; limit: number; offset: number };
export type RefundCasesParams = { status?: string; q?: string; limit?: number; offset?: number };
export type RefundStatsPoint = { day: string; status: string; product_type: string; provider: string; cases: number; refunded_minor: number; currency_code: string };
export type RefundStatistics = { days: number; points: RefundStatsPoint[]; status_counts: Record<string, number> };
export type RefundDecisionAction = "approve" | "reject";

export const refundCasesPaths = {
  list: "admin/refund-cases",
  statistics: "admin/refund-cases/statistics",
  detail: "admin/refund-cases/{id}",
  decide: (action: RefundDecisionAction) => `admin/refund-cases/{id}/${action}`,
  reconcile: "admin/refund-cases/{id}/reconcile",
  itemPreview: "admin/refund-cases/items/{item_id}/preview",
  resourceComparison: "admin/refund-cases/resources/{resource_id}/comparison",
  productResources: "admin/refund-cases/products/{product_id}/resources",
} as const;

export const refundCaseKeys = {
  all: ["sales", "refund-cases"] as const,
  list: (params?: RefundCasesParams) => [...refundCaseKeys.all, "list", params ?? {}] as const,
  detail: (id: string) => [...refundCaseKeys.all, "detail", id] as const,
  stats: (days: number) => [...refundCaseKeys.all, "stats", days] as const,
  itemPreview: (itemId: string) => [...refundCaseKeys.all, "item-preview", itemId] as const,
};

export function listRefundCases(params: RefundCasesParams = {}): Promise<RefundCasePage> {
  return apiGet(refundCasesPaths.list, { query: params });
}
export function getRefundCase(id: string): Promise<RefundCaseDetail> {
  return apiGet(refundCasesPaths.detail, { path: { id } });
}
export function getRefundStatistics(days = 30): Promise<RefundStatistics> {
  return apiGet(refundCasesPaths.statistics, { query: { days } });
}
/** Approving sends the money back through the original gateway; rejecting closes the case. Both notify the customer. */
export function decideRefundCase(id: string, action: RefundDecisionAction, reason: string, amountMinor?: number): Promise<{ status: string }> {
  return apiPost(refundCasesPaths.decide(action), { path: { id }, body: { reason, amount_minor: amountMinor } });
}
export function reconcileRefundCase(id: string): Promise<{ status: string }> {
  return apiPost(refundCasesPaths.reconcile, { path: { id } });
}
export function createRefundCase(orderItemId: string, amountMinor: number, reason: string): Promise<{ case_id: string }> {
  return apiPost(refundCasesPaths.list, { body: { order_item_id: orderItemId, amount_minor: amountMinor, reason } });
}
export function getAdminItemRefundPreview(itemId: string): Promise<RefundEligibility> {
  return apiGet(refundCasesPaths.itemPreview, { path: { item_id: itemId } });
}
export function getResourceRefundComparison(resourceId: string): Promise<{ resource_id: string; completed_purchases: number; refunded_purchases: number; retained_purchases: number }> {
  return apiGet(refundCasesPaths.resourceComparison, { path: { resource_id: resourceId } });
}
export function getProductResourceRefundComparisons(productId: string): Promise<{ resource_id: string; resource_type: string; lms_reference_id: string; completed_purchases: number; refunded_purchases: number; retained_purchases: number }[]> {
  return apiGet(refundCasesPaths.productResources, { path: { product_id: productId } });
}

export const refundCasesQueries = {
  detail: (id: string) => queryOptions({ queryKey: refundCaseKeys.detail(id), queryFn: () => getRefundCase(id) }),
  stats: (days = 30) => queryOptions({ queryKey: refundCaseKeys.stats(days), queryFn: () => getRefundStatistics(days) }),
  /** 409/503 mean "can't be checked now", not a transient failure. */
  itemPreview: (itemId: string) =>
    queryOptions({ queryKey: refundCaseKeys.itemPreview(itemId), queryFn: () => getAdminItemRefundPreview(itemId), retry: false }),
};
