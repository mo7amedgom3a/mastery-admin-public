import { queryOptions } from "@tanstack/react-query";

import { apiGet } from "@/lib/api/client";
import type { QueryParams, Schemas, SuccessResponse } from "@/lib/api/operation-types";

/*
 * Sales reports over B2C and the legacy platform (`/admin/reports/*`). B2C sales come from the commerce
 * tables (`b2c.orders`, `payment_intents`, `refunds`), legacy sales from the legacy orders; `source`
 * (`all` | `b2c` | `legacy`) restricts a report. Rows list the `sources` they came from (legacy sales of a
 * migrated course add up in its B2C row) and `SalesReport.sources` splits the totals per system. Amounts
 * are kept per original currency (`*_by_currency`) and converted to `report_currency` with daily rates (`fx`).
 */

type SalesOp = "sales_report_api_v1_admin_reports_sales_get";
type ProductsOp = "product_sales_report_api_v1_admin_reports_products_get";
type CategoriesOp = "category_sales_report_api_v1_admin_reports_categories_get";
type PromotionsOp = "promotion_sales_report_api_v1_admin_reports_promotions_get";
type CustomersOp = "customer_sales_report_api_v1_admin_reports_customers_get";
type PaymentsOp = "payment_breakdown_report_api_v1_admin_reports_payments_get";

/** `{ start, end, report_currency, source }` — `end` is inclusive; a date covers that whole day. */
export type ReportParams = QueryParams<SalesOp>;
export type ReportCurrency = NonNullable<ReportParams["report_currency"]>;
export type ReportSource = NonNullable<ReportParams["source"]>;
export const REPORT_CURRENCIES: ReportCurrency[] = ["USD", "AED", "SAR"];

export type MoneyAmount = Schemas["MoneyAmount"];
export type FxInfo = Schemas["FxInfo"];
export type SalesReport = SuccessResponse<SalesOp>;
export type SalesTotals = SalesReport["totals"];
export type SourceSales = Schemas["SourceSales"];
/** One day: paid `orders`, gross `revenue`, `refunds`, `net` in the report currency. */
export type SalesPoint = Schemas["SalesPoint"];
export type ProductSalesReport = SuccessResponse<ProductsOp>;
export type ProductSalesRow = Schemas["ProductSalesRow"];
export type CategorySalesReport = SuccessResponse<CategoriesOp>;
export type CategorySalesRow = Schemas["CategorySalesRow"];
export type PromotionSalesReport = SuccessResponse<PromotionsOp>;
export type PromotionSalesRow = Schemas["PromotionSalesRow"];
export type CustomerSalesReport = SuccessResponse<CustomersOp>;
export type CustomerSalesRow = Schemas["CustomerSalesRow"];
export type CustomerReportParams = QueryParams<CustomersOp>;
export type PaymentBreakdownReport = SuccessResponse<PaymentsOp>;
export type PaymentBreakdownRow = Schemas["PaymentBreakdownRow"];

export const reportPaths = {
  sales: "admin/reports/sales",
  products: "admin/reports/products",
  categories: "admin/reports/categories",
  promotions: "admin/reports/promotions",
  customers: "admin/reports/customers",
  payments: "admin/reports/payments",
} as const;

export const reportKeys = {
  all: ["analytics", "reports"] as const,
  sales: (params: ReportParams) => [...reportKeys.all, "sales", params] as const,
  products: (params: ReportParams) => [...reportKeys.all, "products", params] as const,
  categories: (params: ReportParams) => [...reportKeys.all, "categories", params] as const,
  promotions: (params: ReportParams) => [...reportKeys.all, "promotions", params] as const,
  customers: (params: CustomerReportParams) => [...reportKeys.all, "customers", params] as const,
  payments: (params: ReportParams) => [...reportKeys.all, "payments", params] as const,
};

/** `GET /admin/reports/sales` — totals (gross, refunds, net, paid orders), per day and per system. */
export function salesReport(params: ReportParams): Promise<SalesReport> {
  return apiGet(reportPaths.sales, { query: params });
}

/** `GET /admin/reports/products` — revenue per product, highest first. */
export function productSalesReport(params: ReportParams): Promise<ProductSalesReport> {
  return apiGet(reportPaths.products, { query: params });
}

export function categoriesReport(params: ReportParams): Promise<CategorySalesReport> {
  return apiGet(reportPaths.categories, { query: params });
}

/** `GET /admin/reports/promotions` — uses, discount and revenue per promotion / legacy coupon. */
export function promotionsReport(params: ReportParams): Promise<PromotionSalesReport> {
  return apiGet(reportPaths.promotions, { query: params });
}

export function customersReport(params: CustomerReportParams): Promise<CustomerSalesReport> {
  return apiGet(reportPaths.customers, { query: params });
}

/** `GET /admin/reports/payments` — payments by system, gateway and status. */
export function paymentsReport(params: ReportParams): Promise<PaymentBreakdownReport> {
  return apiGet(reportPaths.payments, { query: params });
}

export const reportQueries = {
  sales: (params: ReportParams) => queryOptions({ queryKey: reportKeys.sales(params), queryFn: () => salesReport(params) }),
  products: (params: ReportParams) =>
    queryOptions({ queryKey: reportKeys.products(params), queryFn: () => productSalesReport(params) }),
  categories: (params: ReportParams) =>
    queryOptions({ queryKey: reportKeys.categories(params), queryFn: () => categoriesReport(params) }),
  promotions: (params: ReportParams) =>
    queryOptions({ queryKey: reportKeys.promotions(params), queryFn: () => promotionsReport(params) }),
  customers: (params: CustomerReportParams) =>
    queryOptions({ queryKey: reportKeys.customers(params), queryFn: () => customersReport(params) }),
  payments: (params: ReportParams) =>
    queryOptions({ queryKey: reportKeys.payments(params), queryFn: () => paymentsReport(params) }),
};
