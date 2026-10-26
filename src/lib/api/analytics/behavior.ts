import { queryOptions } from "@tanstack/react-query";

import { apiGet } from "@/lib/api/client";
import type { QueryParams, SuccessResponse } from "@/lib/api/operation-types";

type OverviewOp = "behavior_overview_api_v1_admin_analytics_overview_get";
type FunnelOp = "behavior_funnel_api_v1_admin_analytics_funnels_get";
type EventsOp = "behavior_events_api_v1_admin_analytics_events_get";
type ContentOp = "content_views_api_v1_admin_analytics_content_get";
type TimeSeriesOp = "behavior_timeseries_api_v1_admin_analytics_timeseries_get";
type PostHogOverviewOp = "posthog_overview_api_v1_admin_analytics_posthog_overview_get";
type PostHogTrendsOp = "posthog_trends_api_v1_admin_analytics_posthog_trends_get";
type PostHogFunnelOp = "posthog_funnel_api_v1_admin_analytics_posthog_funnels_get";
type PostHogPagesOp = "posthog_pages_api_v1_admin_analytics_posthog_pages_get";
type PostHogAudienceOp = "posthog_audience_api_v1_admin_analytics_posthog_audience_get";
type PostHogConversionOp = "posthog_conversion_api_v1_admin_analytics_posthog_conversion_get";

export type BehaviorOverview = SuccessResponse<OverviewOp>;
export type EventTypeCount = BehaviorOverview["top_event_types"][number];
export type ContentView = BehaviorOverview["top_content"][number];
export type BehaviorOverviewParams = QueryParams<OverviewOp>;
export type FunnelReport = SuccessResponse<FunnelOp>;
export type FunnelStep = FunnelReport["steps"][number];
export type FunnelParams = QueryParams<FunnelOp>;
export type EventStreamPage = SuccessResponse<EventsOp>;
export type EventStreamRow = EventStreamPage["items"][number];
export type EventStreamParams = QueryParams<EventsOp>;
export type ContentViews = SuccessResponse<ContentOp>;
export type ContentViewsParams = QueryParams<ContentOp>;
export type BehaviorTrends = SuccessResponse<TimeSeriesOp>;
export type BehaviorTrendPoint = NonNullable<BehaviorTrends["points"]>[number];
export type BehaviorTrendsParams = QueryParams<TimeSeriesOp>;
export type PostHogOverview = SuccessResponse<PostHogOverviewOp>;
export type PostHogBreakdownItem = NonNullable<PostHogOverview["top_pages"]>[number];
export type PostHogOverviewParams = QueryParams<PostHogOverviewOp>;
export type PostHogTrends = SuccessResponse<PostHogTrendsOp>;
export type PostHogTrendPoint = NonNullable<PostHogTrends["points"]>[number];
export type PostHogTrendsParams = QueryParams<PostHogTrendsOp>;
export type PostHogFunnelReport = SuccessResponse<PostHogFunnelOp>;
export type PostHogFunnelParams = QueryParams<PostHogFunnelOp>;
export type PostHogPages = SuccessResponse<PostHogPagesOp>;
export type PostHogPageMetric = NonNullable<PostHogPages["top_pages"]>[number];
export type PostHogLandingPage = NonNullable<PostHogPages["landing_pages"]>[number];
export type PostHogPagesParams = QueryParams<PostHogPagesOp>;
export type PostHogAudience = SuccessResponse<PostHogAudienceOp>;
export type PostHogAudienceBand = NonNullable<PostHogAudience["bands"]>[number];
export type PostHogSignupPoint = NonNullable<PostHogAudience["signup_points"]>[number];
export type PostHogAudienceParams = QueryParams<PostHogAudienceOp>;
export type PostHogConversion = SuccessResponse<PostHogConversionOp>;
export type PostHogConversionStep = NonNullable<PostHogConversion["steps"]>[number];
export type PostHogConversionParams = QueryParams<PostHogConversionOp>;

export const behaviorPaths = {
  overview: "admin/analytics/overview",
  funnels: "admin/analytics/funnels",
  events: "admin/analytics/events",
  content: "admin/analytics/content",
  timeseries: "admin/analytics/timeseries",
  posthogOverview: "admin/analytics/posthog/overview",
  posthogTrends: "admin/analytics/posthog/trends",
  posthogFunnels: "admin/analytics/posthog/funnels",
  posthogPages: "admin/analytics/posthog/pages",
  posthogAudience: "admin/analytics/posthog/audience",
  posthogConversion: "admin/analytics/posthog/conversion",
} as const;

export const behaviorKeys = {
  all: ["analytics", "behavior"] as const,
  overview: (params?: BehaviorOverviewParams) => [...behaviorKeys.all, "overview", params ?? {}] as const,
  funnels: (params?: FunnelParams) => [...behaviorKeys.all, "funnels", params ?? {}] as const,
  events: (params?: EventStreamParams) => [...behaviorKeys.all, "events", params ?? {}] as const,
  content: (params?: ContentViewsParams) => [...behaviorKeys.all, "content", params ?? {}] as const,
  timeseries: (params?: BehaviorTrendsParams) => [...behaviorKeys.all, "timeseries", params ?? {}] as const,
  posthogOverview: (params?: PostHogOverviewParams) => [...behaviorKeys.all, "posthog", "overview", params ?? {}] as const,
  posthogTrends: (params?: PostHogTrendsParams) => [...behaviorKeys.all, "posthog", "trends", params ?? {}] as const,
  posthogFunnels: (params?: PostHogFunnelParams) => [...behaviorKeys.all, "posthog", "funnels", params ?? {}] as const,
  posthogPages: (params?: PostHogPagesParams) => [...behaviorKeys.all, "posthog", "pages", params ?? {}] as const,
  posthogAudience: (params?: PostHogAudienceParams) => [...behaviorKeys.all, "posthog", "audience", params ?? {}] as const,
  posthogConversion: (params?: PostHogConversionParams) => [...behaviorKeys.all, "posthog", "conversion", params ?? {}] as const,
};

