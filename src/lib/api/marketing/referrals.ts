import { queryOptions } from "@tanstack/react-query";

import { apiGet, apiPost } from "@/lib/api/client";
import type { PathParams, QueryParams, RequestBody, SuccessResponse } from "@/lib/api/operation-types";

type ListPartnersOp = "list_partners_api_v1_admin_referrals_partners_get";
type GetPartnerOp = "get_partner_api_v1_admin_referrals_partners__legacy_affiliate_id__get";
type SetPartnerStatusOp = "set_partner_status_api_v1_admin_referrals_partners__legacy_affiliate_id__status_post";
type ListPayoutsOp = "list_payouts_api_v1_admin_referrals_payouts_get";
type SetPayoutStatusOp = "set_payout_status_api_v1_admin_referrals_payouts__legacy_payment_id__status_post";
type CommissionsOp = "list_commissions_api_v1_admin_referrals_commissions_get";
type PoliciesOp = "list_policies_api_v1_admin_referrals_policies_get";

export type ReferralPartnersParams = QueryParams<ListPartnersOp>;
export type ReferralPartnerPage = SuccessResponse<ListPartnersOp>;
export type ReferralPartnerProfile = SuccessResponse<GetPartnerOp>;
export type PartnerStatusRequest = RequestBody<SetPartnerStatusOp>;
export type ReferralPayoutsParams = QueryParams<ListPayoutsOp>;
export type ReferralPayoutPage = SuccessResponse<ListPayoutsOp>;
export type PayoutStatusRequest = RequestBody<SetPayoutStatusOp>;
export type ReferralCommissionsParams = QueryParams<CommissionsOp>;
export type ReferralCommissionPage = SuccessResponse<CommissionsOp>;
export type ReferralPolicyPage = SuccessResponse<PoliciesOp>;

export const referralsPaths = {
  partners: "admin/referrals/partners",
  partner: "admin/referrals/partners/{legacy_affiliate_id}",
  partnerStatus: "admin/referrals/partners/{legacy_affiliate_id}/status",
  payouts: "admin/referrals/payouts",
  payoutStatus: "admin/referrals/payouts/{legacy_payment_id}/status",
  commissions: "admin/referrals/commissions",
  policies: "admin/referrals/policies",
} as const;

export const referralsKeys = {
  all: ["marketing", "referrals"] as const,
  partners: (params?: ReferralPartnersParams) => [...referralsKeys.all, "partners", params ?? {}] as const,
  partner: (legacyAffiliateId: number) => [...referralsKeys.all, "partner", legacyAffiliateId] as const,
  payouts: (params?: ReferralPayoutsParams) => [...referralsKeys.all, "payouts", params ?? {}] as const,
  commissions: (params?: ReferralCommissionsParams) => [...referralsKeys.all, "commissions", params ?? {}] as const,
  policies: () => [...referralsKeys.all, "policies"] as const,
};

export function listReferralPartners(params: ReferralPartnersParams = {}): Promise<ReferralPartnerPage> {
  return apiGet(referralsPaths.partners, { query: params });
}

/** `GET /admin/referrals/partners/{id}` — partner with payouts and coupons (bank details never returned). */
export function getReferralPartner(
  legacy_affiliate_id: PathParams<GetPartnerOp>["legacy_affiliate_id"],
): Promise<ReferralPartnerProfile> {
  return apiGet(referralsPaths.partner, { path: { legacy_affiliate_id } });
}

/** `POST /admin/referrals/partners/{id}/status` — approve a referral partner. Audited. */
export function setReferralPartnerStatus(
  legacy_affiliate_id: PathParams<SetPartnerStatusOp>["legacy_affiliate_id"],
  body: PartnerStatusRequest,
): Promise<SuccessResponse<SetPartnerStatusOp>> {
  return apiPost(referralsPaths.partnerStatus, { path: { legacy_affiliate_id }, body });
}

export function listReferralPayouts(params: ReferralPayoutsParams = {}): Promise<ReferralPayoutPage> {
  return apiGet(referralsPaths.payouts, { query: params });
}

/** `POST /admin/referrals/payouts/{id}/status` — legacy payout status (1 requested, 3 paid) + note. Audited. */
export function setReferralPayoutStatus(
  legacy_payment_id: PathParams<SetPayoutStatusOp>["legacy_payment_id"],
  body: PayoutStatusRequest,
): Promise<SuccessResponse<SetPayoutStatusOp>> {
  return apiPost(referralsPaths.payoutStatus, { path: { legacy_payment_id }, body });
}

export function listReferralCommissions(params: ReferralCommissionsParams = {}): Promise<ReferralCommissionPage> {
  return apiGet(referralsPaths.commissions, { query: params });
}

export function listReferralPolicies(): Promise<ReferralPolicyPage> {
  return apiGet(referralsPaths.policies);
}

export const referralsQueries = {
  partners: (params?: ReferralPartnersParams) =>
    queryOptions({ queryKey: referralsKeys.partners(params), queryFn: () => listReferralPartners(params) }),
  partner: (legacyAffiliateId: number) =>
    queryOptions({ queryKey: referralsKeys.partner(legacyAffiliateId), queryFn: () => getReferralPartner(legacyAffiliateId) }),
  payouts: (params?: ReferralPayoutsParams) =>
    queryOptions({ queryKey: referralsKeys.payouts(params), queryFn: () => listReferralPayouts(params) }),
  commissions: (params?: ReferralCommissionsParams) =>
    queryOptions({ queryKey: referralsKeys.commissions(params), queryFn: () => listReferralCommissions(params) }),
  policies: () => queryOptions({ queryKey: referralsKeys.policies(), queryFn: () => listReferralPolicies() }),
};
