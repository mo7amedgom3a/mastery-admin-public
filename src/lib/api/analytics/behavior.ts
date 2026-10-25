import { queryOptions } from "@tanstack/react-query";

import { apiGet } from "@/lib/api/client";
import type { QueryParams, SuccessResponse } from "@/lib/api/operation-types";

type OverviewOp = "behavior_overview_api_v1_admin_analytics_overview_get";
type FunnelOp = "behavior_funnel_api_v1_admin_analytics_funnels_get";
type EventsOp = "behavior_events_api_v1_admin_analytics_events_get";
type ContentOp = "content_views_api_v1_admin_analytics_content_get";

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

export const behaviorPaths = {
  overview: "admin/analytics/overview",
  funnels: "admin/analytics/funnels",
  events: "admin/analytics/events",
  content: "admin/analytics/content",
} as const;

export const behaviorKeys = {
  all: ["analytics", "behavior"] as const,
  overview: (params?: BehaviorOverviewParams) => [...behaviorKeys.all, "overview", params ?? {}] as const,
  funnels: (params?: FunnelParams) => [...behaviorKeys.all, "funnels", params ?? {}] as const,
  events: (params?: EventStreamParams) => [...behaviorKeys.all, "events", params ?? {}] as const,
  content: (params?: ContentViewsParams) => [...behaviorKeys.all, "content", params ?? {}] as const,
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

export const behaviorQueries = {
  overview: (params: BehaviorOverviewParams) =>
    queryOptions({ queryKey: behaviorKeys.overview(params), queryFn: () => behaviorOverview(params) }),
  funnels: (params: FunnelParams) =>
    queryOptions({ queryKey: behaviorKeys.funnels(params), queryFn: () => behaviorFunnel(params) }),
  events: (params: EventStreamParams) =>
    queryOptions({ queryKey: behaviorKeys.events(params), queryFn: () => behaviorEvents(params) }),
  content: (params: ContentViewsParams) =>
    queryOptions({ queryKey: behaviorKeys.content(params), queryFn: () => contentViews(params) }),
};
