import { queryOptions } from "@tanstack/react-query";

import { apiGet, apiPost, apiPut } from "@/lib/api/client";
import type { PathParams, QueryParams, RequestBody, SuccessResponse } from "@/lib/api/operation-types";

/** B2C subscription plans, subscribers and their stats (`/admin/subscriptions`). */

type PlansOp = "admin_list_subscription_plans_api_v1_admin_subscriptions_plans_get";
type CreatePlanOp = "admin_create_subscription_plan_api_v1_admin_subscriptions_plans_post";
type PlanOp = "admin_get_subscription_plan_api_v1_admin_subscriptions_plans__plan_id__get";
type PreviewPlanOp = "admin_preview_subscription_plan_api_v1_admin_subscriptions_plans__plan_id__preview_get";
type UpdatePlanOp = "admin_update_subscription_plan_api_v1_admin_subscriptions_plans__plan_id__put";
type SetProductsOp = "admin_set_subscription_plan_products_api_v1_admin_subscriptions_plans__plan_id__products_put";
type SetBenefitsOp = "admin_set_subscription_plan_benefits_api_v1_admin_subscriptions_plans__plan_id__benefits_put";
type SetStatusOp = "admin_set_subscription_plan_status_api_v1_admin_subscriptions_plans__plan_id__status_post";
type SetDiscountOp = "admin_set_subscription_plan_discount_api_v1_admin_subscriptions_plans__plan_id__discount_put";
type SetCardFeaturesOp =
  "admin_set_subscription_plan_card_features_api_v1_admin_subscriptions_plans__plan_id__card_features_put";
type DuplicateOp = "admin_duplicate_subscription_plan_api_v1_admin_subscriptions_plans__plan_id__duplicate_post";
type AbandonedOp =
  "admin_list_subscription_plan_abandoned_checkouts_api_v1_admin_subscriptions_plans__plan_id__abandoned_checkouts_get";
type OverviewOp = "admin_subscription_stats_overview_api_v1_admin_subscriptions_stats_overview_get";
type FunnelOp = "admin_subscription_stats_funnel_api_v1_admin_subscriptions_stats_funnel_get";
type CompanyInsightsOp =
  "admin_subscription_company_insights_api_v1_admin_subscriptions_stats_company_insights_get";
type SubscribersOp = "admin_list_customer_subscriptions_api_v1_admin_subscriptions_customer_subscriptions_get";
type SubscriberOp =
  "admin_get_customer_subscription_detail_api_v1_admin_subscriptions_customer_subscriptions__subscription_id__get";
type TeamLeadsOp = "admin_list_team_leads_api_v1_admin_subscriptions_team_leads_get";
type TeamLeadOp =
  "admin_get_team_lead_api_v1_admin_subscriptions_team_leads__lead_id__get";
type FeaturesOp = "admin_list_subscription_features_api_v1_admin_subscriptions_features_get";
type CreateFeatureOp = "admin_create_subscription_feature_api_v1_admin_subscriptions_features_post";
type UpdateFeatureOp = "admin_update_subscription_feature_api_v1_admin_subscriptions_features__feature_id__put";
type SetPlanFeaturesOp =
  "admin_set_subscription_plan_features_api_v1_admin_subscriptions_plans__plan_id__features_put";
type CancelOp =
  "admin_cancel_customer_subscription_api_v1_admin_subscriptions_customer_subscriptions__subscription_id__cancel_post";
type ResumeOp =
  "admin_resume_customer_subscription_api_v1_admin_subscriptions_customer_subscriptions__subscription_id__resume_post";
type ExtendOp =
  "admin_extend_customer_subscription_api_v1_admin_subscriptions_customer_subscriptions__subscription_id__extend_post";
type RevokeOp =
  "admin_revoke_customer_subscription_api_v1_admin_subscriptions_customer_subscriptions__subscription_id__revoke_post";

