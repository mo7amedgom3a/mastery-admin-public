import { apiGet, apiPost } from "@/lib/api/client";
import type { PathParams, QueryParams, RequestBody, SuccessResponse } from "@/lib/api/operation-types";

/*
 * Customer access (`/admin/entitlements`): search every customer's access, inspect one with its LMS
 * fulfillments, extensions and status changes, and act on it. Writes need `admin:entitlements:manage` and a
 * reason; suspend freezes the days left and reinstate gives them back, revoke is final. Repeating an action
 * that is already applied is a no-op (`changed: false`).
 */

type ListOp = "list_entitlements_api_v1_admin_entitlements_get";
type CustomerListOp = "list_customer_entitlements_api_v1_admin_customers__customer_ref__entitlements_get";
type DetailOp = "get_entitlement_api_v1_admin_entitlements__entitlement_id__get";
type ExtendOp = "extend_entitlement_api_v1_admin_entitlements__entitlement_id__extend_post";
type SuspendOp = "suspend_entitlement_api_v1_admin_entitlements__entitlement_id__suspend_post";

export type AdminEntitlementPage = SuccessResponse<ListOp>;
export type AdminEntitlement = AdminEntitlementPage["items"][number];
export type AdminEntitlementDetail = SuccessResponse<DetailOp>;
export type AdminEntitlementAction = SuccessResponse<SuspendOp>;
export type AdminEntitlementListParams = QueryParams<ListOp>;
export type CustomerEntitlementListParams = Omit<QueryParams<CustomerListOp>, "customer_ref">;
export type ExtendEntitlementBody = RequestBody<ExtendOp>;
export type EntitlementStatusAction = "suspend" | "reinstate" | "revoke";
export type EntitlementStatus = NonNullable<AdminEntitlementListParams["status"]>;

type EntitlementId = PathParams<DetailOp>["entitlement_id"];

export const entitlementAdminPaths = {
  list: "admin/entitlements",
  customer: "admin/customers/{customer_ref}/entitlements",
  detail: "admin/entitlements/{entitlement_id}",
  extend: "admin/entitlements/{entitlement_id}/extend",
  action: (action: EntitlementStatusAction) => `admin/entitlements/{entitlement_id}/${action}`,
} as const;

export const entitlementAdminKeys = {
  all: ["entitlements", "admin"] as const,
  list: (params: AdminEntitlementListParams) => [...entitlementAdminKeys.all, "list", params] as const,
  customer: (ref: string, params: CustomerEntitlementListParams = {}) =>
    [...entitlementAdminKeys.all, "customer", ref, params] as const,
  detail: (id: string) => [...entitlementAdminKeys.all, "detail", id] as const,
};

export function listAdminEntitlements(params: AdminEntitlementListParams): Promise<AdminEntitlementPage> {
  return apiGet(entitlementAdminPaths.list, { query: params });
}

export function listCustomerEntitlements(
  ref: string,
  params: CustomerEntitlementListParams = {},
): Promise<AdminEntitlementPage> {
  return apiGet(entitlementAdminPaths.customer, { path: { customer_ref: ref }, query: params });
}

export function getAdminEntitlement(entitlement_id: EntitlementId): Promise<AdminEntitlementDetail> {
  return apiGet(entitlementAdminPaths.detail, { path: { entitlement_id } });
}

/** Adds `days` from the later of now and the expiry, or makes the access lifetime. */
export function extendEntitlement(
  entitlement_id: EntitlementId,
  body: ExtendEntitlementBody,
  idempotencyKey?: string,
): Promise<AdminEntitlementAction> {
  return apiPost(entitlementAdminPaths.extend, {
    path: { entitlement_id },
    body,
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
  });
}

export function changeEntitlementStatus(
  entitlement_id: EntitlementId,
  action: EntitlementStatusAction,
  reason: string,
): Promise<AdminEntitlementAction> {
  return apiPost(entitlementAdminPaths.action(action), { path: { entitlement_id }, body: { reason } });
}
