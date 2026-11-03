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
/** Activate, suspend or reject — mirrored to Tolt. */
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
/** Decline a commission (e.g. after a partial refund). Tolt approves commissions itself. */
export const declineAffiliateCommission = (commission_id: string): Promise<void> =>
  apiPost(affiliatesPaths.commission, { path: { commission_id }, body: { action: "decline" } });
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
};