export type SubscriptionPlan = SuccessResponse<PlanOp>;
export type SubscriptionPlansParams = QueryParams<PlansOp>;
/** A plan in the storefront's shape (`GET /subscriptions/plans/{slug}`), drafts included: what the live preview renders. */
export type SubscriptionPlanPreview = SuccessResponse<PreviewPlanOp>;
export type SubscriptionPlanProduct = NonNullable<SubscriptionPlan["products"]>[number];
export type SubscriptionPlanBenefit = NonNullable<SubscriptionPlan["benefits"]>[number];
export type SubscriptionPlanTranslation = NonNullable<SubscriptionPlan["translations"]>[number];
export type SubscriptionPlanDiscount = NonNullable<SubscriptionPlan["discount"]>;
export type CreateSubscriptionPlanBody = RequestBody<CreatePlanOp>;
export type UpdateSubscriptionPlanBody = RequestBody<UpdatePlanOp>;
export type SetSubscriptionPlanProductsBody = RequestBody<SetProductsOp>;
export type SetSubscriptionPlanBenefitsBody = RequestBody<SetBenefitsOp>;
export type SetSubscriptionPlanDiscountBody = RequestBody<SetDiscountOp>;
export type SubscriptionPlanStatus = RequestBody<SetStatusOp>["status"];
export type AbandonedCheckoutPage = SuccessResponse<AbandonedOp>;
export type AbandonedCheckout = AbandonedCheckoutPage["items"][number];
export type SubscriptionStatsOverview = SuccessResponse<OverviewOp>;
export type SubscriptionStatsWindow = QueryParams<OverviewOp>;
export type SubscriptionPlanStats = SubscriptionStatsOverview["plans"][number];
export type SubscriptionFunnel = SuccessResponse<FunnelOp>;
export type SubscriptionFunnelParams = QueryParams<FunnelOp>;
export type SubscriptionFunnelRow = SubscriptionFunnel["plans"][number];
export type CompanyInsights = SuccessResponse<CompanyInsightsOp>;
export type CompanyInsightsParams = QueryParams<CompanyInsightsOp>;
export type CompanyInsightStage = CompanyInsights["stages"][number];
export type CompanyInsightsTrendPoint = CompanyInsights["trend"][number];
export type SubscriberPage = SuccessResponse<SubscribersOp>;
export type SubscriberRow = SubscriberPage["items"][number];
export type SubscribersParams = QueryParams<SubscribersOp>;
export type SubscriberDetail = SuccessResponse<SubscriberOp>;
export type TeamLeadPage = SuccessResponse<TeamLeadsOp>;
export type TeamLeadRow = TeamLeadPage["items"][number];
export type TeamLeadsParams = QueryParams<TeamLeadsOp>;
export type TeamLeadDetail = SuccessResponse<TeamLeadOp>;
export type TeamLeadId = PathParams<TeamLeadOp>["lead_id"];
export const TEAM_LEAD_STATUSES = ["details", "checkout_started", "converted"] as const;
export type SubscriptionFeature = SuccessResponse<FeaturesOp>[number];
export type SubscriptionFeatureBody = RequestBody<CreateFeatureOp>;
export type SubscriptionPlanFeature = NonNullable<SubscriptionPlan["plan_features"]>[number];
export type SetSubscriptionPlanFeaturesBody = RequestBody<SetPlanFeaturesOp>;

/**
 * Catalog resource types a plan may grant: the ones subscription fulfilment delivers to the LMS. Live diplomas
 * (cohort seats) and consultations are not fulfilled from a subscription; a plan never includes another subscription.
 */
export const SUBSCRIPTION_RESOURCE_TYPES = ["course", "diploma", "package", "bundle"] as const;
export const SUBSCRIBER_STATUSES = ["pending", "active", "past_due", "canceled", "expired"] as const;

