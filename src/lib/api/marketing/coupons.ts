import { queryOptions } from "@tanstack/react-query";

import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api/client";
import type { QueryParams, RequestBody, SuccessResponse } from "@/lib/api/operation-types";

type ListCouponsOp = "list_coupons_api_v1_admin_coupons_get";
type CreateCouponOp = "create_coupon_api_v1_admin_coupons_post";
type GetCouponOp = "get_coupon_api_v1_admin_coupons__promotion_id__get";
type UpdateCouponOp = "update_coupon_api_v1_admin_coupons__promotion_id__put";
type SetCouponActiveOp = "set_coupon_active_api_v1_admin_coupons__promotion_id__active_put";
type ArchiveCouponOp = "archive_coupon_api_v1_admin_coupons__promotion_id__delete";
type CouponRedemptionsOp = "list_coupon_redemptions_api_v1_admin_coupons__promotion_id__redemptions_get";

export type CouponsParams = QueryParams<ListCouponsOp>;
export type CouponPage = SuccessResponse<ListCouponsOp>;
export type Coupon = SuccessResponse<GetCouponOp>;
export type CouponInput = RequestBody<CreateCouponOp>;
export type CouponRedemptionsParams = QueryParams<CouponRedemptionsOp>;
export type CouponRedemptionPage = SuccessResponse<CouponRedemptionsOp>;
export type CouponRedemption = CouponRedemptionPage["items"][number];

export const couponsPaths = {
  coupons: "admin/coupons",
  coupon: "admin/coupons/{promotion_id}",
  couponActive: "admin/coupons/{promotion_id}/active",
  redemptions: "admin/coupons/{promotion_id}/redemptions",
} as const;

export const couponsKeys = {
  all: ["marketing", "coupons"] as const,
  list: (params?: CouponsParams) => [...couponsKeys.all, "list", params ?? {}] as const,
  detail: (promotionId: string) => [...couponsKeys.all, "detail", promotionId] as const,
  redemptions: (promotionId: string, params?: CouponRedemptionsParams) =>
    [...couponsKeys.all, "redemptions", promotionId, params ?? {}] as const,
};

/** `GET /admin/coupons` — native (b2c) coupons with usage stats. */
export function listCoupons(params: CouponsParams = {}): Promise<CouponPage> {
  return apiGet(couponsPaths.coupons, { query: params });
}

/** `POST /admin/coupons` — creates a coupon used at checkout. Audited. */
export function createCoupon(body: CouponInput): Promise<SuccessResponse<CreateCouponOp>> {
  return apiPost(couponsPaths.coupons, { body });
}

export function getCoupon(promotion_id: string): Promise<Coupon> {
  return apiGet(couponsPaths.coupon, { path: { promotion_id } });
}

/** `PUT /admin/coupons/{id}` — code, type and value are locked once the coupon was used. Audited. */
export function updateCoupon(promotion_id: string, body: RequestBody<UpdateCouponOp>): Promise<SuccessResponse<UpdateCouponOp>> {
  return apiPut(couponsPaths.coupon, { path: { promotion_id }, body });
}

export function setCouponActive(promotion_id: string, is_active: boolean): Promise<SuccessResponse<SetCouponActiveOp>> {
  return apiPut(couponsPaths.couponActive, { path: { promotion_id }, body: { is_active } });
}

/** `DELETE /admin/coupons/{id}` — archives the coupon; redemptions and reports are kept. */
export function archiveCoupon(promotion_id: string): Promise<SuccessResponse<ArchiveCouponOp>> {
  return apiDelete(couponsPaths.coupon, { path: { promotion_id } });
}

export function listCouponRedemptions(
  promotion_id: string,
  params: CouponRedemptionsParams = {},
): Promise<CouponRedemptionPage> {
  return apiGet(couponsPaths.redemptions, { path: { promotion_id }, query: params });
}

export const couponsQueries = {
  list: (params?: CouponsParams) => queryOptions({ queryKey: couponsKeys.list(params), queryFn: () => listCoupons(params) }),
  detail: (promotionId: string) =>
    queryOptions({ queryKey: couponsKeys.detail(promotionId), queryFn: () => getCoupon(promotionId) }),
};
