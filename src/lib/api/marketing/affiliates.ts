import { queryOptions } from "@tanstack/react-query";

import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api/client";
import type { QueryParams, RequestBody, SuccessResponse } from "@/lib/api/operation-types";

type ListPartnersOp = "list_partners_api_v1_admin_affiliates_partners_get";
type CreatePartnerOp = "create_partner_api_v1_admin_affiliates_partners_post";
type GetPartnerOp = "get_partner_api_v1_admin_affiliates_partners__partner_id__get";
type PartnerCustomersOp = "partner_customers_api_v1_admin_affiliates_partners__partner_id__customers_get";
type PartnerCouponsOp = "partner_coupons_api_v1_admin_affiliates_partners__partner_id__coupons_get";
type CreatePartnerCouponOp = "create_partner_coupon_api_v1_admin_affiliates_partners__partner_id__coupons_post";
type GroupsOp = "tolt_groups_api_v1_admin_affiliates_groups_get";
type AttributionOp = "customer_attribution_api_v1_admin_affiliates_attributions__customer_id__get";
type AssignOp = "assign_customer_api_v1_admin_affiliates_attributions_post";
type ConversionsOp = "list_conversions_api_v1_admin_affiliates_conversions_get";
type CommissionsOp = "list_commissions_api_v1_admin_affiliates_commissions_get";
type ReferralProgramOp = "get_referral_program_api_v1_admin_affiliates_referral_program_get";
type SaveReferralProgramOp = "save_referral_program_api_v1_admin_affiliates_referral_program_put";
type RewardsOp = "list_referral_rewards_api_v1_admin_affiliates_referral_rewards_get";
type LegacyPreviewOp = "legacy_preview_api_v1_admin_affiliates_import_legacy_preview_post";
type AnalyticsOp = "affiliate_analytics_api_v1_admin_affiliates_analytics_get";
type CustomerReferralsOp = "customer_referrals_api_v1_admin_affiliates_customers__customer_id__get";
type AffiliateProgramOp = "get_affiliate_program_settings_api_v1_admin_affiliates_program_get";
type SaveAffiliateProgramOp = "save_affiliate_program_settings_api_v1_admin_affiliates_program_put";
type PayoutsOp = "list_payouts_api_v1_admin_affiliates_payouts_get";
type PayoutsSummaryOp = "payouts_summary_api_v1_admin_affiliates_payouts_summary_get";
type PayoutOp = "get_payout_api_v1_admin_affiliates_payouts__payout_id__get";
type PayPayoutOp = "pay_payout_api_v1_admin_affiliates_payouts__payout_id__pay_post";
type PartnerBalanceOp = "partner_balance_api_v1_admin_affiliates_partners__partner_id__balance_get";
type PartnerLedgerOp = "partner_ledger_api_v1_admin_affiliates_partners__partner_id__ledger_get";

export type PartnersParams = QueryParams<ListPartnersOp>;
export type PartnerPage = SuccessResponse<ListPartnersOp>;
export type Partner = SuccessResponse<GetPartnerOp>;
export type PartnerInput = RequestBody<CreatePartnerOp>;
export type PartnerAttribution = SuccessResponse<PartnerCustomersOp>["items"][number];
export type PartnerAttributionPage = SuccessResponse<PartnerCustomersOp>;
export type ToltGroup = SuccessResponse<GroupsOp>[number];
export type ConversionsParams = QueryParams<ConversionsOp>;
export type ConversionPage = SuccessResponse<ConversionsOp>;
export type Conversion = ConversionPage["items"][number];
export type CommissionsParams = QueryParams<CommissionsOp>;
export type CommissionPage = SuccessResponse<CommissionsOp>;
export type AffiliateCommission = CommissionPage["items"][number];
export type ReferralProgram = SuccessResponse<ReferralProgramOp>;
export type RewardsParams = QueryParams<RewardsOp>;
export type ReferralRewardPage = SuccessResponse<RewardsOp>;
export type ReferralReward = ReferralRewardPage["items"][number];
export type LegacyPreview = SuccessResponse<LegacyPreviewOp>;
export type AffiliateAnalytics = SuccessResponse<AnalyticsOp>;
export type AssignInput = RequestBody<AssignOp>;
export type CustomerReferrals = SuccessResponse<CustomerReferralsOp>;
export type AffiliateProgramSettings = SuccessResponse<AffiliateProgramOp>;
export type AffiliateProgramSettingsInput = RequestBody<SaveAffiliateProgramOp>;
export type PayoutsParams = QueryParams<PayoutsOp>;
export type PayoutPage = SuccessResponse<PayoutsOp>;
export type AffiliatePayout = PayoutPage["items"][number];
export type PayoutsSummary = SuccessResponse<PayoutsSummaryOp>;
export type PayoutReview = SuccessResponse<PayoutOp>;
export type PayoutPayInput = RequestBody<PayPayoutOp>;
export type PartnerBalance = SuccessResponse<PartnerBalanceOp>;
export type LedgerPage = SuccessResponse<PartnerLedgerOp>;
export type LedgerEntry = LedgerPage["items"][number];