export const subscriptionPaths = {
  plans: "admin/subscriptions/plans",
  plan: "admin/subscriptions/plans/{plan_id}",
  preview: "admin/subscriptions/plans/{plan_id}/preview",
  products: "admin/subscriptions/plans/{plan_id}/products",
  benefits: "admin/subscriptions/plans/{plan_id}/benefits",
  status: "admin/subscriptions/plans/{plan_id}/status",
  discount: "admin/subscriptions/plans/{plan_id}/discount",
  cardFeatures: "admin/subscriptions/plans/{plan_id}/card-features",
  duplicate: "admin/subscriptions/plans/{plan_id}/duplicate",
  abandoned: "admin/subscriptions/plans/{plan_id}/abandoned-checkouts",
  overview: "admin/subscriptions/stats/overview",
  funnel: "admin/subscriptions/stats/funnel",
  companyInsights: "admin/subscriptions/stats/company-insights",
  subscribers: "admin/subscriptions/customer-subscriptions",
  teamLeads: "admin/subscriptions/team-leads",
  teamLead: "admin/subscriptions/team-leads/{lead_id}",
  subscriber: "admin/subscriptions/customer-subscriptions/{subscription_id}",
  cancel: "admin/subscriptions/customer-subscriptions/{subscription_id}/cancel",
  resume: "admin/subscriptions/customer-subscriptions/{subscription_id}/resume",
  extend: "admin/subscriptions/customer-subscriptions/{subscription_id}/extend",
  revoke: "admin/subscriptions/customer-subscriptions/{subscription_id}/revoke",
  features: "admin/subscriptions/features",
  feature: "admin/subscriptions/features/{feature_id}",
  planFeatures: "admin/subscriptions/plans/{plan_id}/features",
} as const;

export const subscriptionKeys = {
  all: ["subscriptions"] as const,
  plans: (params?: object) => [...subscriptionKeys.all, "plans", params ?? {}] as const,
  plan: (id: string, lang?: string) => [...subscriptionKeys.all, "plan", id, lang ?? "ar"] as const,
  preview: (id: string) => [...subscriptionKeys.all, "preview", id] as const,
  abandoned: (id: string, params?: object) => [...subscriptionKeys.all, "abandoned", id, params ?? {}] as const,
  overview: (params: object) => [...subscriptionKeys.all, "overview", params] as const,
  funnel: (params: object) => [...subscriptionKeys.all, "funnel", params] as const,
  companyInsights: (params: object) => [...subscriptionKeys.all, "company-insights", params] as const,
  subscribers: (params?: object) => [...subscriptionKeys.all, "subscribers", params ?? {}] as const,
  teamLeads: (params?: object) => [...subscriptionKeys.all, "team-leads", params ?? {}] as const,
  teamLead: (id: string) => [...subscriptionKeys.all, "team-lead", id] as const,
  subscriber: (id: string) => [...subscriptionKeys.all, "subscriber", id] as const,
  features: () => [...subscriptionKeys.all, "features"] as const,
};

type PlanId = PathParams<PlanOp>["plan_id"];
type SubscriptionId = PathParams<SubscriberOp>["subscription_id"];

export const listSubscriptionPlans = (query: SubscriptionPlansParams = {}): Promise<SuccessResponse<PlansOp>> =>
  apiGet(subscriptionPaths.plans, { query });
export const getSubscriptionPlan = (plan_id: PlanId, lang?: string): Promise<SubscriptionPlan> =>
  apiGet(subscriptionPaths.plan, { path: { plan_id }, query: lang ? { lang } : undefined });
/** Arabic, like the storefront. */
export const getSubscriptionPlanPreview = (plan_id: PlanId): Promise<SubscriptionPlanPreview> =>
  apiGet(subscriptionPaths.preview, { path: { plan_id }, query: { lang: "ar" } });
export const listPlanAbandonedCheckouts = (
  plan_id: PlanId,
  query: QueryParams<AbandonedOp> = {},
): Promise<AbandonedCheckoutPage> => apiGet(subscriptionPaths.abandoned, { path: { plan_id }, query });
export const getSubscriptionStatsOverview = (query: SubscriptionStatsWindow): Promise<SubscriptionStatsOverview> =>
  apiGet(subscriptionPaths.overview, { query });
