import { queryOptions } from "@tanstack/react-query";

import { apiGet } from "@/lib/api/client";
import type { QueryParams, SuccessResponse } from "@/lib/api/operation-types";

type AnnouncementsOp = "list_announcements_api_v1_admin_marketing_announcements_get";
type BannersOp = "list_banners_api_v1_admin_marketing_banners_get";
type SlidersOp = "list_sliders_api_v1_admin_marketing_sliders_get";

export type AnnouncementsParams = QueryParams<AnnouncementsOp>;
export type AnnouncementPage = SuccessResponse<AnnouncementsOp>;
export type BannersParams = QueryParams<BannersOp>;
export type BannerPage = SuccessResponse<BannersOp>;
export type SlidersParams = QueryParams<SlidersOp>;
export type SliderPage = SuccessResponse<SlidersOp>;

/** Storefront marketing content (`/admin/marketing`): announcement bars, banners, sliders. */
export const contentPaths = {
  announcements: "admin/marketing/announcements",
  banners: "admin/marketing/banners",
  sliders: "admin/marketing/sliders",
} as const;

export const contentKeys = {
  all: ["marketing", "content"] as const,
  announcements: (params?: AnnouncementsParams) => [...contentKeys.all, "announcements", params ?? {}] as const,
  banners: (params?: BannersParams) => [...contentKeys.all, "banners", params ?? {}] as const,
  sliders: (params?: SlidersParams) => [...contentKeys.all, "sliders", params ?? {}] as const,
};

export const listAnnouncements = (params: AnnouncementsParams = {}): Promise<AnnouncementPage> =>
  apiGet(contentPaths.announcements, { query: params });
export const listBanners = (params: BannersParams = {}): Promise<BannerPage> =>
  apiGet(contentPaths.banners, { query: params });
export const listSliders = (params: SlidersParams = {}): Promise<SliderPage> =>
  apiGet(contentPaths.sliders, { query: params });

export const contentQueries = {
  announcements: (params?: AnnouncementsParams) =>
    queryOptions({ queryKey: contentKeys.announcements(params), queryFn: () => listAnnouncements(params) }),
  banners: (params?: BannersParams) =>
    queryOptions({ queryKey: contentKeys.banners(params), queryFn: () => listBanners(params) }),
  sliders: (params?: SlidersParams) =>
    queryOptions({ queryKey: contentKeys.sliders(params), queryFn: () => listSliders(params) }),
};