/** `GET /admin/analytics/overview` — traffic totals, top event types and top content for a window. */
export function behaviorOverview(params: BehaviorOverviewParams): Promise<BehaviorOverview> {
  return apiGet(behaviorPaths.overview, { query: params });
}

/** `GET /admin/analytics/funnels` — distinct visitors per step of a (configurable) funnel. */
export function behaviorFunnel(params: FunnelParams): Promise<FunnelReport> {
  return apiGet(behaviorPaths.funnels, { query: params });
}

/** `GET /admin/analytics/events` — the raw behavior event stream, newest first. */
export function behaviorEvents(params: EventStreamParams): Promise<EventStreamPage> {
  return apiGet(behaviorPaths.events, { query: params });
}

/** `GET /admin/analytics/content` — most-viewed products with viewers and average dwell. */
export function contentViews(params: ContentViewsParams): Promise<ContentViews> {
  return apiGet(behaviorPaths.content, { query: params });
}

/** `GET /admin/analytics/timeseries` — events and visitors per UTC day. */
export function behaviorTimeseries(params: BehaviorTrendsParams): Promise<BehaviorTrends> {
  return apiGet(behaviorPaths.timeseries, { query: params });
}

/** `GET /admin/analytics/posthog/overview` — visitors, sessions, top pages/countries/devices. */
export function posthogOverview(params: PostHogOverviewParams): Promise<PostHogOverview> {
  return apiGet(behaviorPaths.posthogOverview, { query: params });
}

/** `GET /admin/analytics/posthog/trends` — daily storefront activity from PostHog. */
export function posthogTrends(params: PostHogTrendsParams): Promise<PostHogTrends> {
  return apiGet(behaviorPaths.posthogTrends, { query: params });
}

/** `GET /admin/analytics/posthog/funnels` — storefront funnel computed by PostHog. */
export function posthogFunnel(params: PostHogFunnelParams): Promise<PostHogFunnelReport> {
  return apiGet(behaviorPaths.posthogFunnels, { query: params });
}

/** `GET /admin/analytics/posthog/pages` — top pages, landing pages and key conversion pages. */
export function posthogPages(params: PostHogPagesParams): Promise<PostHogPages> {
  return apiGet(behaviorPaths.posthogPages, { query: params });
}

/** `GET /admin/analytics/posthog/audience` — DAU/WAU/MAU, signup growth and recurring bands. */
export function posthogAudience(params: PostHogAudienceParams): Promise<PostHogAudience> {
  return apiGet(behaviorPaths.posthogAudience, { query: params });
}

/** `GET /admin/analytics/posthog/conversion` — conversion and drop-off by step. */
export function posthogConversion(params: PostHogConversionParams): Promise<PostHogConversion> {
  return apiGet(behaviorPaths.posthogConversion, { query: params });
}

export const behaviorQueries = {
  overview: (params: BehaviorOverviewParams) =>
    queryOptions({ queryKey: behaviorKeys.overview(params), queryFn: () => behaviorOverview(params) }),
  funnels: (params: FunnelParams) =>
    queryOptions({ queryKey: behaviorKeys.funnels(params), queryFn: () => behaviorFunnel(params) }),
  events: (params: EventStreamParams) =>
    queryOptions({ queryKey: behaviorKeys.events(params), queryFn: () => behaviorEvents(params) }),
  content: (params: ContentViewsParams) =>
    queryOptions({ queryKey: behaviorKeys.content(params), queryFn: () => contentViews(params) }),
  timeseries: (params: BehaviorTrendsParams) =>
    queryOptions({ queryKey: behaviorKeys.timeseries(params), queryFn: () => behaviorTimeseries(params) }),
  posthogOverview: (params: PostHogOverviewParams) =>
    queryOptions({ queryKey: behaviorKeys.posthogOverview(params), queryFn: () => posthogOverview(params) }),
  posthogTrends: (params: PostHogTrendsParams) =>
    queryOptions({ queryKey: behaviorKeys.posthogTrends(params), queryFn: () => posthogTrends(params) }),
  posthogFunnels: (params: PostHogFunnelParams) =>
    queryOptions({ queryKey: behaviorKeys.posthogFunnels(params), queryFn: () => posthogFunnel(params) }),
  posthogPages: (params: PostHogPagesParams) =>
    queryOptions({ queryKey: behaviorKeys.posthogPages(params), queryFn: () => posthogPages(params) }),
  posthogAudience: (params: PostHogAudienceParams) =>
    queryOptions({ queryKey: behaviorKeys.posthogAudience(params), queryFn: () => posthogAudience(params) }),
  posthogConversion: (params: PostHogConversionParams) =>
    queryOptions({ queryKey: behaviorKeys.posthogConversion(params), queryFn: () => posthogConversion(params) }),
};
