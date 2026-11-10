import { queryOptions } from "@tanstack/react-query";

import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api/client";
import type { QueryParams, RequestBody, SuccessResponse } from "@/lib/api/operation-types";

type ListPartnersOp = "list_partners_api_v1_admin_affiliates_partners_get";
type CreatePartnerOp = "create_partner_api_v1_admin_affiliates_partners_post";
type GetPartnerOp = "get_partner_api_v1_admin_affiliates_partners__partner_id__get";
type PartnerCustomersOp = "partner_customers_api_v1_admin_affiliates_partners__partner_id__customers_get";
type PartnerCouponsOp = "partner_coupons_api_v1_admin_affiliates_partners__partner_id__coupons_get";
type CreatePartnerCouponOp = "create_partner_coupon_api_v1_admin_affiliates_partners__partner_id__coupons_post";
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
type PayoutBatchesOp = "list_payout_batches_api_v1_admin_affiliates_payout_batches_get";
type PayoutBatchOp = "get_payout_batch_api_v1_admin_affiliates_payout_batches__batch_id__get";
type PartnerPayoutsOp = "partner_payouts_api_v1_admin_affiliates_partners__partner_id__payouts_get";
type SenderStatusOp = "payout_sender_status_api_v1_admin_affiliates_payouts_sender_status_get";

export type PartnersParams = QueryParams<ListPartnersOp>;
export type PartnerPage = SuccessResponse<ListPartnersOp>;
export type Partner = SuccessResponse<GetPartnerOp>;
export type PartnerInput = RequestBody<CreatePartnerOp>;
export type PartnerAttribution = SuccessResponse<PartnerCustomersOp>["items"][number];
export type PartnerAttributionPage = SuccessResponse<PartnerCustomersOp>;
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
export type PayoutBatchPage = SuccessResponse<PayoutBatchesOp>;
export type PayoutBatch = PayoutBatchPage["items"][number];
export type PayoutBatchDetail = SuccessResponse<PayoutBatchOp>;
export type PartnerPayoutPage = SuccessResponse<PartnerPayoutsOp>;
export type AffiliatePayout = PartnerPayoutPage["items"][number];
export type PayoutSenderStatus = SuccessResponse<SenderStatusOp>;

export const affiliatesPaths = {
  partners: "admin/affiliates/partners",
  partner: "admin/affiliates/partners/{partner_id}",
  partnerStatus: "admin/affiliates/partners/{partner_id}/status",
  partnerCommission: "admin/affiliates/partners/{partner_id}/commission",
  partnerPayoutHold: "admin/affiliates/partners/{partner_id}/payout-hold",
  partnerPayouts: "admin/affiliates/partners/{partner_id}/payouts",
  partnerCustomers: "admin/affiliates/partners/{partner_id}/customers",
  partnerCoupons: "admin/affiliates/partners/{partner_id}/coupons",
  attribution: "admin/affiliates/attributions/{customer_id}",
  attributions: "admin/affiliates/attributions",
  conversions: "admin/affiliates/conversions",
  commissions: "admin/affiliates/commissions",
  commission: "admin/affiliates/commissions/{commission_id}",
  payoutBatches: "admin/affiliates/payout-batches",
  payoutBatch: "admin/affiliates/payout-batches/{batch_id}",
  runPayoutBatch: "admin/affiliates/payout-batches/run",
  payoutSenderStatus: "admin/affiliates/payouts/sender-status",
  confirmPayout: "admin/affiliates/payouts/{payout_id}/confirm",
  cancelPayout: "admin/affiliates/payouts/{payout_id}/cancel",
  referralProgram: "admin/affiliates/referral-program",
  affiliateProgram: "admin/affiliates/program",
  referralRewards: "admin/affiliates/referral-rewards",
  grantReward: "admin/affiliates/referral-rewards/{reward_id}/grant",
  legacyPreview: "admin/affiliates/import/legacy/preview",
  legacyImport: "admin/affiliates/import/legacy",
  analytics: "admin/affiliates/analytics",
  customerReferrals: "admin/affiliates/customers/{customer_id}",
} as const;