export const getSubscriptionFunnel = (query: SubscriptionFunnelParams): Promise<SubscriptionFunnel> =>
  apiGet(subscriptionPaths.funnel, { query });
/** Company checkout funnel: details submitted vs checkouts started vs paid, and average team sizes. */
export const getCompanyInsights = (query: CompanyInsightsParams): Promise<CompanyInsights> =>
  apiGet(subscriptionPaths.companyInsights, { query });
export const listSubscribers = (query: SubscribersParams = {}): Promise<SubscriberPage> =>
  apiGet(subscriptionPaths.subscribers, { query });
/** Companies that started a team checkout, paid or not (for the business team's follow-up). */
export const listTeamLeads = (query: TeamLeadsParams = {}): Promise<TeamLeadPage> =>
  apiGet(subscriptionPaths.teamLeads, { query });
/** One company's pre-checkout details and where it stopped. */
export const getTeamLead = (lead_id: TeamLeadId): Promise<TeamLeadDetail> =>
  apiGet(subscriptionPaths.teamLead, { path: { lead_id } });
export const getSubscriber = (subscription_id: SubscriptionId): Promise<SubscriberDetail> =>
  apiGet(subscriptionPaths.subscriber, { path: { subscription_id } });

/** Writes. Price/term changes bump the plan version; existing subscribers keep their snapshot. */
export const createSubscriptionPlan = (body: CreateSubscriptionPlanBody): Promise<SubscriptionPlan> =>
  apiPost(subscriptionPaths.plans, { body });
export const updateSubscriptionPlan = (plan_id: PlanId, body: UpdateSubscriptionPlanBody): Promise<SubscriptionPlan> =>
  apiPut(subscriptionPaths.plan, { path: { plan_id }, body });
export const setSubscriptionPlanProducts = (
  plan_id: PlanId,
  body: SetSubscriptionPlanProductsBody,
): Promise<SubscriptionPlan> => apiPut(subscriptionPaths.products, { path: { plan_id }, body });
export const setSubscriptionPlanBenefits = (
  plan_id: PlanId,
  body: SetSubscriptionPlanBenefitsBody,
): Promise<SubscriptionPlan> => apiPut(subscriptionPaths.benefits, { path: { plan_id }, body });
export const setSubscriptionPlanStatus = (plan_id: PlanId, status: SubscriptionPlanStatus): Promise<SubscriptionPlan> =>
  apiPost(subscriptionPaths.status, { path: { plan_id }, body: { status } });
/** `discount: null` removes the sale price. The discount does not bump the plan version. */
export const setSubscriptionPlanDiscount = (
  plan_id: PlanId,
  body: SetSubscriptionPlanDiscountBody,
): Promise<SubscriptionPlan> => apiPut(subscriptionPaths.discount, { path: { plan_id }, body });
export const setSubscriptionPlanCardFeatures = (
  plan_id: PlanId,
  card_features: RequestBody<SetCardFeaturesOp>["card_features"],
): Promise<SuccessResponse<SetCardFeaturesOp>> => apiPut(subscriptionPaths.cardFeatures, { path: { plan_id }, body: { card_features } });
export const duplicateSubscriptionPlan = (plan_id: PlanId, slug: string): Promise<SuccessResponse<DuplicateOp>> =>
  apiPost(subscriptionPaths.duplicate, { path: { plan_id }, body: { slug } });
export const listSubscriptionFeatures = (): Promise<SuccessResponse<FeaturesOp>> => apiGet(subscriptionPaths.features);
export const createSubscriptionFeature = (body: SubscriptionFeatureBody): Promise<SuccessResponse<CreateFeatureOp>> =>
  apiPost(subscriptionPaths.features, { body });
