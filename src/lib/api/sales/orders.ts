import { queryOptions } from "@tanstack/react-query";

import { apiGet, apiPost } from "@/lib/api/client";
import type { PathParams, QueryParams, SuccessResponse } from "@/lib/api/operation-types";

type ListOrdersOp = "search_orders_api_v1_admin_orders_get";
type GetOrderOp = "get_order_api_v1_admin_orders__order_ref__get";
type CancelOrderOp = "cancel_order_api_v1_admin_orders__order_ref__cancel_post";

/** An order of either system: `source` is `b2c` or `legacy`, `ref` addresses it (`b2c:<uuid>` / `legacy:order:<id>`). */
export type AdminOrder = SuccessResponse<ListOrdersOp>["items"][number];
export type AdminOrderPage = SuccessResponse<ListOrdersOp>;
export type AdminOrderDetail = SuccessResponse<GetOrderOp>;
export type AdminOrderLine = NonNullable<AdminOrderDetail["lines"]>[number];
export type AdminOrderInvoice = NonNullable<AdminOrderDetail["invoices"]>[number];
export type AdminOrderTransaction = NonNullable<AdminOrderDetail["transactions"]>[number];
export type AdminOrdersParams = QueryParams<ListOrdersOp>;

export type OrderStatus = "created" | "pending_payment" | "paid" | "fulfilled" | "cancelled";
export type PaymentStatus = "pending" | "succeeded" | "failed" | "refunded" | "incomplete";

export const ordersPaths = {
  orders: "admin/orders",
  order: "admin/orders/{order_ref}",
  cancelOrder: "admin/orders/{order_ref}/cancel",
} as const;

export const ordersKeys = {
  all: ["sales", "orders"] as const,
  list: (params?: AdminOrdersParams) => [...ordersKeys.all, "list", params ?? {}] as const,
  detail: (orderRef: string) => [...ordersKeys.all, "detail", orderRef] as const,
};

/** `GET /admin/orders` — B2C and legacy orders in one page, newest first (`source` filters). */
export function listOrders(params: AdminOrdersParams = {}): Promise<AdminOrderPage> {
  return apiGet(ordersPaths.orders, { query: params });
}

export function getOrder(order_ref: PathParams<GetOrderOp>["order_ref"]): Promise<AdminOrderDetail> {
  return apiGet(ordersPaths.order, { path: { order_ref } });
}

/** `POST /admin/orders/{order_ref}/cancel` — B2C orders only, audited; legacy orders are read-only. */
export function cancelOrder(order_ref: PathParams<CancelOrderOp>["order_ref"]): Promise<AdminOrderDetail> {
  return apiPost(ordersPaths.cancelOrder, { path: { order_ref } });
}

export const ordersQueries = {
  list: (params?: AdminOrdersParams) =>
    queryOptions({ queryKey: ordersKeys.list(params), queryFn: () => listOrders(params) }),
  detail: (orderRef: string) =>
    queryOptions({ queryKey: ordersKeys.detail(orderRef), queryFn: () => getOrder(orderRef) }),
};