export const affiliatesKeys = {
  all: ["marketing", "affiliates"] as const,
  partners: (params?: PartnersParams) => [...affiliatesKeys.all, "partners", params ?? {}] as const,
  partner: (id: string) => [...affiliatesKeys.all, "partner", id] as const,
  partnerCustomers: (id: string) => [...affiliatesKeys.all, "partner-customers", id] as const,
  partnerCoupons: (id: string) => [...affiliatesKeys.all, "partner-coupons", id] as const,
  partnerPayouts: (id: string) => [...affiliatesKeys.all, "partner-payouts", id] as const,
  payoutBatches: (params?: object) => [...affiliatesKeys.all, "payout-batches", params ?? {}] as const,
  payoutBatch: (id: string) => [...affiliatesKeys.all, "payout-batch", id] as const,
  payoutSenderStatus: () => [...affiliatesKeys.all, "payout-sender-status"] as const,
  attribution: (customerId: string) => [...affiliatesKeys.all, "attribution", customerId] as const,
  conversions: (params?: ConversionsParams) => [...affiliatesKeys.all, "conversions", params ?? {}] as const,
  commissions: (params?: CommissionsParams) => [...affiliatesKeys.all, "commissions", params ?? {}] as const,
  referralProgram: () => [...affiliatesKeys.all, "referral-program"] as const,
  rewards: (params?: RewardsParams) => [...affiliatesKeys.all, "rewards", params ?? {}] as const,
  analytics: (params?: object) => [...affiliatesKeys.all, "analytics", params ?? {}] as const,
  customerReferrals: (customerId: string) => [...affiliatesKeys.all, "customer-referrals", customerId] as const,
};

/** `GET /admin/affiliates/partners` — marketers and student referrers. */
export const listPartners = (params: PartnersParams = {}): Promise<PartnerPage> =>
  apiGet(affiliatesPaths.partners, { query: params });
/** `POST /admin/affiliates/partners` — creates the marketer and its `?ref=` code. Audited. */
export const createPartner = (body: PartnerInput): Promise<Partner> => apiPost(affiliatesPaths.partners, { body });
export const getPartner = (partner_id: string): Promise<Partner> =>
  apiGet(affiliatesPaths.partner, { path: { partner_id } });
export const updatePartner = (partner_id: string, body: PartnerInput): Promise<Partner> =>
  apiPut(affiliatesPaths.partner, { path: { partner_id }, body });
export const archivePartner = (partner_id: string): Promise<Partner> =>
  apiDelete(affiliatesPaths.partner, { path: { partner_id } });
/** Activate, suspend or reject. Suspended partners are not paid out. */
export const setPartnerStatus = (partner_id: string, status: "active" | "suspended" | "rejected"): Promise<Partner> =>
  apiPost(affiliatesPaths.partnerStatus, { path: { partner_id }, body: { status } });
/** The partner's own commission % for future sales; `null` = the program default. */
export const setPartnerCommission = (partner_id: string, commission_percent: number | null): Promise<Partner> =>
  apiPut(affiliatesPaths.partnerCommission, { path: { partner_id }, body: { commission_percent } });
/** Pause (or resume) automatic payouts to one partner. Commissions keep accruing. */
export const setPartnerPayoutHold = (partner_id: string, hold: boolean, reason?: string | null): Promise<Partner> =>
  apiPost(affiliatesPaths.partnerPayoutHold, { path: { partner_id }, body: { hold, reason: reason ?? null } });
export const listPartnerPayouts = (
  partner_id: string,
  params: { limit?: number; offset?: number } = {},
): Promise<PartnerPayoutPage> => apiGet(affiliatesPaths.partnerPayouts, { path: { partner_id }, query: params });
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
export const getCustomerAttribution = (customer_id: string): Promise<SuccessResponse<AttributionOp>> =>
  apiGet(affiliatesPaths.attribution, { path: { customer_id } });
export const assignCustomer = (body: AssignInput): Promise<void> => apiPost(affiliatesPaths.attributions, { body });
export const unassignCustomer = (customer_id: string): Promise<void> =>
  apiDelete(affiliatesPaths.attribution, { path: { customer_id } });
export const listConversions = (params: ConversionsParams = {}): Promise<ConversionPage> =>
  apiGet(affiliatesPaths.conversions, { query: params });
export const listAffiliateCommissions = (params: CommissionsParams = {}): Promise<CommissionPage> =>
  apiGet(affiliatesPaths.commissions, { query: params });