export const affiliatesPaths = {
  partners: "admin/affiliates/partners",
  partner: "admin/affiliates/partners/{partner_id}",
  partnerStatus: "admin/affiliates/partners/{partner_id}/status",
  partnerResync: "admin/affiliates/partners/{partner_id}/resync",
  partnerCustomers: "admin/affiliates/partners/{partner_id}/customers",
  partnerCoupons: "admin/affiliates/partners/{partner_id}/coupons",
  groups: "admin/affiliates/groups",
  attribution: "admin/affiliates/attributions/{customer_id}",
  attributions: "admin/affiliates/attributions",
  conversions: "admin/affiliates/conversions",
  commissions: "admin/affiliates/commissions",
  commission: "admin/affiliates/commissions/{commission_id}",
  sync: "admin/affiliates/sync",
  referralProgram: "admin/affiliates/referral-program",
  affiliateProgram: "admin/affiliates/program",
  referralRewards: "admin/affiliates/referral-rewards",
  grantReward: "admin/affiliates/referral-rewards/{reward_id}/grant",
  legacyPreview: "admin/affiliates/import/legacy/preview",
  legacyImport: "admin/affiliates/import/legacy",
  legacyPush: "admin/affiliates/import/legacy/push",
  analytics: "admin/affiliates/analytics",
  customerReferrals: "admin/affiliates/customers/{customer_id}",
  payouts: "admin/affiliates/payouts",
  payoutsSummary: "admin/affiliates/payouts/summary",
  payout: "admin/affiliates/payouts/{payout_id}",
  payoutApprove: "admin/affiliates/payouts/{payout_id}/approve",
  payoutReject: "admin/affiliates/payouts/{payout_id}/reject",
  payoutPay: "admin/affiliates/payouts/{payout_id}/pay",
  partnerBalance: "admin/affiliates/partners/{partner_id}/balance",
  partnerLedger: "admin/affiliates/partners/{partner_id}/ledger",
} as const;

export const affiliatesKeys = {
  all: ["marketing", "affiliates"] as const,
  partners: (params?: PartnersParams) => [...affiliatesKeys.all, "partners", params ?? {}] as const,
  partner: (id: string) => [...affiliatesKeys.all, "partner", id] as const,
  partnerCustomers: (id: string) => [...affiliatesKeys.all, "partner-customers", id] as const,
  partnerCoupons: (id: string) => [...affiliatesKeys.all, "partner-coupons", id] as const,
  groups: () => [...affiliatesKeys.all, "groups"] as const,
  attribution: (customerId: string) => [...affiliatesKeys.all, "attribution", customerId] as const,
  conversions: (params?: ConversionsParams) => [...affiliatesKeys.all, "conversions", params ?? {}] as const,
  commissions: (params?: CommissionsParams) => [...affiliatesKeys.all, "commissions", params ?? {}] as const,
  referralProgram: () => [...affiliatesKeys.all, "referral-program"] as const,
  rewards: (params?: RewardsParams) => [...affiliatesKeys.all, "rewards", params ?? {}] as const,
  analytics: (params?: object) => [...affiliatesKeys.all, "analytics", params ?? {}] as const,
  customerReferrals: (customerId: string) => [...affiliatesKeys.all, "customer-referrals", customerId] as const,
  payouts: (params?: PayoutsParams) => [...affiliatesKeys.all, "payouts", params ?? {}] as const,
  payoutsSummary: () => [...affiliatesKeys.all, "payouts-summary"] as const,
  payout: (id: string) => [...affiliatesKeys.all, "payout", id] as const,
  partnerBalance: (id: string) => [...affiliatesKeys.all, "partner-balance", id] as const,
  partnerLedger: (id: string, params?: object) => [...affiliatesKeys.all, "partner-ledger", id, params ?? {}] as const,
};

