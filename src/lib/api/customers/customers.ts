import { queryOptions } from "@tanstack/react-query";

import { apiGet, apiPatch, apiPost } from "@/lib/api/client";
import type { PathParams, QueryParams, RequestBody, SuccessResponse } from "@/lib/api/operation-types";

type SearchCustomersOp = "search_customers_api_v1_admin_customers_get";
type GetCustomerOp = "get_customer_api_v1_admin_customers__customer_ref__get";
type UpdateCustomerOp = "update_customer_api_v1_admin_customers__customer_ref__patch";
type SetCustomerStatusOp = "set_customer_status_api_v1_admin_customers__customer_ref__status_post";
type Customer360Op = "customer_360_api_v1_admin_customers__customer_ref__360_get";
type ImportOp = "import_legacy_customers_api_v1_admin_customers_import_post";
type ImportIssuesOp = "customer_import_issues_api_v1_admin_customers_import_issues_get";
type SegmentsOp = "list_segments_api_v1_admin_customers_segments_get";

/**
 * A customer of either system: a B2C customer (`source` = `b2c`) or a legacy account not imported yet
 * (`source` = `legacy`). Addressed by `ref` (`b2c:<uuid>` / `legacy:user:<id>`).
 */
export type AdminCustomer = SuccessResponse<SearchCustomersOp>["items"][number];
export type AdminCustomerPage = SuccessResponse<SearchCustomersOp>;
export type AdminCustomersParams = QueryParams<SearchCustomersOp>;
export type AdminCustomerDetail = SuccessResponse<GetCustomerOp>;
export type AdminCustomerUpdateRequest = RequestBody<UpdateCustomerOp>;
export type CustomerStatusRequest = RequestBody<SetCustomerStatusOp>;
export type AdminCustomer360 = SuccessResponse<Customer360Op>;
export type AdminOrderRef = AdminCustomer360["recent_orders"][number];
export type AdminEntitlementRef = NonNullable<AdminCustomer360["entitlements"]>[number];
export type CustomerImportRequest = RequestBody<ImportOp>;
export type CustomerImportResult = SuccessResponse<ImportOp>;
export type ImportIssuesParams = QueryParams<ImportIssuesOp>;
export type ImportIssue = Record<string, unknown>;
export type CustomerSegment = SuccessResponse<SegmentsOp>["items"][number];
export type CustomerSegmentPage = SuccessResponse<SegmentsOp>;
export type CustomerSegmentsParams = QueryParams<SegmentsOp>;

export type CustomerStatus = "active" | "suspended" | "blocked";

export const customersPaths = {
  customers: "admin/customers",
  customer: "admin/customers/{customer_ref}",
  customerStatus: "admin/customers/{customer_ref}/status",
  customer360: "admin/customers/{customer_ref}/360",
  import: "admin/customers/import",
  importIssues: "admin/customers/import/issues",
  segments: "admin/customers/segments",
} as const;

export const customersKeys = {
  all: ["customers"] as const,
  list: (params?: AdminCustomersParams) => [...customersKeys.all, "list", params ?? {}] as const,
  detail: (customerRef: string) => [...customersKeys.all, "detail", customerRef] as const,
  customer360: (customerRef: string) => [...customersKeys.all, "360", customerRef] as const,
  importIssues: (params?: ImportIssuesParams) => [...customersKeys.all, "import-issues", params ?? {}] as const,
  segments: (params?: CustomerSegmentsParams) => [...customersKeys.all, "segments", params ?? {}] as const,
};

/** `GET /admin/customers` — B2C customers plus legacy accounts not imported yet (`source` filters). */
export function listCustomers(params: AdminCustomersParams = {}): Promise<AdminCustomerPage> {
  return apiGet(customersPaths.customers, { query: params });
}

export function getCustomer(
  customer_ref: PathParams<GetCustomerOp>["customer_ref"],
): Promise<AdminCustomerDetail> {
  return apiGet(customersPaths.customer, { path: { customer_ref } });
}

/** `PATCH /admin/customers/{ref}` — B2C customers only. Audited. */
export function updateCustomer(
  customer_ref: PathParams<UpdateCustomerOp>["customer_ref"],
  body: AdminCustomerUpdateRequest,
): Promise<AdminCustomerDetail> {
  return apiPatch(customersPaths.customer, { path: { customer_ref }, body });
}

/** `POST /admin/customers/{ref}/status` — active / suspended / blocked (B2C only). Audited. */
export function setCustomerStatus(
  customer_ref: PathParams<SetCustomerStatusOp>["customer_ref"],
  body: CustomerStatusRequest,
): Promise<AdminCustomerDetail> {
  return apiPost(customersPaths.customerStatus, { path: { customer_ref }, body });
}

/** `GET /admin/customers/{ref}/360` — profile, B2C and legacy order figures, recent orders of both systems. */
export function getCustomer360(
  customer_ref: PathParams<Customer360Op>["customer_ref"],
): Promise<AdminCustomer360> {
  return apiGet(customersPaths.customer360, { path: { customer_ref } });
}

/** `POST /admin/customers/import` — imports legacy accounts into `b2c.customers` (idempotent). */
export function importCustomers(body: CustomerImportRequest): Promise<CustomerImportResult> {
  return apiPost(customersPaths.import, { body });
}

/** `GET /admin/customers/import/issues` — accounts that failed to import. */
export function listImportIssues(params: ImportIssuesParams = {}): Promise<ImportIssue[]> {
  return apiGet(customersPaths.importIssues, { query: params });
}

/** `GET /admin/customers/segments` — user groups of the legacy platform. */
export function listCustomerSegments(params: CustomerSegmentsParams = {}): Promise<CustomerSegmentPage> {
  return apiGet(customersPaths.segments, { query: params });
}

export const customersQueries = {
  list: (params?: AdminCustomersParams) =>
    queryOptions({ queryKey: customersKeys.list(params), queryFn: () => listCustomers(params) }),
  detail: (customerRef: string) =>
    queryOptions({ queryKey: customersKeys.detail(customerRef), queryFn: () => getCustomer(customerRef) }),
  customer360: (customerRef: string) =>
    queryOptions({ queryKey: customersKeys.customer360(customerRef), queryFn: () => getCustomer360(customerRef) }),
  importIssues: (params?: ImportIssuesParams) =>
    queryOptions({ queryKey: customersKeys.importIssues(params), queryFn: () => listImportIssues(params) }),
  segments: (params?: CustomerSegmentsParams) =>
    queryOptions({ queryKey: customersKeys.segments(params), queryFn: () => listCustomerSegments(params) }),
};
