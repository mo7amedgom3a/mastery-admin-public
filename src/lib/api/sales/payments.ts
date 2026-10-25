import { queryOptions } from "@tanstack/react-query";

import { apiGet, apiPost } from "@/lib/api/client";
import type { PathParams, QueryParams, SuccessResponse } from "@/lib/api/operation-types";

type ListOp = "list_payments_api_v1_admin_payments_get";
type FailuresOp = "list_payment_failures_api_v1_admin_payments_failures_get";
type RefundsOp = "list_refunds_api_v1_admin_payments_refunds_get";
type RefundPreviewOp = "refund_preview_api_v1_admin_payments_orders__order_ref__refund_preview_get";
type PaymentOp = "get_payment_api_v1_admin_payments__payment_ref__get";
type ReconcileOp = "reconcile_payment_api_v1_admin_payments__payment_ref__reconcile_post";

/**
 * A payment of either system: a B2C payment intent, or a legacy order that reached a gateway
 * (`source` = `legacy`, `provider_reference` = its Stripe/Tamara id). Addressed by `ref`.
 */
export type AdminPayment = SuccessResponse<ListOp>["items"][number];
export type AdminPaymentPage = SuccessResponse<ListOp>;
export type PaymentsParams = QueryParams<ListOp>;
export type AdminPaymentFailure = SuccessResponse<FailuresOp>["items"][number];
export type AdminPaymentFailurePage = SuccessResponse<FailuresOp>;
export type PaymentFailuresParams = QueryParams<FailuresOp>;
export type AdminRefund = SuccessResponse<RefundsOp>["items"][number];
export type AdminRefundPage = SuccessResponse<RefundsOp>;
export type RefundsParams = QueryParams<RefundsOp>;
export type AdminRefundPreview = SuccessResponse<RefundPreviewOp>;
/** One payment with its gateway attempts and refunds (B2C). */
export type AdminPaymentIntent = SuccessResponse<PaymentOp>;
export type AdminPaymentIntentParams = PathParams<PaymentOp>;

export const paymentsPaths = {
  list: "admin/payments",
  failures: "admin/payments/failures",
  refunds: "admin/payments/refunds",
  refundPreview: "admin/payments/orders/{order_ref}/refund-preview",
  payment: "admin/payments/{payment_ref}",
  reconcile: "admin/payments/{payment_ref}/reconcile",
} as const;

export const paymentsKeys = {
  all: ["sales", "payments"] as const,
  list: (params?: PaymentsParams) => [...paymentsKeys.all, "list", params ?? {}] as const,
  failures: (params?: PaymentFailuresParams) => [...paymentsKeys.all, "failures", params ?? {}] as const,
  refunds: (params?: RefundsParams) => [...paymentsKeys.all, "refunds", params ?? {}] as const,
  refundPreview: (orderRef: string) => [...paymentsKeys.all, "refund-preview", orderRef] as const,
  intent: (paymentRef: string) => [...paymentsKeys.all, "payment", paymentRef] as const,
};

/** `GET /admin/payments` — B2C intents and legacy gateway orders, newest first. */
export function listPayments(params: PaymentsParams = {}): Promise<AdminPaymentPage> {
  return apiGet(paymentsPaths.list, { query: params });
}

export function listPaymentFailures(params: PaymentFailuresParams = {}): Promise<AdminPaymentFailurePage> {
  return apiGet(paymentsPaths.failures, { query: params });
}

export function listRefunds(params: RefundsParams = {}): Promise<AdminRefundPage> {
  return apiGet(paymentsPaths.refunds, { query: params });
}

/** `GET /admin/payments/orders/{order_ref}/refund-preview` — B2C orders only. */
export function getRefundPreview(
  order_ref: PathParams<RefundPreviewOp>["order_ref"],
): Promise<AdminRefundPreview> {
  return apiGet(paymentsPaths.refundPreview, { path: { order_ref } });
}

export function getPaymentIntent(payment_ref: PathParams<PaymentOp>["payment_ref"]): Promise<AdminPaymentIntent> {
  return apiGet(paymentsPaths.payment, { path: { payment_ref } });
}

/** `POST /admin/payments/{payment_ref}/reconcile` — re-queries the gateway (B2C payments only). */
export function reconcilePaymentIntent(
  payment_ref: PathParams<ReconcileOp>["payment_ref"],
): Promise<AdminPaymentIntent> {
  return apiPost(paymentsPaths.reconcile, { path: { payment_ref } });
}

export const paymentsQueries = {
  list: (params?: PaymentsParams) =>
    queryOptions({ queryKey: paymentsKeys.list(params), queryFn: () => listPayments(params) }),
  failures: (params?: PaymentFailuresParams) =>
    queryOptions({ queryKey: paymentsKeys.failures(params), queryFn: () => listPaymentFailures(params) }),
  refunds: (params?: RefundsParams) =>
    queryOptions({ queryKey: paymentsKeys.refunds(params), queryFn: () => listRefunds(params) }),
  refundPreview: (orderRef: string) =>
    queryOptions({ queryKey: paymentsKeys.refundPreview(orderRef), queryFn: () => getRefundPreview(orderRef) }),
  intent: (paymentRef: string) =>
    queryOptions({ queryKey: paymentsKeys.intent(paymentRef), queryFn: () => getPaymentIntent(paymentRef) }),
};