/** `GET /admin/affiliates/partners` — marketers and student referrers (B2C, synced to Tolt). */
export const listPartners = (params: PartnersParams = {}): Promise<PartnerPage> =>
  apiGet(affiliatesPaths.partners, { query: params });
/** `POST /admin/affiliates/partners` — creates the marketer here and in Tolt. Audited. */
export const createPartner = (body: PartnerInput): Promise<Partner> => apiPost(affiliatesPaths.partners, { body });
export const getPartner = (partner_id: string): Promise<Partner> =>
  apiGet(affiliatesPaths.partner, { path: { partner_id } });
export const updatePartner = (partner_id: string, body: PartnerInput): Promise<Partner> =>
  apiPut(affiliatesPaths.partner, { path: { partner_id }, body });
export const archivePartner = (partner_id: string): Promise<Partner> =>
  apiDelete(affiliatesPaths.partner, { path: { partner_id } });
/** Approve (`active`), suspend or reject — mirrored to Tolt. */
export const setPartnerStatus = (partner_id: string, status: "active" | "suspended" | "rejected"): Promise<Partner> =>
  apiPost(affiliatesPaths.partnerStatus, { path: { partner_id }, body: { status } });
export const resyncPartner = (partner_id: string): Promise<Partner> =>
  apiPost(affiliatesPaths.partnerResync, { path: { partner_id } });
export const listPartnerCustomers = (
  partner_id: string,
  params: { limit?: number; offset?: number } = {},
): Promise<PartnerAttributionPage> => apiGet(affiliatesPaths.partnerCustomers, { path: { partner_id }, query: params });
export const listPartnerCoupons = (partner_id: string): Promise<SuccessResponse<PartnerCouponsOp>> =>
  apiGet(affiliatesPaths.partnerCoupons, { path: { partner_id } });
export const createPartnerCoupon = (
  partner_id: string,
  body: RequestBody<CreatePartnerCouponOp>,
): Promise<SuccessResponse<CreatePartnerCouponOp>> => apiPost(affiliatesPaths.partnerCoupons, { path: { partner_id }, body });
export const listToltGroups = (): Promise<ToltGroup[]> => apiGet(affiliatesPaths.groups);
export const getCustomerAttribution = (customer_id: string): Promise<SuccessResponse<AttributionOp>> =>
  apiGet(affiliatesPaths.attribution, { path: { customer_id } });
export const assignCustomer = (body: AssignInput): Promise<void> => apiPost(affiliatesPaths.attributions, { body });
export const unassignCustomer = (customer_id: string): Promise<void> =>
  apiDelete(affiliatesPaths.attribution, { path: { customer_id } });
export const listConversions = (params: ConversionsParams = {}): Promise<ConversionPage> =>
  apiGet(affiliatesPaths.conversions, { query: params });
export const listAffiliateCommissions = (params: CommissionsParams = {}): Promise<CommissionPage> =>
  apiGet(affiliatesPaths.commissions, { query: params });
export const setAffiliateCommission = (commission_id: string, action: "approve" | "decline"): Promise<void> =>
  apiPost(affiliatesPaths.commission, { path: { commission_id }, body: { action } });
/** Push everything pending to Tolt and pull commissions now. */
export const syncAffiliates = (): Promise<Record<string, number>> => apiPost(affiliatesPaths.sync);
export const getReferralProgram = (): Promise<ReferralProgram> => apiGet(affiliatesPaths.referralProgram);
export const saveReferralProgram = (body: RequestBody<SaveReferralProgramOp>): Promise<ReferralProgram> =>
  apiPut(affiliatesPaths.referralProgram, { body });
export const getAffiliateProgramSettings = (): Promise<AffiliateProgramSettings> => apiGet(affiliatesPaths.affiliateProgram);
export const saveAffiliateProgramSettings = (body: AffiliateProgramSettingsInput): Promise<AffiliateProgramSettings> =>
  apiPut(affiliatesPaths.affiliateProgram, { body });
export const listReferralRewards = (params: RewardsParams = {}): Promise<ReferralRewardPage> =>
  apiGet(affiliatesPaths.referralRewards, { query: params });
export const grantReferralReward = (reward_id: string): Promise<{ granted: number }> =>
  apiPost(affiliatesPaths.grantReward, { path: { reward_id } });
export const previewLegacyAffiliates = (only_approved: boolean): Promise<LegacyPreview> =>
  apiPost(affiliatesPaths.legacyPreview, { body: { only_approved } });
