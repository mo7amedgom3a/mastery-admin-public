import { queryOptions } from "@tanstack/react-query";

import { apiGet } from "@/lib/api/client";
import type { QueryParams, SuccessResponse } from "@/lib/api/operation-types";

type SummaryOp = "dashboard_summary_api_v1_admin_dashboard_summary_get";
type DashboardSalesOp = "dashboard_sales_api_v1_admin_dashboard_sales_get";

/**
 * Platform-wide counters over B2C and the legacy platform (paid orders, free enrollments, customers and
 * revenue include legacy sales); certificates, videos, instructor applications and partners come from the LMS.
 */
export type DashboardSummary = SuccessResponse<SummaryOp>;
export type DashboardSummaryParams = QueryParams<SummaryOp>;
export type DashboardSalesParams = QueryParams<DashboardSalesOp>;

export const dashboardPaths = {
  summary: "admin/dashboard/summary",
  sales: "admin/dashboard/sales",
} as const;

export const dashboardKeys = {
  all: ["dashboard"] as const,
  summary: (params?: DashboardSummaryParams) => [...dashboardKeys.all, "summary", params ?? {}] as const,
  sales: (params: DashboardSalesParams) => [...dashboardKeys.all, "sales", params] as const,
};

/** `GET /admin/dashboard/summary?report_currency` — the platform-wide counters. */
export function dashboardSummary(params: DashboardSummaryParams = {}): Promise<DashboardSummary> {
  return apiGet(dashboardPaths.summary, { query: params });
}

/** `GET /admin/dashboard/sales?start&end&report_currency&source` — one sales point per day. */
export function dashboardSales(params: DashboardSalesParams): Promise<SuccessResponse<DashboardSalesOp>> {
  return apiGet(dashboardPaths.sales, { query: params });
}

export const dashboardQueries = {
  summary: (params?: DashboardSummaryParams) =>
    queryOptions({ queryKey: dashboardKeys.summary(params), queryFn: () => dashboardSummary(params) }),
  sales: (params: DashboardSalesParams) =>
    queryOptions({ queryKey: dashboardKeys.sales(params), queryFn: () => dashboardSales(params) }),
};