/** Reverse a commission (fraud); clawed back from the next payout when already paid. */
export const declineAffiliateCommission = (commission_id: string): Promise<void> =>
  apiPost(affiliatesPaths.commission, { path: { commission_id }, body: { action: "decline" } });
/** Approve a pending commission now instead of after the refund hold. */
export const approveAffiliateCommission = (commission_id: string): Promise<void> =>
  apiPost(affiliatesPaths.commission, { path: { commission_id }, body: { action: "approve" } });
/** Monthly automatic Stripe payout batches (read-only). */
export const listPayoutBatches = (params: { limit?: number; offset?: number } = {}): Promise<PayoutBatchPage> =>
  apiGet(affiliatesPaths.payoutBatches, { query: params });
export const getPayoutBatch = (batch_id: string): Promise<PayoutBatchDetail> =>
  apiGet(affiliatesPaths.payoutBatch, { path: { batch_id } });
/** Run the payout batch now (after a failed run). 409 `payouts_disabled` while the switch is off. */
export const runPayoutBatch = (): Promise<{ workflow_id: string }> => apiPost(affiliatesPaths.runPayoutBatch);
/** Global Payouts financial accounts (USD) and the platform balance that funds Connect transfers. */
export const getPayoutSenderStatus = (): Promise<PayoutSenderStatus> => apiGet(affiliatesPaths.payoutSenderStatus);
/** Accept the FX rate and fees of a bank payout over the automatic fee limit. */
export const confirmAffiliatePayout = (payout_id: string): Promise<{ payout_id: string; status: string }> =>
  apiPost(affiliatesPaths.confirmPayout, { path: { payout_id } });
/** Stop a bank payout that has not posted; the amount returns to the affiliate's balance. */
export const cancelAffiliatePayout = (payout_id: string): Promise<{ payout_id: string; status: string }> =>
  apiPost(affiliatesPaths.cancelPayout, { path: { payout_id } });
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
export const getAffiliateAnalytics = (params: QueryParams<AnalyticsOp> = {}): Promise<AffiliateAnalytics> =>
  apiGet(affiliatesPaths.analytics, { query: params });

/** Who referred this customer, and (when they refer others) their link, counts and rewards. */
export const getCustomerReferrals = (customer_id: string): Promise<CustomerReferrals> =>
  apiGet(affiliatesPaths.customerReferrals, { path: { customer_id } });

export const affiliatesQueries = {
  customerReferrals: (customerId: string) =>
    queryOptions({ queryKey: affiliatesKeys.customerReferrals(customerId), queryFn: () => getCustomerReferrals(customerId) }),
  partner: (id: string) => queryOptions({ queryKey: affiliatesKeys.partner(id), queryFn: () => getPartner(id) }),
  partnerPayouts: (id: string) =>
    queryOptions({ queryKey: affiliatesKeys.partnerPayouts(id), queryFn: () => listPartnerPayouts(id, { limit: 50 }) }),
  payoutBatches: (params: { limit?: number; offset?: number } = {}) =>
    queryOptions({ queryKey: affiliatesKeys.payoutBatches(params), queryFn: () => listPayoutBatches(params) }),
  payoutBatch: (id: string) => queryOptions({ queryKey: affiliatesKeys.payoutBatch(id), queryFn: () => getPayoutBatch(id) }),
  payoutSenderStatus: () =>
    queryOptions({ queryKey: affiliatesKeys.payoutSenderStatus(), queryFn: getPayoutSenderStatus, staleTime: 60_000, retry: false }),
  partnerCoupons: (id: string) =>
    queryOptions({ queryKey: affiliatesKeys.partnerCoupons(id), queryFn: () => listPartnerCoupons(id) }),
  attribution: (customerId: string) =>
    queryOptions({ queryKey: affiliatesKeys.attribution(customerId), queryFn: () => getCustomerAttribution(customerId) }),
  referralProgram: () => queryOptions({ queryKey: affiliatesKeys.referralProgram(), queryFn: getReferralProgram }),
  affiliateProgram: () =>
    queryOptions({ queryKey: [...affiliatesKeys.all, "program-settings"] as const, queryFn: getAffiliateProgramSettings }),
  analytics: (params: QueryParams<AnalyticsOp> = {}) =>
    queryOptions({ queryKey: affiliatesKeys.analytics(params), queryFn: () => getAffiliateAnalytics(params) }),
};