export const updateSubscriptionFeature = (
  feature_id: PathParams<UpdateFeatureOp>["feature_id"],
  body: SubscriptionFeatureBody,
): Promise<SuccessResponse<UpdateFeatureOp>> => apiPut(subscriptionPaths.feature, { path: { feature_id }, body });
/** Replace the catalog features a plan offers, in display order. */
export const setSubscriptionPlanFeatures = (
  plan_id: PlanId,
  body: SetSubscriptionPlanFeaturesBody,
): Promise<SuccessResponse<SetPlanFeaturesOp>> => apiPut(subscriptionPaths.planFeatures, { path: { plan_id }, body });
// Lifecycle actions call Stripe; the idempotency key makes a retried request repeat the same call.
const idempotent = (key: string) => ({ "Idempotency-Key": key });

export const cancelSubscriber = (
  subscription_id: SubscriptionId,
  body: RequestBody<CancelOp>,
  idempotencyKey: string,
): Promise<SuccessResponse<CancelOp>> =>
  apiPost(subscriptionPaths.cancel, { path: { subscription_id }, body, headers: idempotent(idempotencyKey) });
/** Undo a scheduled cancel-at-period-end: renewal continues. */
export const resumeSubscriber = (
  subscription_id: SubscriptionId,
  body: RequestBody<ResumeOp>,
  idempotencyKey: string,
): Promise<SuccessResponse<ResumeOp>> =>
  apiPost(subscriptionPaths.resume, { path: { subscription_id }, body, headers: idempotent(idempotencyKey) });
/** Free days on the current period and its access; Stripe's next charge moves out with it. */
export const extendSubscriber = (
  subscription_id: SubscriptionId,
  body: RequestBody<ExtendOp>,
  idempotencyKey: string,
): Promise<SuccessResponse<ExtendOp>> =>
  apiPost(subscriptionPaths.extend, { path: { subscription_id }, body, headers: idempotent(idempotencyKey) });
/** End the subscription now and revoke the plan's access (reason required, audited). */
export const revokeSubscriber = (
  subscription_id: SubscriptionId,
  body: RequestBody<RevokeOp>,
  idempotencyKey: string,
): Promise<SuccessResponse<RevokeOp>> =>
  apiPost(subscriptionPaths.revoke, { path: { subscription_id }, body, headers: idempotent(idempotencyKey) });

export const subscriptionQueries = {
  plans: (params: SubscriptionPlansParams = {}) =>
    queryOptions({ queryKey: subscriptionKeys.plans(params), queryFn: () => listSubscriptionPlans(params) }),
  plan: (id: string, lang?: string) =>
    queryOptions({ queryKey: subscriptionKeys.plan(id, lang), queryFn: () => getSubscriptionPlan(id, lang) }),
  preview: (id: string) =>
    queryOptions({ queryKey: subscriptionKeys.preview(id), queryFn: () => getSubscriptionPlanPreview(id) }),
  abandoned: (id: string, params: QueryParams<AbandonedOp> = {}) =>
    queryOptions({ queryKey: subscriptionKeys.abandoned(id, params), queryFn: () => listPlanAbandonedCheckouts(id, params) }),
  overview: (params: SubscriptionStatsWindow) =>
    queryOptions({ queryKey: subscriptionKeys.overview(params), queryFn: () => getSubscriptionStatsOverview(params) }),
  funnel: (params: SubscriptionFunnelParams) =>
    queryOptions({ queryKey: subscriptionKeys.funnel(params), queryFn: () => getSubscriptionFunnel(params) }),
  companyInsights: (params: CompanyInsightsParams) =>
    queryOptions({ queryKey: subscriptionKeys.companyInsights(params), queryFn: () => getCompanyInsights(params) }),
  subscriber: (id: string) => queryOptions({ queryKey: subscriptionKeys.subscriber(id), queryFn: () => getSubscriber(id) }),
  teamLead: (id: string) => queryOptions({ queryKey: subscriptionKeys.teamLead(id), queryFn: () => getTeamLead(id) }),
  features: () => queryOptions({ queryKey: subscriptionKeys.features(), queryFn: listSubscriptionFeatures }),
};