export const importLegacyAffiliates = (only_approved: boolean): Promise<{ imported: number; skipped: number }> =>
  apiPost(affiliatesPaths.legacyImport, { body: { only_approved } });
export const pushLegacyAffiliates = (limit: number): Promise<{ attempted: number; pushed: number }> =>
  apiPost(affiliatesPaths.legacyPush, { body: { limit } });
export const getAffiliateAnalytics = (params: QueryParams<AnalyticsOp> = {}): Promise<AffiliateAnalytics> =>
  apiGet(affiliatesPaths.analytics, { query: params });

/** Who referred this customer, and (when they refer others) their link, counts and rewards. */
export const getCustomerReferrals = (customer_id: string): Promise<CustomerReferrals> =>
  apiGet(affiliatesPaths.customerReferrals, { path: { customer_id } });

/** `GET /admin/affiliates/payouts` — marketer payout requests (local ledger). `status` takes a status or `open`. */
export const listAffiliatePayouts = (params: PayoutsParams = {}): Promise<PayoutPage> =>
  apiGet(affiliatesPaths.payouts, { query: params });
export const getPayoutsSummary = (): Promise<PayoutsSummary> => apiGet(affiliatesPaths.payoutsSummary);
/** The request with full payout details, the marketer's balance and recent ledger entries. */
export const getAffiliatePayout = (payout_id: string): Promise<PayoutReview> =>
  apiGet(affiliatesPaths.payout, { path: { payout_id } });
export const approveAffiliatePayout = (payout_id: string, note?: string): Promise<PayoutReview> =>
  apiPost(affiliatesPaths.payoutApprove, { path: { payout_id }, body: { note: note || null } });
/** The whole amount returns to the marketer's available balance. Audited. */
export const rejectAffiliatePayout = (payout_id: string, reason: string): Promise<PayoutReview> =>
  apiPost(affiliatesPaths.payoutReject, { path: { payout_id }, body: { reason } });
/** Record a transfer made outside the platform, in full or in part (amount or percent). Audited. */
export const payAffiliatePayout = (payout_id: string, body: PayoutPayInput): Promise<PayoutReview> =>
  apiPost(affiliatesPaths.payoutPay, { path: { payout_id }, body });
export const getPartnerBalance = (partner_id: string): Promise<PartnerBalance> =>
  apiGet(affiliatesPaths.partnerBalance, { path: { partner_id } });
export const listPartnerLedger = (
  partner_id: string,
  params: { limit?: number; offset?: number } = {},
): Promise<LedgerPage> => apiGet(affiliatesPaths.partnerLedger, { path: { partner_id }, query: params });

export const affiliatesQueries = {
  customerReferrals: (customerId: string) =>
    queryOptions({ queryKey: affiliatesKeys.customerReferrals(customerId), queryFn: () => getCustomerReferrals(customerId) }),
  partner: (id: string) => queryOptions({ queryKey: affiliatesKeys.partner(id), queryFn: () => getPartner(id) }),
  groups: () => queryOptions({ queryKey: affiliatesKeys.groups(), queryFn: listToltGroups, staleTime: 5 * 60_000 }),
  partnerCoupons: (id: string) =>
    queryOptions({ queryKey: affiliatesKeys.partnerCoupons(id), queryFn: () => listPartnerCoupons(id) }),
  attribution: (customerId: string) =>
    queryOptions({ queryKey: affiliatesKeys.attribution(customerId), queryFn: () => getCustomerAttribution(customerId) }),
  referralProgram: () => queryOptions({ queryKey: affiliatesKeys.referralProgram(), queryFn: getReferralProgram }),
  affiliateProgram: () =>
    queryOptions({ queryKey: [...affiliatesKeys.all, "program-settings"] as const, queryFn: getAffiliateProgramSettings }),
  analytics: (params: QueryParams<AnalyticsOp> = {}) =>
    queryOptions({ queryKey: affiliatesKeys.analytics(params), queryFn: () => getAffiliateAnalytics(params) }),
  payoutsSummary: () => queryOptions({ queryKey: affiliatesKeys.payoutsSummary(), queryFn: getPayoutsSummary }),
  payout: (id: string) => queryOptions({ queryKey: affiliatesKeys.payout(id), queryFn: () => getAffiliatePayout(id) }),
  partnerBalance: (id: string) =>
    queryOptions({ queryKey: affiliatesKeys.partnerBalance(id), queryFn: () => getPartnerBalance(id) }),
};
