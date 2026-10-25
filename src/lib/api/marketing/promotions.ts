import { queryOptions } from "@tanstack/react-query";

import { apiGet, apiPost } from "@/lib/api/client";
import type { PathParams, QueryParams, RequestBody, SuccessResponse } from "@/lib/api/operation-types";

type ListPromotionsOp = "list_promotions_api_v1_admin_promotions_get";
type CreatePromotionOp = "create_promotion_api_v1_admin_promotions_post";
type GetPromotionOp = "get_promotion_api_v1_admin_promotions__legacy_coupon_id__get";
type SetPromotionActiveOp = "set_promotion_active_api_v1_admin_promotions__legacy_coupon_id__active_post";
type ListOffersOp = "list_offers_api_v1_admin_promotions_offers_get";
type GetOfferOp = "get_offer_api_v1_admin_promotions_offers__legacy_offer_id__get";

export type PromotionsParams = QueryParams<ListPromotionsOp>;
export type PromotionPage = SuccessResponse<ListPromotionsOp>;
export type ActiveRequest = RequestBody<SetPromotionActiveOp>;
export type CreatePromotionRequest = RequestBody<CreatePromotionOp>;
export type Offer = SuccessResponse<GetOfferOp>;
export type OfferPage = SuccessResponse<ListOffersOp>;
export type OffersParams = QueryParams<ListOffersOp>;

export const promotionsPaths = {
  promotions: "admin/promotions",
  promotion: "admin/promotions/{legacy_coupon_id}",
  promotionActive: "admin/promotions/{legacy_coupon_id}/active",
  offers: "admin/promotions/offers",
  offer: "admin/promotions/offers/{legacy_offer_id}",
} as const;

export const promotionsKeys = {
  all: ["marketing", "promotions"] as const,
  list: (params?: PromotionsParams) => [...promotionsKeys.all, "list", params ?? {}] as const,
  detail: (legacyCouponId: number) => [...promotionsKeys.all, "detail", legacyCouponId] as const,
  offers: (params?: OffersParams) => [...promotionsKeys.all, "offers", params ?? {}] as const,
  offer: (legacyOfferId: number) => [...promotionsKeys.all, "offer", legacyOfferId] as const,
};

export function listPromotions(params: PromotionsParams = {}): Promise<PromotionPage> {
  return apiGet(promotionsPaths.promotions, { query: params });
}

/** `POST /admin/promotions` — creates a coupon (legacy platform, local mirror). Audited. */
export function createPromotion(body: CreatePromotionRequest): Promise<SuccessResponse<CreatePromotionOp>> {
  return apiPost(promotionsPaths.promotions, { body });
}

export function getPromotion(
  legacy_coupon_id: PathParams<GetPromotionOp>["legacy_coupon_id"],
): Promise<SuccessResponse<GetPromotionOp>> {
  return apiGet(promotionsPaths.promotion, { path: { legacy_coupon_id } });
}

/** `POST /admin/promotions/{id}/active` — activates or deactivates a coupon. Audited. */
export function setPromotionActive(
  legacy_coupon_id: PathParams<SetPromotionActiveOp>["legacy_coupon_id"],
  body: ActiveRequest,
): Promise<SuccessResponse<SetPromotionActiveOp>> {
  return apiPost(promotionsPaths.promotionActive, { path: { legacy_coupon_id }, body });
}

/** `GET /admin/promotions/offers` — storefront offers (threshold, discount, buy-x-get-y) with their rule. */
export function listOffers(params: OffersParams = {}): Promise<OfferPage> {
  return apiGet(promotionsPaths.offers, { query: params });
}

export function getOffer(legacy_offer_id: PathParams<GetOfferOp>["legacy_offer_id"]): Promise<Offer> {
  return apiGet(promotionsPaths.offer, { path: { legacy_offer_id } });
}

export const promotionsQueries = {
  list: (params?: PromotionsParams) =>
    queryOptions({ queryKey: promotionsKeys.list(params), queryFn: () => listPromotions(params) }),
  detail: (legacyCouponId: number) =>
    queryOptions({ queryKey: promotionsKeys.detail(legacyCouponId), queryFn: () => getPromotion(legacyCouponId) }),
  offers: (params?: OffersParams) =>
    queryOptions({ queryKey: promotionsKeys.offers(params), queryFn: () => listOffers(params) }),
  offer: (legacyOfferId: number) =>
    queryOptions({ queryKey: promotionsKeys.offer(legacyOfferId), queryFn: () => getOffer(legacyOfferId) }),
};
